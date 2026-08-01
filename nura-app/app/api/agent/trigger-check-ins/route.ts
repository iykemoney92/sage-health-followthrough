import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { placeOutboundCall, isElevenLabsCallingConfigured, getConversationOutcome } from "@/lib/integrations/elevenlabs";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";
import { sendPushToOwner } from "@/lib/integrations/push";
import { sendWhatsappText } from "@/lib/integrations/whatsapp";
import { composeCheckinOpener, composeMissedCallFollowup } from "@/lib/domain/message-intake";

function toE164(digits: string) {
  return digits.startsWith("+") ? digits : `+${digits}`;
}

// Every proactive check-in - regardless of which channel actually delivered it - should show
// up as Nura's own opening line in the shared conversation. Without this, a WhatsApp text or
// push notification lands somewhere the in-app chat never reflects, and a check-in stops being
// a conversation Nura started and becomes an isolated one-off message the user can't reply into.
async function insertOpenerMessage(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  ownerId: string,
  planId: string,
  content: string,
) {
  try {
    await supabase.from("nura_messages").insert({
      owner_id: ownerId,
      plan_id: planId,
      role: "assistant",
      content,
    });
  } catch {
    // Non-blocking — delivery already happened on the outbound channel.
  }
}

// If the newest due check-in for a phone number is older than this, treat the
// whole backlog for that number as missed instead of cold-calling about it.
const STALE_THRESHOLD_MINUTES = 60;

// A placed call needs at least this long to ring out / go to voicemail / connect before its
// outcome is worth checking - checking too early would just see "initiated" every time.
const CALL_OUTCOME_CHECK_DELAY_SECONDS = 45;
// If a call's outcome still hasn't resolved to a terminal state after this long, stop polling
// and escalate anyway rather than leaving the check-in stuck as "placed" forever.
const CALL_OUTCOME_TIMEOUT_MINUTES = 6;
// A "placed" call this old was never resolved by any earlier version of this dispatcher (or a
// prior outage) - too stale to honestly say "I just tried calling you", so it's silently marked
// failed with no user-facing message instead of running through the normal escalation path.
const CALL_ABANDONED_AFTER_MINUTES = 30;

type DueCheckIn = {
  id: string;
  owner_id: string;
  plan_id: string;
  prompt: string;
  scheduled_for: string;
  contact_phone: string | null;
  channel: string | null;
  nura_plans?: { title?: string; category?: string | null } | null;
};

type PlacedCall = {
  id: string;
  owner_id: string;
  plan_id: string;
  prompt: string;
  contact_phone: string | null;
  call_conversation_id: string;
  triggered_at: string;
  nura_plans?: { title?: string; category?: string | null } | null;
};

