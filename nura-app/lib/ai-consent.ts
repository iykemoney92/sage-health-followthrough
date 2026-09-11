/**
 * Consent to share health context with the AI model that powers Nura.
 *
 * App Review rejected iOS 1.0 under guidelines 5.1.1(i) and 5.1.2(i): an app may
 * only transmit personal data to a third-party AI service once it has disclosed
 * what is sent, named who receives it, and obtained permission — and Apple is
 * explicit that saying so in the privacy policy alone does not count. So consent
 * is a thing the user grants in the product, before any health context leaves
 * the device.
 *
 * It lives in Supabase auth `user_metadata` rather than a `nura_profiles`
 * column so that `middleware.ts` can read it off the session user it already
 * loads, with no extra query on every request — the same trick
 * `onboarding_complete` uses.
 */

import { NextResponse } from "next/server";

/** ISO timestamp of the moment consent was granted. Absent means never granted. */
export const AI_CONSENT_METADATA_KEY = "ai_data_consent_at";

/** The gate itself. Must stay reachable while consent is missing. */
export const AI_CONSENT_PATH = "/ai-consent";

type WithMetadata = { user_metadata?: Record<string, unknown> | null } | null | undefined;

export function hasAiConsent(user: WithMetadata): boolean {
  const value = user?.user_metadata?.[AI_CONSENT_METADATA_KEY];
  return typeof value === "string" && value.length > 0;
}

/**
 * Refusal used by the routes that reach the model.
 *
 * `middleware.ts` already keeps the UI behind the gate, so this only fires for a
 * request made outside it. It is a hard return rather than one of the "no API
 * key" fallbacks those routes use, because silently degrading to heuristics
 * would still be an answer the user never consented to ask for.
 */
export function aiConsentRequiredResponse() {
  return NextResponse.json({ ok: false, error: "consent_required" }, { status: 403 });
}
