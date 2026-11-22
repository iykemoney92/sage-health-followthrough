import { logger } from "@/lib/logger";

/**
 * Ops alerts for Ike (22 Nov 2026). Nura has no internal alert channel (no Slack, no admin inbox
 * wired into the app), and nothing may be emailed or texted to users for this, so an alert is:
 *   1. an error line in the Vercel logs (`ops_alert`), and
 *   2. a `nura_ops_alert` event in PostHog (EU project "Zapx Products", product = nura), which a
 *      PostHog alert or the Product Pulse dashboard can watch.
 * Only operational numbers go out (credits, error text, check-in ids) - never names, phone
 * numbers or anything a person said.
 *
 * Production only (VERCEL_ENV=production), like the AI tracing; OPS_ALERTS=off stops the PostHog
 * send and OPS_ALERTS=on turns it on elsewhere. Each kind is sent at most once per window per
 * server instance, so a run of failures doesn't flood PostHog.
 *
 * The log line is written every time, except for kinds in LOG_WINDOW_MINUTES: those are standing
 * conditions re-detected on every dispatcher tick (~1/min), so they log at most once per window
 * per instance, with a count of the repeats held back. Real failures (a refused call) always log.
 */

const HOST = "https://eu.i.posthog.com/i/v0/e/";
/** Same public, send-only project token the browser and lib/ai/trace.ts use. */
const POSTHOG_KEY = "phc_ALci32bGNJvd8BfF7V3RVvW3QxXHF8JeXbwpDgEp28xB";
export const OPS_ALERT_EVENT = "nura_ops_alert";

export type OpsAlertKind =
  /** Credits are under the alert share (~20%) of the monthly allowance. */
  | "voice_credits_low"
  /** Credits are under the floor for one call: calls are being replaced by texts. */
  | "voice_credits_exhausted"
  /** ElevenLabs refused a call (quota / agent not available / start error). */
  | "voice_call_failed"
  /** The credit balance can't be read (e.g. the API key lacks user_read), so the guard can't see it coming. */
  | "voice_credit_check_unavailable";

const WINDOW_MINUTES: Record<OpsAlertKind, number> = {
  voice_credits_low: 6 * 60,
  voice_credits_exhausted: 60,
  voice_call_failed: 30,
  voice_credit_check_unavailable: 24 * 60,
};

/**
 * Kinds whose log line is throttled. "Credit check unavailable" is true on every tick until the
 * ElevenLabs key gets user_read, so unthrottled it wrote an error line a minute (22 Nov 2026).
 */
const LOG_WINDOW_MINUTES: Partial<Record<OpsAlertKind, number>> = {
  voice_credit_check_unavailable: 60,
};

const lastSent = new Map<OpsAlertKind, number>();
const lastLogged = new Map<OpsAlertKind, { at: number; suppressed: number }>();

export function opsAlertsEnabled() {
  const flag = process.env.OPS_ALERTS?.trim().toLowerCase();
  if (flag === "off") return false;
  return flag === "on" || process.env.VERCEL_ENV === "production";
}

/** For tests. */
export function resetOpsAlertState() {
  lastSent.clear();
  lastLogged.clear();
}

/** Writes the ops_alert log line, unless this kind is throttled and logged inside its window. */
function logOpsAlert(kind: OpsAlertKind, props: Record<string, unknown>, now: Date) {
  const windowMinutes = LOG_WINDOW_MINUTES[kind];
  if (windowMinutes === undefined) {
    logger.error("ops_alert", { kind, ...props });
    return;
  }
  const last = lastLogged.get(kind);
  if (last && now.getTime() - last.at < windowMinutes * 60_000) {
    last.suppressed += 1;
    return;
  }
  logger.error("ops_alert", {
    kind,
    ...props,
    ...(last && last.suppressed > 0 ? { repeats_not_logged: last.suppressed } : {}),
  });
  lastLogged.set(kind, { at: now.getTime(), suppressed: 0 });
}

export function opsAlertEvent(kind: OpsAlertKind, props: Record<string, unknown>, now = new Date()) {
  return {
    api_key: POSTHOG_KEY,
    event: OPS_ALERT_EVENT,
    distinct_id: "nura-ops",
    timestamp: now.toISOString(),
    properties: {
      product: "nura",
      alert_kind: kind,
      $process_person_profile: false,
      ...props,
    },
  };
}

/**
 * Raises an ops alert. Never throws and never takes more than ~4 s. Returns true when it was sent
 * to PostHog (false when deduped, disabled or the send failed - the log line is written anyway).
 */
export async function opsAlert(kind: OpsAlertKind, props: Record<string, unknown> = {}, now = new Date()): Promise<boolean> {
  logOpsAlert(kind, props, now);

  const last = lastSent.get(kind);
  if (last !== undefined && now.getTime() - last < WINDOW_MINUTES[kind] * 60_000) return false;
  if (!opsAlertsEnabled()) return false;
  lastSent.set(kind, now.getTime());

  try {
    const res = await fetch(HOST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opsAlertEvent(kind, props, now)),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      logger.warn("ops_alert.send_failed", { kind, status: res.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("ops_alert.send_failed", { kind, message: error instanceof Error ? error.name : "error" });
    return false;
  }
}
