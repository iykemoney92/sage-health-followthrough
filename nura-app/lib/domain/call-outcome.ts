import type { SupabaseClient } from "@supabase/supabase-js";
import { placeOutboundCall, type ConversationOutcome } from "@/lib/integrations/elevenlabs";
import { sendWhatsappText } from "@/lib/integrations/whatsapp";
import { sendPushToOwner } from "@/lib/integrations/push";
import { composeMissedCallFollowup } from "@/lib/domain/message-intake";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";

/** A placed call needs at least this long to ring out / go to voicemail / connect before its
 *  outcome is worth checking - checking too early would just see "initiated" every time. */
export const CALL_OUTCOME_CHECK_DELAY_SECONDS = 45;
/** If a call's outcome still hasn't resolved to a terminal state after this long, stop waiting
 *  on it and treat it as not-connected rather than leaving the check-in stuck as "placed" forever.
 *  This is now only a safety net for a missed webhook delivery - the webhook resolves most calls
 *  within seconds of the conversation ending. */
export const CALL_OUTCOME_TIMEOUT_MINUTES = 6;
/** Cooldown before Nura rings back after a disconnected/unanswered call - long enough that it
 *  isn't instantly re-ringing a phone that just hung up, short enough to still feel prompt. */
export const REDIAL_COOLDOWN_MINUTES = 3;
/** First attempt + one redial, then fall back to WhatsApp/push. */
export const MAX_VOICE_ATTEMPTS = 2;

export type CallOutcomeDecision =
  | { kind: "connected" }
  | { kind: "pending" }
  | { kind: "not_connected"; reason: string };

/**
 * Pure decision: given what ElevenLabs reports for a conversation (or nothing, if the lookup
 * itself failed) and whether the outcome-resolution timeout has elapsed, decide whether the call
 * actually connected, is still pending, or should be treated as not-connected.
 *
 * A call only counts as "connected" when it's not an explicit failure, ran a meaningful length,
 * and actually produced a transcript - a call that rings to voicemail or is declined tends to be
 * a few seconds with no transcript, even though the provider still reports it as "done".
 */
export function decideCallOutcome(outcome: ConversationOutcome | null, isStuck: boolean): CallOutcomeDecision {
  if (!outcome) {
    return isStuck ? { kind: "not_connected", reason: "Could not confirm the call's outcome." } : { kind: "pending" };
  }

  if (outcome.status === "initiated" || outcome.status === "in-progress") {
    return isStuck ? { kind: "not_connected", reason: "The call never connected." } : { kind: "pending" };
  }
  if (outcome.status === "processing") {
    return isStuck
      ? { kind: "not_connected", reason: "Call ended but the outcome never finished processing." }
      : { kind: "pending" };
  }

  const wentThrough =
    outcome.status === "done" && outcome.callSuccessful !== "failure" && outcome.durationSecs >= 8 && outcome.hasTranscript;
  if (wentThrough) return { kind: "connected" };

  return {
    kind: "not_connected",
    reason: outcome.status === "failed" ? "The call failed to connect." : "The call wasn't answered.",
  };
}

export type ResolvableCheckIn = {
  id: string;
  owner_id: string;
  plan_id: string;
  prompt: string;
  contact_phone: string | null;
  call_conversation_id?: string | null;
  triggered_at: string;
  call_attempts: number | null;
  nura_plans?: { title?: string | null } | null;
};

async function insertOpenerMessage(supabase: SupabaseClient, ownerId: string, planId: string, content: string) {
  try {
    await supabase.from("nura_messages").insert({ owner_id: ownerId, plan_id: planId, role: "assistant", content });
  } catch {
    // Non-blocking - delivery already happened (or was attempted) on the outbound channel.
  }
}

async function loadOwnerContext(supabase: SupabaseClient, ownerId: string) {
  const [{ data: link }, { data: profile }] = await Promise.all([
    supabase
      .from("nura_channel_links")
      .select("channel_identifier")
      .eq("owner_id", ownerId)
      .eq("provider", "whatsapp")
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("nura_profiles").select("display_name, phone, preferred_checkin_channels").eq("id", ownerId).maybeSingle(),
  ]);

  const allowed = (profile?.preferred_checkin_channels as string[] | null) ?? ["voice", "whatsapp", "in_app"];
  const displayName = ((profile?.display_name as string | null) ?? "").trim();
  const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
  const phone = (link?.channel_identifier as string | null) || (profile?.phone as string | null) || null;
  return { allowed, firstName, phone };
}