// Resolves calls that were placed on an earlier tick: polls ElevenLabs for the real outcome
// (a call being *accepted* by Twilio doesn't mean it was *answered*), and when it looks like the
// user never picked up, autonomously falls back to a WhatsApp text so the check-in still lands
// through a channel the user actually allows, instead of silently going nowhere.
async function resolveOutstandingCalls(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const checkableCutoff = new Date(Date.now() - CALL_OUTCOME_CHECK_DELAY_SECONDS * 1000).toISOString();
  const abandonedCutoff = new Date(Date.now() - CALL_ABANDONED_AFTER_MINUTES * 60_000).toISOString();
  const timeoutCutoff = Date.now() - CALL_OUTCOME_TIMEOUT_MINUTES * 60_000;

  // Anything left in "placed" from before this abandoned-cutoff predates any version of this
  // resolver ever running (or survived an outage) - too old to honestly claim "I just called",
  // so it's quietly closed out with no user-facing message rather than fed through escalate().
  await supabase
    .from("nura_check_ins")
    .update({ call_status: "failed", call_error: "Call outcome was never resolved in time." })
    .eq("call_status", "placed")
    .not("call_conversation_id", "is", null)
    .lt("triggered_at", abandonedCutoff);

  const { data: placedCalls } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, contact_phone, call_conversation_id, triggered_at, nura_plans(title)")
    .eq("call_status", "placed")
    .not("call_conversation_id", "is", null)
    .gte("triggered_at", abandonedCutoff)
    .lte("triggered_at", checkableCutoff)
    .limit(25);

  const calls = (placedCalls ?? []) as PlacedCall[];
  if (calls.length === 0) return;

  const ownerIds = Array.from(new Set(calls.map((c) => c.owner_id)));
  const [{ data: links }, { data: profiles }] = await Promise.all([
    supabase
      .from("nura_channel_links")
      .select("owner_id, channel_identifier")
      .in("owner_id", ownerIds)
      .eq("provider", "whatsapp")
      .eq("status", "active"),
    supabase.from("nura_profiles").select("id, display_name, phone, preferred_checkin_channels").in("id", ownerIds),
  ]);

  const linkedPhoneByOwner = new Map((links ?? []).map((l) => [l.owner_id, l.channel_identifier as string]));
  const nameByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.display_name as string | null) ?? ""]));
  const profilePhoneByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.phone as string | null) ?? ""]));
  const allowedByOwner = new Map(
    (profiles ?? []).map((p) => [p.id, ((p.preferred_checkin_channels as string[] | null) ?? ["voice", "whatsapp", "in_app"])]),
  );

  async function escalate(call: PlacedCall, note: string) {
    const allowed = allowedByOwner.get(call.owner_id) ?? ["voice", "whatsapp", "in_app"];
    const phone = call.contact_phone || linkedPhoneByOwner.get(call.owner_id) || profilePhoneByOwner.get(call.owner_id);
    const displayName = (nameByOwner.get(call.owner_id) ?? "").trim();
    const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
    const planTitle = call.nura_plans?.title ?? "your Care plan";

    const message = await composeMissedCallFollowup(firstName, planTitle, call.prompt);

    if (phone && allowed.includes("whatsapp")) {
      try {
        const outcome = await sendWhatsappText(phone.replace(/[^\d]/g, ""), message);
        if (outcome.skipped || outcome.error) throw new Error(outcome.error ?? "WhatsApp is not configured.");
        await insertOpenerMessage(supabase, call.owner_id, call.plan_id, message);
        await supabase.from("nura_check_ins").update({ call_status: "escalated_whatsapp" }).eq("id", call.id);
        return;
      } catch {
        // Fall through to a push notification below.
      }
    }

    await insertOpenerMessage(supabase, call.owner_id, call.plan_id, message);
    const pushResult = await sendPushToOwner(call.owner_id, {
      title: "Nura tried to call",
      body: message,
      url: `/workspace?planId=${call.plan_id}`,
    }).catch(() => null);

    const pushDelivered = Boolean(pushResult && pushResult.sent > 0);
    await supabase
      .from("nura_check_ins")
      .update({
        call_status: pushDelivered ? "escalated_push" : "failed",
        call_error: pushDelivered
          ? note
          : `${note}${pushResult?.skipped ? ` (push: ${pushResult.skipped})` : pushResult?.error ? ` (push: ${pushResult.error})` : " (no push subscription)"}`,
      })
      .eq("id", call.id);
  }

  await Promise.all(
    calls.map(async (call) => {
      const isStuck = new Date(call.triggered_at).getTime() < timeoutCutoff;
      const outcome = await getConversationOutcome(call.call_conversation_id);

      if (!outcome) {
        if (isStuck) await escalate(call, "Could not confirm the call's outcome.");
        return;
      }

      if (outcome.status === "initiated" || outcome.status === "in-progress") {
        if (isStuck) await escalate(call, "The call never connected.");
        return;
      }
      if (outcome.status === "processing") {
        if (isStuck) await escalate(call, "Call ended but the outcome never finished processing.");
        return;
      }

      // A real conversation happened: not an explicit failure, ran a meaningful length, and
      // actually produced a transcript (a call that rings to voicemail or is declined tends to
      // be a few seconds with no transcript, even though Twilio still reports it as "connected").
      const wentThrough = outcome.status === "done" && outcome.callSuccessful !== "failure" && outcome.durationSecs >= 8 && outcome.hasTranscript;
      if (wentThrough) {
        await supabase.from("nura_check_ins").update({ call_status: "completed" }).eq("id", call.id);
        return;
      }

      await escalate(call, outcome.status === "failed" ? "The call failed to connect." : "The call wasn't answered.");
    }),
  );
}

