/**
 * Notes what a provider handed back with a session, and never the tokens.
 *
 * Sign in with Apple obliges an app to revoke its Apple token when someone
 * deletes their account, and revocation needs `provider_refresh_token`. Nobody
 * has ever seen whether Supabase returns one for Apple, because every place a
 * session arrives — this route and the native deep-link handler — sets the
 * cookie and drops the object on the floor. Guessing either way builds the wrong
 * thing, so this records the shape of what actually arrives and waits for a real
 * Apple sign-in to answer the question.
 *
 * The tokens themselves are deliberately absent from the record: a provider
 * refresh token in a log line is a credential in a log line.
 */

export type ProviderTokenPresence = {
  provider: string;
  hasProviderToken: boolean;
  hasProviderRefreshToken: boolean;
};

type SessionShape = {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
  user?: { app_metadata?: { provider?: string | null } | null } | null;
} | null;

export function providerTokenPresence(session: SessionShape): ProviderTokenPresence | null {
  if (!session) return null;

  const provider = session.user?.app_metadata?.provider ?? "unknown";
  // An email/password sign-in has no provider tokens by definition; logging one
  // line per sign-in for that would bury the handful of Apple ones.
  if (provider === "email") return null;

  return {
    provider,
    hasProviderToken: Boolean(session.provider_token),
    hasProviderRefreshToken: Boolean(session.provider_refresh_token),
  };
}

export function recordProviderTokenPresence(session: SessionShape) {
  const presence = providerTokenPresence(session);
  if (!presence) return;
  console.info("[auth/provider-tokens]", JSON.stringify(presence));
}
