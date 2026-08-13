import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { placeOutboundCall, isElevenLabsCallingConfigured, getConversationOutcome } from "@/lib/integrations/elevenlabs";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";
import { sendPushToOwner } from "@/lib/integrations/push";
import { sendWhatsappText } from "@/lib/integrations/whatsapp";
import { composeCheckinOpener, composeMissedCallFollowup } from "@/lib/domain/message-intake";
import { scheduleIdleWellnessCheckIns, isWithinQuietHours, nextTimeOutsideQuietHours } from "@/lib/domain/idle-wellness";
import { readProfileSettings } from "@/lib/profile-settings";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";
import { rerouteChannel, type CheckinChannel } from "@/lib/domain/checkin-channel";
import {
  resolveCallForCheckIn,
  placeDueRedials,
  CALL_OUTCOME_CHECK_DELAY_SECONDS,
  CALL_OUTCOME_TIMEOUT_MINUTES,
  type ResolvableCheckIn,
} from "@/lib/domain/call-outcome";

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

// Dispatcher lag (a stalled droplet tick, a manual re-fire after downtime) can still leave a
// check-in unclaimed for a while. Still place the voice call within this window so a late tick
// does not silently drop the check-in.
const MAX_VOICE_LATENESS_MINUTES = 6 * 60;

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

type PlacedCall = ResolvableCheckIn;

// Resolves calls that were placed on an earlier tick and whose outcome the ElevenLabs post-call
// webhook hasn't (yet) reported - normally that webhook resolves a call within seconds of the
// conversation ending, so this is now a safety net for missed/delayed webhook deliveries rather
// than the primary detection path. Shares resolveCallForCheckIn with the webhook handler so the
// two paths can never disagree about what counts as "connected".
async function resolveOutstandingCalls(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const checkableCutoff = new Date(Date.now() - CALL_OUTCOME_CHECK_DELAY_SECONDS * 1000).toISOString();
  const timeoutCutoff = Date.now() - CALL_OUTCOME_TIMEOUT_MINUTES * 60_000;

  const { data: placedCalls } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, contact_phone, call_conversation_id, triggered_at, call_attempts, nura_plans(title)")
    .eq("call_status", "placed")
    .not("call_conversation_id", "is", null)
    .lte("triggered_at", checkableCutoff)
    .limit(40);

  const calls = (placedCalls ?? []) as PlacedCall[];
  if (calls.length === 0) return;

  await Promise.all(
    calls.map(async (call) => {
      const isStuck = new Date(call.triggered_at).getTime() < timeoutCutoff;
      const outcome = call.call_conversation_id ? await getConversationOutcome(call.call_conversation_id) : null;
      await resolveCallForCheckIn(supabase, call, outcome, isStuck);
    }),
  );
}

const STALE_GRACE_HOURS = 24;
const TERMINAL_UNREACHED_STATUSES = ["failed", "escalated_whatsapp", "escalated_email", "escalated_push"];

type StaleCheckIn = {
  id: string;
  owner_id: string;
  plan_id: string;
  prompt: string;
  recurrence: string | null;
  contact_phone: string | null;
};

