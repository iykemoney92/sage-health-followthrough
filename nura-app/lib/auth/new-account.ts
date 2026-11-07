/** Made in the last few minutes: the provider sign-in that just finished created the account (app/auth/callback). */
export function isNewAccount(createdAt: string | undefined, now = Date.now()) {
  const at = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(at) && now - at >= 0 && now - at < 5 * 60_000;
}
