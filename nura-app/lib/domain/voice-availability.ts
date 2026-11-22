import type { SupabaseClient } from "@supabase/supabase-js";
import { readVoiceCredits, type CreditReading } from "@/lib/integrations/elevenlabs-credits";
import { opsAlert } from "@/lib/ops-alert";

/**
 * Can Nura place a voice call right now? (22 Nov 2026)
 *
 * Two signals, checked before every outbound call and redial:
 *   1. the ElevenLabs credit balance (lib/integrations/elevenlabs-credits.ts) - under the floor for
 *      one call means no call;
 *   2. a breaker: a call that ElevenLabs refused account-wide (credits, "agent not available")
 *      in the last VOICE_BREAKER_MINUTES means the next one would fail the same way, so don't try.
 *      This works even when the balance can't be read.
 * When voice is off, the check-in goes out as a text on the person's usual channel instead, and
 * the row's call_error starts with VOICE_UNAVAILABLE so the reason is on record (and so the
 * breaker can find it). Ike is alerted through lib/ops-alert.ts.
 */

/** Prefix on nura_check_ins.call_error whenever voice was unavailable account-wide. */
export const VOICE_UNAVAILABLE = "Voice unavailable";
export const VOICE_BREAKER_MINUTES = 30;

export function voiceUnavailableNote(detail: string) {
  return `${VOICE_UNAVAILABLE} (${detail})`;
}

/**
 * call_error when the guard chose not to place a call (credits low, or the breaker is open). It
 * deliberately doesn't start with VOICE_UNAVAILABLE: only real failures may hold the breaker
 * open, otherwise one failure would keep voice off for ever.
 */
export function voiceSkippedNote(reason: string) {
  return `Call not placed (${reason})`;
}

export function isVoiceUnavailableNote(callError: string | null | undefined) {
  return Boolean(callError && callError.startsWith(VOICE_UNAVAILABLE));
}

export type VoiceGate = { allowed: true; reading: CreditReading } | { allowed: false; reason: string; reading: CreditReading };

function describeCredits(reading: CreditReading) {
  const c = reading.credits;
  return c ? `${c.remaining} of ${c.limit} ElevenLabs credits left` : "ElevenLabs credits unknown";
}

/** Pure: the decision, given the balance and the most recent account-wide failure (if any). */
export function decideVoiceGate(reading: CreditReading, recentFailure: string | null): VoiceGate {
  if (reading.level === "exhausted") {
    return { allowed: false, reason: `${describeCredits(reading)}, under the ${reading.floor} needed for a call`, reading };
  }
  if (recentFailure) {
    return { allowed: false, reason: `a call failed in the last ${VOICE_BREAKER_MINUTES} min: ${recentFailure.slice(0, 160)}`, reading };
  }
  return { allowed: true, reading };
}

/** The newest account-wide voice failure recorded in the breaker window, or null. */
export async function recentVoiceFailure(supabase: SupabaseClient, now = new Date()): Promise<string | null> {
  try {
    const since = new Date(now.getTime() - VOICE_BREAKER_MINUTES * 60_000).toISOString();
    const { data } = await supabase
      .from("nura_check_ins")
      .select("call_error, triggered_at")
      .like("call_error", `${VOICE_UNAVAILABLE}%`)
      .gte("triggered_at", since)
      .order("triggered_at", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as { call_error?: string | null } | undefined;
    return row?.call_error ?? null;
  } catch {
    return null;
  }
}

/** Alerts for the balance itself: low, exhausted, or unreadable. Never throws. */
export async function alertOnCredits(reading: CreditReading) {
  const c = reading.credits;
  const props = c
    ? { credits_remaining: c.remaining, credits_limit: c.limit, credits_used: c.used, resets_at: c.resetsAt, tier: c.tier, floor: reading.floor }
    : { error: reading.error };
  try {
    if (reading.level === "exhausted") await opsAlert("voice_credits_exhausted", props);
    else if (reading.level === "low") await opsAlert("voice_credits_low", { ...props, alert_fraction: reading.alertFraction });
    else if (reading.level === "unknown") await opsAlert("voice_credit_check_unavailable", props);
  } catch {
    // Alerts never block a check-in.
  }
}

/** Reads the balance (cached), raises any credit alert, and decides whether a call may be placed. */
export async function checkVoiceGate(supabase: SupabaseClient, now = new Date()): Promise<VoiceGate> {
  const reading = await readVoiceCredits(now.getTime());
  await alertOnCredits(reading);
  const gate = decideVoiceGate(reading, reading.level === "exhausted" ? null : await recentVoiceFailure(supabase, now));
  return gate;
}

/** A call failed for a reason on our side. Alerts Ike; never throws. */
export async function alertVoiceCallFailed(props: {
  stage: "start" | "outcome" | "initiation_webhook";
  reason: string;
  accountWide: boolean;
  checkInId?: string | null;
  code?: number | null;
}) {
  try {
    await opsAlert("voice_call_failed", {
      stage: props.stage,
      reason: props.reason.slice(0, 300),
      account_wide: props.accountWide,
      quota_likely: props.accountWide,
      check_in_id: props.checkInId ?? null,
      error_code: props.code ?? null,
    });
  } catch {
    // never blocks
  }
}