// Once voice + WhatsApp + push have all failed (or been exhausted) for a check-in, nothing used
// to ever revisit it - it just stayed incomplete forever. This sweep marks those rows
// `missed_stale` (a status messages/route.ts already surfaces as conversation context, but never
// actually got written anywhere) and, for one-off Care plans with no other open check-in, lays
// down a fresh in-app follow-up so the wellness thread doesn't just end.
async function sweepStaleCheckIns(supabase: ReturnType<typeof getSupabaseServerClient>) {
  const cutoff = new Date(Date.now() - STALE_GRACE_HOURS * 60 * 60_000).toISOString();
  const { data: staleRows } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, recurrence, contact_phone")
    .in("call_status", TERMINAL_UNREACHED_STATUSES)
    .is("completed_at", null)
    .lte("triggered_at", cutoff)
    .limit(50);

  const rows = (staleRows ?? []) as StaleCheckIn[];
  if (rows.length === 0) return { marked: 0, requeued: 0 };

  await supabase
    .from("nura_check_ins")
    .update({ call_status: "missed_stale" })
    .in("id", rows.map((r) => r.id));

  // Recurring series already lay down their next occurrence independently - only one-off
  // check-ins with nothing else open for the plan need a fresh follow-up here.
  const oneOffRows = rows.filter((r) => !r.recurrence || r.recurrence === "none");
  let requeued = 0;
  await Promise.all(
    oneOffRows.map(async (row) => {
      const { count } = await supabase
        .from("nura_check_ins")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", row.plan_id)
        .neq("id", row.id)
        .is("completed_at", null);
      if ((count ?? 0) > 0) return;

      // in_app is deliberately the follow-up channel: voice and WhatsApp already failed once
      // for this thread, so retry through the one channel that doesn't depend on reachability.
      const { error } = await supabase.from("nura_check_ins").insert({
        owner_id: row.owner_id,
        plan_id: row.plan_id,
        channel: "in_app",
        prompt: row.prompt,
        scheduled_for: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        contact_phone: row.contact_phone,
      });
      if (!error) requeued += 1;
    }),
  );

  return { marked: rows.length, requeued };
}

/**
 * Defers due voice/WhatsApp check-ins whose owner is currently in quiet hours to the end of that
 * window, instead of letting a call ring or a WhatsApp text buzz overnight. in_app-only check-ins
 * are unaffected (a badge landing quietly is not the same disruption). Idle-wellness check-ins
 * already self-defer at creation time; this is the safety net for every other origin
 * (conversational scheduling, the schedule-checkin agent tool, recurring series, etc.).
 */
