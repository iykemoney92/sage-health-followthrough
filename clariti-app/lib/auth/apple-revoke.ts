import { createPrivateKey, sign as signEs256 } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";

/**
 * Sign in with Apple token revocation.
 *
 * Guideline 5.1.1(v) obliges an app that offers Sign in with Apple to call
 * Apple's revoke endpoint when someone deletes their account. Clariti deleted
 * everything it held and left the token live, so the app kept its entry under
 * Apple ID → Sign in with Apple with nothing behind it. App id 6806667378 has
 * been cited twice this month; this is the avoidable third.
 *
 * Server-only. It reads the signing key and the stored refresh tokens, neither
 * of which may reach a client bundle, so nothing under "use client" may import
 * it — the native shell posts to /auth/callback instead.
 */

const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUDIENCE = "https://appleid.apple.com";

/**
 * The Services ID Supabase's Apple provider is configured with. Apple checks
 * client_id against the client the token was issued to, so the iOS bundle id is
 * the wrong value even for a revoke that started in the app: both surfaces sign
 * in through Supabase's web flow (lib/auth/oauth.ts), never the native sheet.
 * Overridable because the matching value lives in the Supabase dashboard, where
 * code cannot see it.
 */
const APPLE_SERVICES_ID = "app.useclariti.web";

/** Apple allows up to six months. One request needs minutes. */
const CLIENT_SECRET_TTL_SECONDS = 300;
const REVOKE_TIMEOUT_MS = 5000;

type AppMetadata = { provider?: string | null; providers?: string[] | null } | null | undefined;

type ProviderSession = {
  provider_refresh_token?: string | null;
  user?: { app_metadata?: AppMetadata } | null;
} | null | undefined;

/**
 * Apple is `provider` on an account that started there, and only turns up in
 * `providers` on one that linked it to an existing email sign-in later.
 */
export function isAppleAccount(appMetadata: AppMetadata) {
  if (!appMetadata) return false;
  return appMetadata.provider === "apple" || (appMetadata.providers ?? []).includes("apple");
}

export function appleRefreshTokenFromSession(session: ProviderSession) {
  if (!session || !isAppleAccount(session.user?.app_metadata)) return null;
  const token = session.provider_refresh_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * Puts the token somewhere only the service role can reach it.
 *
 * Never fatal, and never upgraded to one: a sign-in that completes is worth
 * more than a revoke that may never be needed.
 */
export async function storeAppleRefreshToken(userId: string, refreshToken: string) {
  // Nothing can spend this token until the signing key is configured, and a live
  // credential the product has no use for is only liability: keep none until the
  // operator has actually set revocation up.
  if (!appleRevokeConfigured()) return false;

  if (!hasSupabaseServiceRole()) {
    console.error("[auth/apple-revoke] no service role key; Apple refresh token not stored");
    return false;
  }

  // Upsert rather than update: on a first Apple sign-in the profile row does not
  // exist yet — ensureClaritiProfile writes it on the /api/auth/status call that
  // comes after this one.
  const { error } = await getSupabaseAdminClient()
    .from("clariti_profiles")
    .upsert({ id: userId, apple_refresh_token: refreshToken }, { onConflict: "id" });

  if (error) {
    console.error(`[auth/apple-revoke] could not store the Apple refresh token: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Asked on its own rather than folded into the profile select beside it: a
 * database that predates the column fails the whole query, and taking the
 * RevenueCat ids down with it would leave the billing ledger behind on a
 * deletion that reported success.
 */
export async function readAppleRefreshToken(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("clariti_profiles")
    .select("apple_refresh_token")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (!/does not exist|schema cache/i.test(error.message)) {
      console.error(`[auth/apple-revoke] could not read the stored token: ${error.message}`);
    }
    return null;
  }

  const token = data?.apple_refresh_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function base64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function appleSigningConfig() {
  return {
    teamId: (process.env.CLARITI_APPLE_TEAM_ID ?? "").trim(),
    keyId: (process.env.CLARITI_APPLE_KEY_ID ?? "").trim(),
    // A .p8 pasted into the Vercel dashboard keeps its newlines; the same key in a
    // shell or a .env line arrives with them escaped. Both spellings have to sign.
    privateKey: (process.env.CLARITI_APPLE_PRIVATE_KEY ?? "").trim().replace(/\\n/g, "\n"),
  };
}

/** The Services ID has a default, so these three are what revocation waits on. */
function appleRevokeConfigured() {
  const { teamId, keyId, privateKey } = appleSigningConfig();
  return Boolean(teamId && keyId && privateKey);
}

/**
 * The ES256 JWT Apple takes in place of a client secret, signed with the Sign in
 * with Apple key. Built per request rather than cached: it costs one signature
 * and an account is deleted once.
 */
function appleClientSecret() {
  const { teamId, keyId, privateKey } = appleSigningConfig();
  if (!teamId || !keyId || !privateKey) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const signingInput = [
    base64url({ alg: "ES256", kid: keyId, typ: "JWT" }),
    base64url({
      iss: teamId,
      iat: issuedAt,
      exp: issuedAt + CLIENT_SECRET_TTL_SECONDS,
      aud: APPLE_AUDIENCE,
      sub: appleServicesId(),
    }),
  ].join(".");

  // JOSE wants the raw r||s pair. Node's default for an EC key is DER, which
  // Apple answers with invalid_client.
  const signature = signEs256("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${signature.toString("base64url")}`;
}

function appleServicesId() {
  return (process.env.CLARITI_APPLE_SERVICES_ID ?? "").trim() || APPLE_SERVICES_ID;
}

/**
 * Hands the token back to Apple. Reports rather than throws — the one caller is
 * an account deletion, which has to finish whatever Apple says.
 */
export async function revokeAppleRefreshToken(refreshToken: string) {
  let clientSecret: string | null;
  try {
    clientSecret = appleClientSecret();
  } catch (error) {
    return { ok: false as const, reason: `client secret could not be signed: ${failureDetail(error)}` };
  }

  if (!clientSecret) {
    return { ok: false as const, reason: "missing_apple_config" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVOKE_TIMEOUT_MS);
  try {
    const response = await fetch(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appleServicesId(),
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    // Apple answers 200 with an empty body, and puts the reason in JSON otherwise.
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      return { ok: false as const, reason: `apple returned ${response.status} ${detail}`.trim() };
    }

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, reason: failureDetail(error) };
  } finally {
    clearTimeout(timer);
  }
}

function failureDetail(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}
