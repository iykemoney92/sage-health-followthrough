import { NextResponse } from "next/server";

/**
 * Consent to send document contents to the AI model that powers Clariti.
 *
 * App Review rejected Nura, this app's sibling, under guidelines 5.1.1(i) and
 * 5.1.2(i): an app may only transmit personal data to a third-party AI service
 * once it has disclosed what is sent, named who receives it, and obtained
 * permission — and saying so only in the privacy policy does not count. Clariti
 * sends whole medical bills and lab results, so it takes the same gate before
 * Apple asks for it.
 *
 * Stored in Supabase auth `user_metadata` rather than a `clariti_profiles`
 * column so `proxy.ts` can read it off the session user it already loads,
 * without a query on every request.
 */

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
 * The upload screen posts a picked file to /api/documents/extract immediately,
 * before anything is submitted, so this route-level check — not the dialog — is
 * what actually holds the line on a first-run device.
 */
export function aiConsentRequiredResponse() {
  return NextResponse.json({ ok: false, error: "consent_required" }, { status: 403 });
}
