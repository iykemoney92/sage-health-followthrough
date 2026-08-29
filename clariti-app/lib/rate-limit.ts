import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Per-user ceilings on the routes that cost provider money per call.
 *
 * These are deliberately generous — nobody using Clariti normally will meet one.
 * They exist so a stolen session, a runaway client retry loop, or someone
 * scripting the API cannot run up an unbounded Anthropic/Shotstack bill before
 * anyone notices.
 */
export const RATE_LIMITS = {
  extract: { limit: 30, windowSeconds: 3600 },
  analyze: { limit: 60, windowSeconds: 3600 },
  compare: { limit: 30, windowSeconds: 3600 },
  illustrations: { limit: 40, windowSeconds: 3600 },
  videos: { limit: 10, windowSeconds: 3600 },
  calls: { limit: 10, windowSeconds: 3600 },
  messages: { limit: 120, windowSeconds: 3600 },
} as const;

export type RateLimitedRoute = keyof typeof RATE_LIMITS;

export async function checkRateLimit(
  supabase: SupabaseClient,
  ownerId: string,
  route: RateLimitedRoute,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const { limit, windowSeconds } = RATE_LIMITS[route];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const { data: count, error } = await supabase.rpc("clariti_increment_rate_limit", {
    p_owner_id: ownerId,
    p_route: route,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    // Never let rate-limit bookkeeping itself take the app down. A missing
    // function (migration not yet applied) or a transient error should cost the
    // ceiling, not the request.
    console.error("[rate-limit] increment failed:", error.message);
    return { limited: false, retryAfterSeconds: 0 };
  }

  return {
    limited: (count as number) > limit,
    retryAfterSeconds: Math.ceil((windowStart.getTime() + windowMs - now) / 1000),
  };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "You have made a lot of requests in a short time. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } },
  );
}

/**
 * The one call site pattern: resolve the user, then gate. Returns a response to
 * return early, or null to continue.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  ownerId: string,
  route: RateLimitedRoute,
) {
  const { limited, retryAfterSeconds } = await checkRateLimit(supabase, ownerId, route);
  return limited ? rateLimitedResponse(retryAfterSeconds) : null;
}
