import { NextResponse } from "next/server";

/**
 * Ceilings for the auth routes an unauthenticated caller can reach.
 *
 * lib/rate-limit.ts cannot cover these. Its RPC reads auth.uid() to decide whose
 * quota to spend and EXECUTE on it is revoked from anon, while everything gated
 * here runs before there is a session at all. The only identity available is the
 * connection the request arrived on and the address the caller typed.
 *
 * The budgets are sized against the abuse rather than the person: mistyping a
 * password a dozen times in five minutes is somebody with a bad memory, and
 * asking for a seventh confirmation email inside a quarter of an hour is not.
 *
 * `subjectLimit` is the ceiling for the counter kept on the address the caller
 * typed rather than on the connection, and it is deliberately much looser than
 * the per-connection one. Total mail volume is bounded by `limit`, which the
 * caller spends out of its own pocket; the subject counter only exists for the
 * distributed case, where every request comes from a different address. It is
 * spent by whoever names the address rather than by whoever owns it, so a tight
 * one is a lever for holding somebody else's budget shut, and a route without it
 * never spends one at all.
 */
export const ANON_RATE_LIMITS = {
  password: { limit: 20, windowSeconds: 300 },
  resendConfirmation: { limit: 6, windowSeconds: 900, subjectLimit: 30 },
  resetPassword: { limit: 6, windowSeconds: 900, subjectLimit: 30 },
} as const;

export type AnonRateLimitedRoute = keyof typeof ANON_RATE_LIMITS;

function subjectLimitFor(route: AnonRateLimitedRoute): number | null {
  const config = ANON_RATE_LIMITS[route] as { subjectLimit?: number };
  return config.subjectLimit ?? null;
}

type Bucket = { expiresAt: number; count: number; limit: number };

/**
 * The counters live in this process, not in a shared store.
 *
 * Vercel runs many instances, so a flood spread across all of them gets a fresh
 * budget on each, and a cold start starts over. Read this as a mitigation, not a
 * closed door: what it reliably stops is one caller looping as fast as it can,
 * whose requests pile onto the handful of instances already warm. A counter that
 * survives the spread needs a table keyed on (route, key, window_start) and a
 * service-role increment — a migration, and an async limiter with it.
 */
const buckets = new Map<string, Bucket>();

/** Enough headroom for real traffic; past it the quiet counters are evicted. */
const MAX_BUCKETS = 5000;

/**
 * Make room without handing the flood what it came for.
 *
 * Clearing the map used to be the fallback, which meant a caller cycling
 * one-shot keys past the cap could wipe every live counter — including the one
 * holding it back. Counters that are currently over their ceiling are the only
 * ones doing any work, so they are evicted last: expired entries go first, then
 * the quiet ones in insertion order.
 */
function evictToCapacity(now: number) {
  for (const [id, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(id);
  }
  if (buckets.size <= MAX_BUCKETS) return;

  for (const [id, bucket] of buckets) {
    if (bucket.count <= bucket.limit) buckets.delete(id);
    if (buckets.size <= MAX_BUCKETS) return;
  }

  for (const id of buckets.keys()) {
    buckets.delete(id);
    if (buckets.size <= MAX_BUCKETS) return;
  }
}

/**
 * The client address as the edge saw it.
 *
 * Only the leftmost x-forwarded-for entry is the real client, and only because
 * Vercel rewrites the header at the edge — anywhere a caller can reach the
 * runtime directly it is theirs to forge. A request that arrives without the
 * header shares one bucket rather than getting an unlimited one, so a missing
 * header costs throughput and never the ceiling.
 */
export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkAnonRateLimit(
  route: AnonRateLimitedRoute,
  key: string,
  now = Date.now(),
  limit: number = ANON_RATE_LIMITS[route].limit,
): { limited: boolean; retryAfterSeconds: number } {
  const { windowSeconds } = ANON_RATE_LIMITS[route];
  const windowMs = windowSeconds * 1000;
  const expiresAt = Math.floor(now / windowMs) * windowMs + windowMs;
  const id = `${route}:${key}`;

  const existing = buckets.get(id);
  const bucket = existing && existing.expiresAt === expiresAt ? existing : { expiresAt, count: 0, limit };
  bucket.count += 1;
  bucket.limit = limit;
  buckets.set(id, bucket);

  if (buckets.size > MAX_BUCKETS) evictToCapacity(now);

  return {
    limited: bucket.count > limit,
    retryAfterSeconds: Math.ceil((expiresAt - now) / 1000),
  };
}

export function anonRateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Too many attempts from this connection. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } },
  );
}

/**
 * The one call site pattern: gate, then do the work. Returns a response to
 * return early, or null to continue.
 *
 * `subject` gets its own counter alongside the IP — normally the address the
 * caller typed. Without it a botnet with one address per host could still mail
 * one person a hundred times; the IP counter never sees a second request.
 *
 * It is only ever passed on the routes that send mail, where the counter bounds
 * how much mail one inbox can be made to receive. It must not be passed on a
 * route that gates access to an account: the counter is spent by whoever names
 * the address, so on sign-in it would let a stranger who merely knows somebody's
 * email lock that person out of their own password. A route with no
 * `subjectLimit` refuses the subject counter outright rather than trusting the
 * call site to leave it off.
 */
export function enforceAnonRateLimit(
  request: Request,
  route: AnonRateLimitedRoute,
  subject?: string | null,
) {
  const subjectLimit = subjectLimitFor(route);
  const keys: { key: string; limit: number }[] = [
    { key: `ip:${clientIpFromRequest(request)}`, limit: ANON_RATE_LIMITS[route].limit },
  ];
  if (subject && subjectLimit !== null) keys.push({ key: `subject:${subject}`, limit: subjectLimit });

  let retryAfterSeconds = 0;
  for (const { key, limit } of keys) {
    const result = checkAnonRateLimit(route, key, Date.now(), limit);
    if (result.limited) retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
  }

  return retryAfterSeconds > 0 ? anonRateLimitedResponse(retryAfterSeconds) : null;
}
