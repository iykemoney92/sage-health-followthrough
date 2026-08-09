// RevenueCat project: proja88a3e46 · entitlement "plus" (entl89acd8ae41)
// Offering "default" → packages $rc_monthly / $rc_annual.
// Web checkout uses the hosted Web Purchase Link (Clariti Stripe web config).
// Public Web Billing keys below are safe defaults (not secrets); override via env for a different project.
const SANDBOX_WEB_BILLING_KEY = "rcb_sb_UtzSoDBAiQjzqIMEPEeLYONzl";
const LIVE_WEB_BILLING_KEY = "rcb_HEYtcZcnyvyWUyjUeEALOgYCFHOV";
const LIVE_PURCHASE_URL = "https://pay.rev.cat/kwyahcrkjwtnlsep/";
const SANDBOX_PURCHASE_URL = "https://pay.rev.cat/sandbox/mdknmcezqkniaxti/";

export function getBillingMode(): "sandbox" | "live" {
  const explicitMode = process.env.CLARITI_REVENUECAT_BILLING_MODE;
  if (explicitMode === "sandbox" || explicitMode === "live") return explicitMode;

  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";
  return isProduction ? "live" : "sandbox";
}

/** Public Web Billing SDK key for `@revenuecat/purchases-js` (safe to expose client-side). */
export function getRevenueCatWebBillingPublicKey() {
  const mode = getBillingMode();
  if (mode === "live") {
    return process.env.NEXT_PUBLIC_CLARITI_REVENUECAT_WEB_BILLING_KEY || LIVE_WEB_BILLING_KEY;
  }
  return process.env.NEXT_PUBLIC_CLARITI_REVENUECAT_SANDBOX_WEB_BILLING_KEY || SANDBOX_WEB_BILLING_KEY;
}

/** Hosted RevenueCat Web Purchase Link (pay.rev.cat/...). Checkout appends the app user id. */
export function getRevenueCatPurchaseUrl() {
  const mode = getBillingMode();
  return mode === "live"
    ? (process.env.CLARITI_REVENUECAT_WEB_PURCHASE_URL || LIVE_PURCHASE_URL)
    : (process.env.CLARITI_REVENUECAT_SANDBOX_WEB_PURCHASE_URL || SANDBOX_PURCHASE_URL);
}

/** Secret REST API key for server-side subscriber lookups (sync-plus). Not required for the webhook path. */
export function getRevenueCatSubscriberApiKey() {
  return (process.env.CLARITI_REVENUECAT_REST_API_KEY || "").replace(/\\n/g, "").trim();
}

export function hasBillingPortalConfig() {
  return Boolean(getRevenueCatSubscriberApiKey() || process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY);
}

export const CLARITI_OFFERING_ID = "default";
export const CLARITI_MONTHLY_PACKAGE_ID = "$rc_monthly";
export const CLARITI_ANNUAL_PACKAGE_ID = "$rc_annual";
