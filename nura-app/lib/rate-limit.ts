import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function checkRateLimit(
  supabase: SupabaseClient,
  ownerId: string,
  route: string,
  limit: number,
  windowSeconds: number,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const { data: count, error } = await supabase.rpc("nura_increment_rate_limit", {
    p_owner_id: ownerId,
    p_route: route,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    // Never let rate-limit bookkeeping itself take the app down.
    console.error("[rate-limit] increment failed:", error.message);
    return { limited: false, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
  return { limited: (count as number) > limit, retryAfterSeconds };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } },
  );
}
