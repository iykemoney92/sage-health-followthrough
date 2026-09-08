import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Per-user ceilings on the routes that cost provider money per call.
 *
 * These are deliberately generous — nobody using Clariti normally will meet one.
 * They exist so a stolen session, a runaway client retry loop, or someone
 * scripting the API cannot run up an unbounded Anthropic/Shotstack bill before
 * anyone notices.
 *
 * Video generation is the exception to "generous". One explainer is five Veo
 * renders plus a Shotstack stitch — roughly the cost of a month of Plus — so it
 * gets a tight hourly ceiling and a daily one on top, because an hourly window
 * alone still permits two dozen renders overnight.
 *
 * Queuing and claiming get separate windows because they are separate requests,
 * usually in separate windows. Counting both against one budget only adds up for
 * a client that claims what it queues: an attacker banks queued jobs in one hour
 * — free, no provider is called — and claims them all in the next, so the half
 * that spends the money gets the whole budget to itself. `videos`/`videosDaily`
 * therefore count claims only and are the real ceiling on spend: three
 * explainers an hour, ten a day. The queue windows match them so an honest
 * client is turned away before its job exists rather than after.
 */
export const RATE_LIMITS = {
  extract: { limit: 30, windowSeconds: 3600 },
  analyze: { limit: 60, windowSeconds: 3600 },
  compare: { limit: 30, windowSeconds: 3600 },
  illustrations: { limit: 40, windowSeconds: 3600 },
  videos: { limit: 3, windowSeconds: 3600 },
  videosDaily: { limit: 10, windowSeconds: 86_400 },
  videosQueue: { limit: 3, windowSeconds: 3600 },
  videosQueueDaily: { limit: 10, windowSeconds: 86_400 },
  calls: { limit: 10, windowSeconds: 3600 },
  messages: { limit: 120, windowSeconds: 3600 },
} as const;

export type RateLimitedRoute = keyof typeof RATE_LIMITS;

/**
 * Routes where a check that could not run must block rather than wave the
 * request through.
 *
 * The asymmetry is the point. For the cheap routes a missing migration or a
 * transient RPC error should cost the ceiling, not the request: bookkeeping
 * being down is no reason to lock someone out of reading their own documents.
 * Video generation is the other way round — a spend check that did not run has
 * authorised nothing, and every call past it is real money — so it fails closed.
 * The queue windows fail closed with it: a job queued while the limiter is down
 * is a job that cannot be claimed, so letting it through only buys the user a
 * row that sits at "queued" until it goes stale.
 */
const FAIL_CLOSED: ReadonlySet<RateLimitedRoute> = new Set<RateLimitedRoute>([
  "videos",
  "videosDaily",
  "videosQueue",
  "videosQueueDaily",
]);

/** How long to hold someone off when the limiter itself is unavailable. */
const UNAVAILABLE_RETRY_SECONDS = 60;

export async function checkRateLimit(
  supabase: SupabaseClient,
  route: RateLimitedRoute,
): Promise<{ limited: boolean; retryAfterSeconds: number; unavailable: boolean }> {
  const { limit, windowSeconds } = RATE_LIMITS[route];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  // No owner is passed: the function reads auth.uid() itself, so a caller cannot
  // name somebody else and burn through their quota. That also means `supabase`
  // must be the session-scoped client, never the service role — the service role
  // has no auth.uid() and the function refuses it.
  const { data: count, error } = await supabase.rpc("clariti_increment_rate_limit", {
    p_route: route,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    console.error("[rate-limit] increment failed:", error.message);
    return FAIL_CLOSED.has(route)
      ? { limited: true, retryAfterSeconds: UNAVAILABLE_RETRY_SECONDS, unavailable: true }
      : { limited: false, retryAfterSeconds: 0, unavailable: true };
  }

  return {
    limited: (count as number) > limit,
    retryAfterSeconds: Math.ceil((windowStart.getTime() + windowMs - now) / 1000),
    unavailable: false,
  };
}

export function rateLimitedResponse(retryAfterSeconds: number, unavailable = false) {
  return NextResponse.json(
    {
      ok: false,
      error: unavailable
        ? "Clariti could not check your usage limit just now. Try again in a minute."
        : "You have made a lot of requests in a short time. Try again shortly.",
    },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } },
  );
}

/**
 * The one call site pattern: resolve the user, then gate. Returns a response to
 * return early, or null to continue. Pass more than one route to charge a
 * request against several windows at once — put the tightest first, so the
 * message names the window the caller will actually be waiting on.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  ...routes: [RateLimitedRoute, ...RateLimitedRoute[]]
) {
  for (const route of routes) {
    const { limited, retryAfterSeconds, unavailable } = await checkRateLimit(supabase, route);
    if (limited) return rateLimitedResponse(retryAfterSeconds, unavailable);
  }
  return null;
}
