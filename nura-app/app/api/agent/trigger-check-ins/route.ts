import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { placeOutboundCall, isElevenLabsCallingConfigured } from "@/lib/integrations/elevenlabs";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";

function toE164(digits: string) {
  return digits.startsWith("+") ? digits : `+${digits}`;
}

// If the newest due check-in for a phone number is older than this, treat the
// whole backlog for that number as missed instead of cold-calling about it.
const STALE_THRESHOLD_MINUTES = 60;

type DueCheckIn = {
  id: string;
  owner_id: string;
  plan_id: string;
  prompt: string;
  scheduled_for: string;
  contact_phone: string | null;
  nura_plans?: { title?: string } | null;
};

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: dueCheckIns, error: dueError } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, scheduled_for, contact_phone, nura_plans(title)")
    .is("completed_at", null)
    .is("triggered_at", null)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (dueError) {
    return NextResponse.json({ ok: false, error: dueError.message }, { status: 500 });
  }

  if (!dueCheckIns || dueCheckIns.length === 0) {
    return NextResponse.json({ ok: true, triggered: [] });
  }

  // Claim these rows atomically before doing anything else. Previously triggered_at was
  // only set after the outbound call finished, leaving a window where a second overlapping
  // invocation (an overlapping cron tick, a retry) could select the same still-unclaimed
  // check-ins and place a duplicate call. The `.is("triggered_at", null)` condition means
  // only rows nobody has claimed yet actually get updated - `.select()` returns exactly
  // those, so anything already claimed by a concurrent run is dropped from this run.
  const { data: claimed, error: claimError } = await supabase
    .from("nura_check_ins")
    .update({ triggered_at: nowIso, call_status: "processing" })
    .in("id", (dueCheckIns as DueCheckIn[]).map((c) => c.id))
    .is("triggered_at", null)
    .select("id");

  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError.message }, { status: 500 });
  }

  const claimedIds = new Set((claimed ?? []).map((row) => row.id as string));
  const claimedCheckIns = (dueCheckIns as DueCheckIn[]).filter((c) => claimedIds.has(c.id));
  if (claimedCheckIns.length === 0) {
    return NextResponse.json({ ok: true, triggered: [] });
  }

  // Resolve a call-target phone per check-in: the check-in's own contact_phone
  // (captured directly from whoever messaged, e.g. via WhatsApp) if present,
  // otherwise the owning account's actively linked WhatsApp number.
  const ownersNeedingLookup = Array.from(
    new Set(
      claimedCheckIns
        .filter((c) => !c.contact_phone)
        .map((c) => c.owner_id),
    ),
  );

  const [{ data: links }, { data: profiles }] = await Promise.all([
    ownersNeedingLookup.length > 0
      ? supabase
          .from("nura_channel_links")
          .select("owner_id, channel_identifier")
          .in("owner_id", ownersNeedingLookup)
          .eq("provider", "whatsapp")
          .eq("status", "active")
      : Promise.resolve({ data: [] as { owner_id: string; channel_identifier: string }[] }),
    supabase
      .from("nura_profiles")
      .select("id, display_name, phone")
      .in("id", Array.from(new Set(claimedCheckIns.map((c) => c.owner_id)))),
  ]);

  const linkedPhoneByOwner = new Map((links ?? []).map((l) => [l.owner_id, l.channel_identifier as string]));
  const nameByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.display_name as string | null) ?? ""]));
  const profilePhoneByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.phone as string | null) ?? ""]));
  const plusByOwner = new Map<string, boolean>();
  await Promise.all(Array.from(new Set(claimedCheckIns.map((c) => c.owner_id))).map(async (ownerId) => {
    plusByOwner.set(ownerId, (await getSubscriptionAccess(supabase, ownerId)).hasPlus);
  }));

  const results: Record<string, unknown>[] = [];
  const noPhoneCheckInIds: string[] = [];
  const gatedCheckInIds: string[] = [];
  const phoneGroups = new Map<string, DueCheckIn[]>();

  for (const checkIn of claimedCheckIns) {
    if (!plusByOwner.get(checkIn.owner_id)) {
      gatedCheckInIds.push(checkIn.id);
      continue;
    }

    // Prefer a phone captured directly on the check-in (e.g. via WhatsApp), then an
    // active WhatsApp link, then the phone number the user gave us at onboarding/in
    // Settings - this last tier is what lets in-app-only accounts still get real calls.
    const phone = checkIn.contact_phone || linkedPhoneByOwner.get(checkIn.owner_id) || profilePhoneByOwner.get(checkIn.owner_id);
    if (!phone) {
      noPhoneCheckInIds.push(checkIn.id);
      continue;
    }
    const key = phone.replace(/[^\d]/g, "");
    const group = phoneGroups.get(key) ?? [];
    group.push(checkIn);
    phoneGroups.set(key, group);
  }

  if (noPhoneCheckInIds.length > 0) {
    await supabase
      .from("nura_check_ins")
      .update({ triggered_at: nowIso, call_status: "skipped_no_phone" })
      .in("id", noPhoneCheckInIds);
    for (const id of noPhoneCheckInIds) {
      results.push({ checkInId: id, status: "skipped_no_phone" });
    }
  }

  if (gatedCheckInIds.length > 0) {
    await supabase
      .from("nura_check_ins")
      .update({ triggered_at: nowIso, call_status: "skipped_plus_required" })
      .in("id", gatedCheckInIds);
    for (const id of gatedCheckInIds) {
      results.push({ checkInId: id, status: "skipped_plus_required" });
    }
  }

  if (phoneGroups.size > 0 && !isElevenLabsCallingConfigured()) {
    return NextResponse.json({ ok: false, error: "ElevenLabs outbound calling is not configured." }, { status: 503 });
  }

  for (const [phoneKey, group] of phoneGroups) {
    // Newest-due check-in in the group carries the call; everything older for
    // this same number is folded in as missed context rather than dialed separately.
    const sorted = [...group].sort(
      (a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime(),
    );
    const primary = sorted[0];
    const backlog = sorted.slice(1);
    const planTitle = primary.nura_plans?.title ?? "your Thread";

    const minutesOverdue = (now.getTime() - new Date(primary.scheduled_for).getTime()) / 60_000;

    if (minutesOverdue > STALE_THRESHOLD_MINUTES) {
      const allIds = sorted.map((c) => c.id);
      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: nowIso, call_status: "missed_stale" })
        .in("id", allIds);
      for (const c of allIds) {
        results.push({ checkInId: c, planTitle, status: "missed_stale" });
      }
      continue;
    }

    if (backlog.length > 0) {
      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: nowIso, call_status: "missed_consolidated" })
        .in("id", backlog.map((c) => c.id));
      for (const c of backlog) {
        results.push({ checkInId: c.id, planTitle, status: "missed_consolidated" });
      }
    }

    const displayName = (nameByOwner.get(primary.owner_id) ?? "").trim();
    const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
    const toNumber = toE164(phoneKey);

    try {
      const context = await buildVoiceCheckinContext(supabase, primary.owner_id, primary.plan_id, firstName);
      const dynamicVariables = {
        ...(context?.dynamicVariables ?? {
          user_name: firstName,
          user_id: primary.owner_id,
          plan_id: primary.plan_id,
          thread_title: planTitle,
          thread_context: "",
          checkin_goal: primary.prompt,
        }),
        checkin_goal: primary.prompt || context?.dynamicVariables.checkin_goal || "",
      };

      const call = await placeOutboundCall({ toNumber, dynamicVariables });

      await supabase
        .from("nura_check_ins")
        .update({
          triggered_at: nowIso,
          call_status: "placed",
          call_conversation_id: call.conversation_id ?? null,
        })
        .eq("id", primary.id);

      results.push({ checkInId: primary.id, planTitle, toNumber, status: "placed", conversationId: call.conversation_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Outbound call failed.";
      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: nowIso, call_status: "failed", call_error: message })
        .eq("id", primary.id);
      results.push({ checkInId: primary.id, planTitle, toNumber, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, triggered: results });
}