/** One-shot WhatsApp -> push escalation, reached once voice attempts are exhausted. */
async function escalateCheckIn(supabase: SupabaseClient, checkIn: ResolvableCheckIn, note: string) {
  const { allowed, firstName, phone: fallbackPhone } = await loadOwnerContext(supabase, checkIn.owner_id);
  const phone = checkIn.contact_phone || fallbackPhone;
  const planTitle = checkIn.nura_plans?.title ?? "your Care plan";
  const message = await composeMissedCallFollowup(firstName, planTitle, checkIn.prompt);

  if (phone && allowed.includes("whatsapp")) {
    try {
      const outcome = await sendWhatsappText(phone.replace(/[^\d]/g, ""), message);
      if (outcome.skipped || outcome.error) throw new Error(outcome.error ?? "WhatsApp is not configured.");
      await insertOpenerMessage(supabase, checkIn.owner_id, checkIn.plan_id, message);
      await supabase.from("nura_check_ins").update({ call_status: "escalated_whatsapp" }).eq("id", checkIn.id);
      return;
    } catch {
      // Fall through to a push notification below.
    }
  }

  await insertOpenerMessage(supabase, checkIn.owner_id, checkIn.plan_id, message);
  const pushResult = await sendPushToOwner(checkIn.owner_id, {
    title: "Nura tried to call",
    body: message,
    url: `/workspace?planId=${checkIn.plan_id}`,
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
    .eq("id", checkIn.id);
}

/** Places the redial itself - same call shape as the original outbound dial. */
async function redialCheckIn(supabase: SupabaseClient, checkIn: ResolvableCheckIn, attempts: number) {
  const phone = checkIn.contact_phone;
  if (!phone) {
    await escalateCheckIn(supabase, checkIn, "No phone number on file for redial.");
    return;
  }

  const { firstName } = await loadOwnerContext(supabase, checkIn.owner_id);

  try {
    const context = await buildVoiceCheckinContext(supabase, checkIn.owner_id, checkIn.plan_id, firstName);
    const dynamicVariables = {
      ...(context?.dynamicVariables ?? {
        user_name: firstName,
        user_id: checkIn.owner_id,
        plan_id: checkIn.plan_id,
        thread_title: checkIn.nura_plans?.title ?? "your Care plan",
        thread_context: "",
        checkin_goal: checkIn.prompt,
      }),
      checkin_goal: checkIn.prompt || context?.dynamicVariables.checkin_goal || "",
    };
    const digits = phone.replace(/[^\d]/g, "");
    const toNumber = phone.startsWith("+") ? phone : `+${digits}`;
    const call = await placeOutboundCall({ toNumber, dynamicVariables, agentId: context?.elevenLabsAgentId });

    await supabase
      .from("nura_check_ins")
      .update({
        call_status: "placed",
        call_conversation_id: call.conversation_id ?? null,
        call_attempts: attempts,
        triggered_at: new Date().toISOString(),
        redial_at: null,
      })
      .eq("id", checkIn.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Redial failed.";
    await escalateCheckIn(supabase, checkIn, `Redial failed (${message}).`);
  }
}

export type CallResolution = "pending" | "completed" | "redial_pending" | "escalated";

/**
 * Central place both the ElevenLabs post-call webhook and the polling fallback route a resolved
 * (or timed-out) call through - decides connected / redial / escalate and performs the DB writes
 * and any follow-up send. Pass isStuck=true only once the poll-timeout has actually elapsed so an
 * in-progress call is never escalated early.
 */
export async function resolveCallForCheckIn(
  supabase: SupabaseClient,
  checkIn: ResolvableCheckIn,
  outcome: ConversationOutcome | null,
  isStuck: boolean,
): Promise<CallResolution> {
  const decision = decideCallOutcome(outcome, isStuck);
  if (decision.kind === "pending") return "pending";

  if (decision.kind === "connected") {
    await supabase.from("nura_check_ins").update({ call_status: "completed" }).eq("id", checkIn.id);
    return "completed";
  }

  const attempts = checkIn.call_attempts ?? 1;
  if (attempts < MAX_VOICE_ATTEMPTS) {
    await supabase
      .from("nura_check_ins")
      .update({
        call_status: "redial_pending",
        redial_at: new Date(Date.now() + REDIAL_COOLDOWN_MINUTES * 60_000).toISOString(),
        call_error: decision.reason,
      })
      .eq("id", checkIn.id);
    return "redial_pending";
  }

  await escalateCheckIn(supabase, checkIn, decision.reason);
  return "escalated";
}

/** Dispatch-tick sweep: places the redial for rows whose cooldown has elapsed. */
export async function placeDueRedials(supabase: SupabaseClient): Promise<number> {
  const { data: rows } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, contact_phone, triggered_at, call_attempts, nura_plans(title)")
    .eq("call_status", "redial_pending")
    .lte("redial_at", new Date().toISOString())
    .limit(40);

  const redials = (rows ?? []) as ResolvableCheckIn[];
  if (redials.length === 0) return 0;

  await Promise.all(redials.map((row) => redialCheckIn(supabase, row, (row.call_attempts ?? 1) + 1)));
  return redials.length;
}
