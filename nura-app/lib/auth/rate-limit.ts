import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

/** Simple process-local limiter for unauthenticated auth endpoints (email/IP keyed). */
const buckets = new Map<string, Bucket>();

export function checkKeyedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  buckets.set(key, existing);
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
  return { limited: existing.count > limit, retryAfterSeconds };
}

export function authRateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      ok: false,
      error: "Too many attempts. Wait a bit, then try again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) },
    },
  );
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