async function deferQuietHoursCheckIns(
  supabase: SupabaseClient,
  dueCheckIns: DueCheckIn[],
): Promise<{ ready: DueCheckIn[]; deferred: number }> {
  const ownerIds = Array.from(new Set(dueCheckIns.map((c) => c.owner_id)));
  const { data: profiles } = await supabase
    .from("nura_profiles")
    .select("id, phone, preferred_checkin_channels")
    .in("id", ownerIds);

  const allowedByOwner = new Map<string, CheckinChannel[]>(
    (profiles ?? []).map((p) => [p.id, (p.preferred_checkin_channels as CheckinChannel[] | null) ?? ["voice", "whatsapp", "in_app"]]),
  );
  const phoneByOwner = new Map((profiles ?? []).map((p) => [p.id, (p.phone as string | null) ?? null]));

  const ready: DueCheckIn[] = [];
  const deferredUpdates: Array<{ id: string; scheduled_for: string }> = [];

  await Promise.all(
    dueCheckIns.map(async (checkIn) => {
      const allowed = allowedByOwner.get(checkIn.owner_id) ?? (["voice", "whatsapp", "in_app"] as CheckinChannel[]);
      const effectiveChannel = rerouteChannel(checkIn.channel, allowed);
      if (effectiveChannel === "in_app") {
        ready.push(checkIn);
        return;
      }

      try {
        const { data: authData } = await supabase.auth.admin.getUserById(checkIn.owner_id);
        const metadata = (authData?.user?.user_metadata ?? null) as Record<string, unknown> | null;
        const settings = readProfileSettings(metadata);
        if (!settings.quietHours.enabled) {
          ready.push(checkIn);
          return;
        }

        const timeZone = await resolveUserTimeZone(supabase, checkIn.owner_id, {
          phoneDigits: phoneByOwner.get(checkIn.owner_id) ?? null,
          authMetadata: metadata,
        });
        const dueAt = new Date(checkIn.scheduled_for);
        if (!isWithinQuietHours(dueAt, settings.quietHours, timeZone)) {
          ready.push(checkIn);
          return;
        }

        const rescheduled = nextTimeOutsideQuietHours(dueAt, settings.quietHours, timeZone);
        deferredUpdates.push({ id: checkIn.id, scheduled_for: rescheduled.toISOString() });
      } catch {
        // If quiet-hours resolution fails for any reason, fail open - deliver the check-in
        // rather than silently losing it.
        ready.push(checkIn);
      }
    }),
  );

  if (deferredUpdates.length > 0) {
    await Promise.all(
      deferredUpdates.map((row) =>
        supabase.from("nura_check_ins").update({ scheduled_for: row.scheduled_for }).eq("id", row.id).is("triggered_at", null),
      ),
    );
  }

  return { ready, deferred: deferredUpdates.length };
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

  // Resolve outcomes for calls placed on earlier ticks first (safety net for a missed webhook),
  // place any redial whose cooldown has elapsed, then sweep check-ins that never got completed
  // after every channel was exhausted - regardless of whether anything new is due right now.
  await resolveOutstandingCalls(supabase);
  const redialsPlaced = await placeDueRedials(supabase);
  const stale = await sweepStaleCheckIns(supabase).catch(() => ({ marked: 0, requeued: 0 }));

  const now = new Date();
  const nowIso = now.toISOString();

  // When Care-plan cadence has gone quiet (no open check-ins / no recent contact), invent a
  // gentle wellness check-in so Nura still reaches out — empty appointment calendar does not
  // block this. Inserted rows are due immediately and fall through the normal claim path below.
  const idle = await scheduleIdleWellnessCheckIns(supabase, now).catch(() => ({
    scheduled: [] as string[],
    skipped: 0,
  }));

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
    return NextResponse.json({
      ok: true,
      triggered: [],
      idleScheduled: idle.scheduled.length,
      idleSkipped: idle.skipped,
      redialsPlaced,
      staleMarked: stale.marked,
      staleRequeued: stale.requeued,
    });
  }

  // Never let a call ring or a WhatsApp text buzz during quiet hours - reschedule those instead
  // of firing them. in_app-only check-ins pass straight through.
  const { ready: readyCheckIns, deferred: quietDeferred } = await deferQuietHoursCheckIns(
    supabase,
    dueCheckIns as DueCheckIn[],
  );

  if (readyCheckIns.length === 0) {
    return NextResponse.json({
      ok: true,
      triggered: [],
      idleScheduled: idle.scheduled.length,
      idleSkipped: idle.skipped,
      redialsPlaced,
      staleMarked: stale.marked,
      staleRequeued: stale.requeued,
      quietDeferred,
    });
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
    .in("id", readyCheckIns.map((c) => c.id))
    .is("triggered_at", null)
    .select("id");

  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError.message }, { status: 500 });
  }

  const claimedIds = new Set((claimed ?? []).map((row) => row.id as string));
  const claimedCheckIns = readyCheckIns.filter((c) => claimedIds.has(c.id));
  if (claimedCheckIns.length === 0) {
    return NextResponse.json({
      ok: true,
      triggered: [],
      idleScheduled: idle.scheduled.length,
      idleSkipped: idle.skipped,
      redialsPlaced,
      staleMarked: stale.marked,
      staleRequeued: stale.requeued,
      quietDeferred,
    });
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
  const allowedChannelsByOwner = new Map<string, CheckinChannel[]>(
    (profiles ?? []).map((p) => [p.id, ((p.preferred_checkin_channels as CheckinChannel[] | null) ?? ["voice", "whatsapp", "in_app"])]),
  );

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
    const allowed = allowedChannelsByOwner.get(checkIn.owner_id) ?? (["voice", "whatsapp", "in_app"] as CheckinChannel[]);
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
    const displayName = (nameByOwner.get(primary.owner_id) ?? "").trim();
    const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
    const allowed = allowedChannelsByOwner.get(primary.owner_id) ?? ["voice", "whatsapp", "in_app"];
    const toNumber = toE164(phoneKey);
    const minutesOverdue = (now.getTime() - new Date(primary.scheduled_for).getTime()) / 60_000;

    if (backlog.length > 0) {
      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: nowIso, call_status: "missed_consolidated" })
        .in("id", backlog.map((c) => c.id));
      for (const c of backlog) {
        results.push({ checkInId: c.id, planTitle, status: "missed_consolidated" });
      }
    }

    // Too late for a cold call (dispatcher lag past 6h) — still reach the user by text/push.
    if (minutesOverdue > MAX_VOICE_LATENESS_MINUTES) {
      const opener = await composeCheckinOpener(
        firstName,
        planTitle,
        primary.prompt,
        primary.nura_plans?.category,
      );
      const phoneDigits = phoneKey;
      let status: string = "failed";
      let callError: string | null = `Voice check-in was ${Math.round(minutesOverdue)}m overdue; delivered by text instead.`;

      if (phoneDigits && allowed.includes("whatsapp")) {
        try {
          const outcome = await sendWhatsappText(phoneDigits, opener);
          if (outcome.skipped || outcome.error) throw new Error(outcome.error ?? "WhatsApp is not configured.");
          await insertOpenerMessage(supabase, primary.owner_id, primary.plan_id, opener);
          status = "sent_whatsapp";
          callError = `Skipped stale voice call (${Math.round(minutesOverdue)}m overdue); sent WhatsApp instead.`;
        } catch {
          // Fall through to push.
        }
      }

      if (status === "failed") {
        await insertOpenerMessage(supabase, primary.owner_id, primary.plan_id, opener);
        const pushResult = await sendPushToOwner(primary.owner_id, {
          title: "Nura",
          body: opener,
          url: `/workspace?planId=${primary.plan_id}`,
        }).catch(() => null);
        const delivered = Boolean(pushResult && pushResult.sent > 0);
        status = delivered ? "escalated_push" : "failed";
        callError = delivered
          ? `Skipped stale voice call (${Math.round(minutesOverdue)}m overdue); sent push instead.`
          : `Skipped stale voice call (${Math.round(minutesOverdue)}m overdue); no WhatsApp/push delivery.`;
      }

      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: nowIso, call_status: status, call_error: callError })
        .eq("id", primary.id);
      results.push({ checkInId: primary.id, planTitle, status, overdueMinutes: Math.round(minutesOverdue) });
      continue;
    }

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
          call_attempts: 1,
        })
        .eq("id", primary.id);

      // Parallel nudge so the user knows to pick up — and so there's still a signal if the
      // ring fails silently on the carrier side.
      void sendPushToOwner(primary.owner_id, {
        title: "Nura is calling",
        body: `Pick up — checking in about ${planTitle}.`,
        url: `/workspace?planId=${primary.plan_id}`,
      }).catch(() => null);

      results.push({ checkInId: primary.id, planTitle, toNumber, status: "placed", conversationId: call.conversation_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Outbound call failed.";
      const opener = await composeMissedCallFollowup(firstName, planTitle, primary.prompt);
      let status: string = "failed";
      let callError = message;

      if (allowed.includes("whatsapp")) {
        try {
          const outcome = await sendWhatsappText(phoneKey, opener);
          if (outcome.skipped || outcome.error) throw new Error(outcome.error ?? "WhatsApp is not configured.");
          await insertOpenerMessage(supabase, primary.owner_id, primary.plan_id, opener);
          status = "escalated_whatsapp";
          callError = `Call failed (${message}); sent WhatsApp instead.`;
        } catch {
          // Fall through to push.
        }
      }

      if (status === "failed") {
        await insertOpenerMessage(supabase, primary.owner_id, primary.plan_id, opener);
        const pushResult = await sendPushToOwner(primary.owner_id, {
          title: "Nura tried to call",
          body: opener,
          url: `/workspace?planId=${primary.plan_id}`,
        }).catch(() => null);
        const delivered = Boolean(pushResult && pushResult.sent > 0);
        status = delivered ? "escalated_push" : "failed";
        callError = delivered ? `Call failed (${message}); sent push instead.` : message;
      }

      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: nowIso, call_status: status, call_error: callError })
        .eq("id", primary.id);
      results.push({ checkInId: primary.id, planTitle, toNumber, status, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    triggered: results,
    idleScheduled: idle.scheduled.length,
    idleSkipped: idle.skipped,
    redialsPlaced,
    staleMarked: stale.marked,
    staleRequeued: stale.requeued,
    quietDeferred,
  });
}

/** Vercel Cron uses GET; agent/manual triggers use POST. */
export async function GET(request: NextRequest) {
  return runTriggerCheckIns(request);
}

export async function POST(request: NextRequest) {
  return runTriggerCheckIns(request);
}
