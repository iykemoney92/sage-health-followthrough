/**
 * ElevenLabs credit balance (22 Nov 2026). From ~20 Nov every Nura call failed with "agent not
 * available" because the account's monthly credits (10k on the free plan, shared with Pickuply
 * and Vangie) had run out, and nothing noticed. Before Nura places a call it now reads the
 * balance (GET /v1/user/subscription, cached a few minutes): under the floor for one call, the
 * check-in goes out as a text instead (see lib/domain/voice-availability.ts).
 *
 * Reading the balance needs the `user_read` permission. Nura's calling key (ELEVENLABS_API_KEY)
 * didn't have it on 22 Nov, so a separate read-only key can be set as ELEVENLABS_USAGE_API_KEY.
 * Without a readable balance the guard reports "unknown" and calls go ahead; a call that then
 * fails is caught by the failure handling instead.
 */

const SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";

/** Enough for one ordinary check-in call (~4-5 minutes; a 42 s call used 153 credits on 20 Nov). */
export const DEFAULT_CREDIT_FLOOR = 1_000;
/** Alert Ike when less than this share of the monthly allowance is left. */
export const DEFAULT_ALERT_FRACTION = 0.2;
/** How long a reading (or a failed read) is reused before asking ElevenLabs again. */
export const CREDIT_CACHE_MS = 3 * 60_000;

export type VoiceCredits = {
  used: number;
  limit: number;
  remaining: number;
  /** When the monthly allowance next resets (ISO), when ElevenLabs says. */
  resetsAt: string | null;
  tier: string | null;
};

export type CreditLevel = "ok" | "low" | "exhausted" | "unknown";

export type CreditReading = {
  level: CreditLevel;
  credits: VoiceCredits | null;
  /** Why the balance couldn't be read, when level is "unknown". */
  error: string | null;
  floor: number;
  alertFraction: number;
};

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function creditFloor() {
  return numberFromEnv("ELEVENLABS_CREDIT_FLOOR", DEFAULT_CREDIT_FLOOR);
}

export function creditAlertFraction() {
  const value = numberFromEnv("ELEVENLABS_CREDIT_ALERT_FRACTION", DEFAULT_ALERT_FRACTION);
  return value > 0 && value < 1 ? value : DEFAULT_ALERT_FRACTION;
}

/** Pure: how worried to be about this balance. */
export function assessCredits(
  credits: VoiceCredits | null,
  floor = creditFloor(),
  alertFraction = creditAlertFraction(),
): CreditLevel {
  if (!credits || !(credits.limit > 0)) return "unknown";
  if (credits.remaining < floor) return "exhausted";
  if (credits.remaining < credits.limit * alertFraction) return "low";
  return "ok";
}

type SubscriptionBody = {
  character_count?: number;
  character_limit?: number;
  next_character_count_reset_unix?: number | null;
  tier?: string | null;
  detail?: { message?: string; status?: string } | string;
};

/** Pure: the subscription payload as a balance, or null when it doesn't carry one. */
export function parseSubscription(body: SubscriptionBody | null): VoiceCredits | null {
  if (!body) return null;
  const used = Number(body.character_count);
  const limit = Number(body.character_limit);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  const reset = Number(body.next_character_count_reset_unix);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
    tier: body.tier ?? null,
  };
}

export async function fetchVoiceCredits(): Promise<{ credits: VoiceCredits | null; error: string | null }> {
  const apiKey = process.env.ELEVENLABS_USAGE_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { credits: null, error: "No ElevenLabs API key configured." };
  try {
    const response = await fetch(SUBSCRIPTION_URL, {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(4_000),
    });
    const body = (await response.json().catch(() => null)) as SubscriptionBody | null;
    if (!response.ok) {
      const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
      return { credits: null, error: `ElevenLabs subscription read failed (${response.status}${detail ? `: ${detail}` : ""}).` };
    }
    const credits = parseSubscription(body);
    return credits ? { credits, error: null } : { credits: null, error: "ElevenLabs subscription had no credit figures." };
  } catch (error) {
    return { credits: null, error: `ElevenLabs subscription read failed (${error instanceof Error ? error.name : "error"}).` };
  }
}

let cache: { at: number; value: { credits: VoiceCredits | null; error: string | null } } | null = null;

/** For tests. */
export function resetCreditCache() {
  cache = null;
}

/** The current balance and how worried to be, read at most once per CREDIT_CACHE_MS per server instance. */
export async function readVoiceCredits(
  now = Date.now(),
  fetcher: typeof fetchVoiceCredits = fetchVoiceCredits,
): Promise<CreditReading> {
  if (!cache || now - cache.at >= CREDIT_CACHE_MS) {
    cache = { at: now, value: await fetcher() };
  }
  const floor = creditFloor();
  const alertFraction = creditAlertFraction();
  const { credits, error } = cache.value;
  return { level: assessCredits(credits, floor, alertFraction), credits, error, floor, alertFraction };
}
