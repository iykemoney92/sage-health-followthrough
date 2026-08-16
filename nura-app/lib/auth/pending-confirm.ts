import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Binds "this browser started a signup" to the pending account, so the
 * confirmation poll can sign the user in without their password.
 *
 * The poll mints a session server-side, so possessing the cookie is equivalent
 * to being that user once they confirm. That makes the binding the security
 * boundary: the cookie carries a 32-byte random token that only ever exists in
 * the signing-up browser's httpOnly cookie, and only its SHA-256 is stored on
 * the account. Knowing an email is not enough — without the raw token the poll
 * refuses, so this can't be used to sign in as someone else.
 */

export const PENDING_CONFIRM_COOKIE = "nura_pending_confirm";
/** Long enough to read an email and come back; short enough to limit exposure. */
export const PENDING_CONFIRM_TTL_SECONDS = 60 * 60;

export const CONFIRM_POLL_HASH_KEY = "confirm_poll_hash";
export const CONFIRM_POLL_EXP_KEY = "confirm_poll_exp";

export function hashConfirmToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPendingConfirmToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashConfirmToken(token) };
}

export function encodePendingConfirmCookie(email: string, token: string) {
  return Buffer.from(JSON.stringify({ email, token }), "utf8").toString("base64url");
}

export function decodePendingConfirmCookie(raw: string | undefined): { email: string; token: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed?.email !== "string" || typeof parsed?.token !== "string") return null;
    if (!parsed.email || !parsed.token) return null;
    return { email: parsed.email, token: parsed.token };
  } catch {
    return null;
  }
}

/** Constant-time compare so a wrong token can't be recovered by timing the poll. */
export function confirmTokenMatches(token: string, storedHash: unknown) {
  if (typeof storedHash !== "string" || storedHash.length === 0) return false;
  const candidate = Buffer.from(hashConfirmToken(token), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function pendingConfirmExpired(exp: unknown) {
  const value = typeof exp === "number" ? exp : Number(exp);
  if (!Number.isFinite(value)) return true;
  return value < Date.now();
}

export function pendingConfirmCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_CONFIRM_TTL_SECONDS,
  };
}