function isAuthorizedTrigger(request: NextRequest) {
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (agentSecret && request.headers.get("x-agent-secret") === agentSecret) return true;

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

async function runTriggerCheckIns(request: NextRequest) {
  if (!process.env.AGENT_TOOL_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (!isAuthorizedTrigger(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  // Resolve outcomes for calls placed on earlier ticks first, regardless of whether anything
  // new is due right now - this is the only place that ever checks back on a placed call.
  await resolveOutstandingCalls(supabase);

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: dueCheckIns, error: dueError } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, scheduled_for, contact_phone, channel, nura_plans(title, category)")
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
      .select("id, display_name, phone, preferred_checkin_channels")
      .in("id", Array.from(new Set(claimedCheckIns.map((c) => c.owner_id)))),
  ]);

  const linkedPhoneByOwner = new Map((links ?? []).map((l) => [l.owner_id, l.channel_identifier as string]));
  const nameByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.display_name as string | null) ?? ""]));
  const profilePhoneByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.phone as string | null) ?? ""]));
  const allowedChannelsByOwner = new Map(
    (profiles ?? []).map((p) => [p.id, ((p.preferred_checkin_channels as string[] | null) ?? ["voice", "whatsapp", "in_app"])]),
  );

  // A check-in's channel was decided by the AI (or a prior default) at the moment it was
  // scheduled, but the user's allowed set can change afterward in Settings - reroute at
  // dispatch time instead of trusting a possibly-stale stored channel.
  function rerouteChannel(original: string | null, allowed: string[]): "voice" | "whatsapp" | "in_app" {
    const requested = (original as "voice" | "whatsapp" | "in_app" | null) || "whatsapp";
    if (allowed.includes(requested)) return requested;
    if (allowed.includes("whatsapp")) return "whatsapp";
    if (allowed.includes("in_app")) return "in_app";
    if (allowed.includes("voice")) return "voice";
    return "in_app";
  }
  const plusByOwner = new Map<string, boolean>();
  await Promise.all(Array.from(new Set(claimedCheckIns.map((c) => c.owner_id))).map(async (ownerId) => {
    plusByOwner.set(ownerId, (await getSubscriptionAccess(supabase, ownerId)).hasPlus);
  }));

  const results: Record<string, unknown>[] = [];
  const pushCheckIns: DueCheckIn[] = [];
  const gatedCheckInIds: string[] = [];
  const phoneGroups = new Map<string, DueCheckIn[]>();
  const whatsappTargets: Array<{ checkIn: DueCheckIn; phone: string }> = [];

  for (const checkIn of claimedCheckIns) {
    if (!plusByOwner.get(checkIn.owner_id)) {
      gatedCheckInIds.push(checkIn.id);
      continue;
    }

    // The AI decides a channel per check-in when it schedules the follow-up (voice call,
    // WhatsApp text, or in-app only) - honour that, rerouted through the owner's currently
    // allowed channels in case their preference changed since this was scheduled.
    const allowed = allowedChannelsByOwner.get(checkIn.owner_id) ?? ["voice", "whatsapp", "in_app"];
    const effectiveChannel = rerouteChannel(checkIn.channel, allowed);

    if (effectiveChannel === "in_app") {
      pushCheckIns.push(checkIn);
      continue;
    }

    // Prefer a phone captured directly on the check-in (e.g. via WhatsApp), then an
    // active WhatsApp link, then the phone number the user gave us at onboarding/in
    // Settings - this last tier is what lets in-app-only accounts still get real calls.
    const phone = checkIn.contact_phone || linkedPhoneByOwner.get(checkIn.owner_id) || profilePhoneByOwner.get(checkIn.owner_id);
    if (!phone) {
      pushCheckIns.push(checkIn);
      continue;
    }

    if (effectiveChannel === "whatsapp") {
      whatsappTargets.push({ checkIn, phone: phone.replace(/[^\d]/g, "") });
      continue;
    }

    const key = phone.replace(/[^\d]/g, "");
    const group = phoneGroups.get(key) ?? [];
    group.push(checkIn);
    phoneGroups.set(key, group);
  }

  if (pushCheckIns.length > 0) {
    // No phone to call, or the check-in was explicitly scheduled as in-app-only - this is
    // the gap "In the app" / no-phone users fall into. A check-in is Nura opening a real
    // conversation, not a link to a static page, so this composes the same kind of opener
    // WhatsApp gets, writes it into the shared conversation, and sends the push straight into
    // the chat (not the Journey checklist) so the notification is an entry point to actually
    // talk, not a dead end.
    await Promise.all(
      pushCheckIns.map(async (checkIn) => {
        const displayName = (nameByOwner.get(checkIn.owner_id) ?? "").trim();
        const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
        const planTitle = checkIn.nura_plans?.title ?? "your Care plan";
        const opener = await composeCheckinOpener(firstName, planTitle, checkIn.prompt, checkIn.nura_plans?.category);
        await insertOpenerMessage(supabase, checkIn.owner_id, checkIn.plan_id, opener);

        const pushResult = await sendPushToOwner(checkIn.owner_id, {
          title: "Nura",
          body: opener,
          url: `/workspace?planId=${checkIn.plan_id}`,
        }).catch(() => null);

        const delivered = Boolean(pushResult && pushResult.sent > 0);
        await supabase
          .from("nura_check_ins")
          .update({
            triggered_at: nowIso,
            call_status: delivered ? "sent_push" : "failed",
            call_error: delivered
              ? null
              : pushResult?.skipped === "no_subscriptions"
                ? "No browser push subscription — ask the user to enable notifications in Preferences."
                : pushResult?.skipped === "not_configured"
                  ? "Browser push is not configured on the server."
                  : pushResult?.error || "Push notification was not delivered.",
          })
          .eq("id", checkIn.id);

        results.push({
          checkInId: checkIn.id,
          status: delivered ? "sent_push" : "failed",
          push: pushResult,
        });
      }),
    );
  }

  if (whatsappTargets.length > 0) {
    await Promise.all(
      whatsappTargets.map(async ({ checkIn, phone }) => {
        const displayName = (nameByOwner.get(checkIn.owner_id) ?? "").trim();
        const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
        const planTitle = checkIn.nura_plans?.title ?? "your Care plan";
        const opener = await composeCheckinOpener(
          firstName,
          planTitle,
          checkIn.prompt,
          checkIn.nura_plans?.category,
        );

        try {
          const outcome = await sendWhatsappText(phone, opener);
          if (outcome.skipped) throw new Error("WhatsApp is not configured.");
          if (outcome.error) throw new Error(outcome.error);

          await insertOpenerMessage(supabase, checkIn.owner_id, checkIn.plan_id, opener);
          await supabase
            .from("nura_check_ins")
            .update({ triggered_at: nowIso, call_status: "sent_whatsapp" })
            .eq("id", checkIn.id);
          results.push({ checkInId: checkIn.id, planTitle, status: "sent_whatsapp" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "WhatsApp send failed.";
          await insertOpenerMessage(supabase, checkIn.owner_id, checkIn.plan_id, opener);
          const pushResult = await sendPushToOwner(checkIn.owner_id, {
            title: "Nura",
            body: opener,
            url: `/workspace?planId=${checkIn.plan_id}`,
          }).catch(() => null);
          const delivered = Boolean(pushResult && pushResult.sent > 0);

          await supabase
            .from("nura_check_ins")
            .update({
              triggered_at: nowIso,
              call_status: delivered ? "escalated_push" : "failed",
              call_error: delivered ? `WhatsApp failed (${message}); sent browser push instead.` : message,
            })
            .eq("id", checkIn.id);
          results.push({
            checkInId: checkIn.id,
            planTitle,
            status: delivered ? "escalated_push" : "failed",
            error: message,
            push: pushResult,
          });
        }
      }),
    );
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
    const planTitle = primary.nura_plans?.title ?? "your Care plan";

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

      const call = await placeOutboundCall({
        toNumber,
        dynamicVariables,
        agentId: context?.elevenLabsAgentId,
      });

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

/** Vercel Cron uses GET; agent/manual triggers use POST. */
export async function GET(request: NextRequest) {
  return runTriggerCheckIns(request);
}

export async function POST(request: NextRequest) {
  return runTriggerCheckIns(request);
}
