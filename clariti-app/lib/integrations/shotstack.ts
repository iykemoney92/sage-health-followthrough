/**
 * Shotstack stitches the five Veo scenes into one explainer. It is optional:
 * without it the pipeline renders a single presenter clip instead.
 *
 * The one thing this file exists to prevent is a key that is set but dead.
 * Enqueue used to treat "SHOTSTACK_API_KEY is non-empty" as "Shotstack works",
 * commit to the five-scene storyboard, pay for five Veo generations, and only
 * then learn at the stitch step that the key had been revoked — the most
 * expensive way to discover a config problem. So the key is checked with one
 * cheap authenticated request before the pipeline is chosen, and any doubt
 * falls back to the single clip, which spends a fifth as much and needs no
 * Shotstack at all.
 */

const PRODUCTION_BASE_URL = "https://api.shotstack.io/edit/v1";
const PROBE_TIMEOUT_MS = 3_000;
const VERDICT_TTL_MS = 10 * 60 * 1_000;

let cached: { usable: boolean; checkedAt: number } | null = null;

export function getShotstackApiKey() {
  return (process.env.SHOTSTACK_API_KEY ?? "").trim();
}

/**
 * Trimmed and without a trailing slash. An operator once pasted the value with
 * a newline on the end, and stripping only the slash left every request going
 * to ".../stage\n/render".
 */
export function getShotstackBaseUrl() {
  const configured = (process.env.SHOTSTACK_BASE_URL ?? "").trim();
  return (configured || PRODUCTION_BASE_URL).replace(/\/+$/, "");
}

/**
 * True only when a key is configured AND Shotstack accepts it. The verdict is
 * cached for a few minutes per instance, so a burst of enqueues costs one probe.
 * Anything short of a clear yes — no key, a 4xx, a timeout — is a no, because
 * the wrong answer here is paid for in Veo credits.
 */
export async function shotstackIsUsable() {
  const apiKey = getShotstackApiKey();
  if (!apiKey) return false;

  const now = Date.now();
  if (cached && now - cached.checkedAt < VERDICT_TTL_MS) return cached.usable;

  let usable = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(`${getShotstackBaseUrl()}/templates`, {
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    usable = response.ok;
    if (!usable) {
      console.warn(`[shotstack] key rejected (${response.status}); falling back to single-clip video`);
    }
  } catch (error) {
    console.warn("[shotstack] probe failed; falling back to single-clip video", error instanceof Error ? error.message : error);
  }

  cached = { usable, checkedAt: now };
  return usable;
}
