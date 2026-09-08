// RevenueCat project: proja88a3e46 · entitlement "plus" (entl89acd8ae41)
// Offering "default" → packages $rc_monthly / $rc_annual.
// Web checkout uses the hosted Web Purchase Link (Clariti Stripe web config).
// Public Web Billing keys below are safe defaults (not secrets); override via env for a different project.
const SANDBOX_WEB_BILLING_KEY = "rcb_sb_UtzSoDBAiQjzqIMEPEeLYONzl";
const LIVE_WEB_BILLING_KEY = "rcb_HEYtcZcnyvyWUyjUeEALOgYCFHOV";
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

/**
 * Hosted RevenueCat Web Purchase Link (pay.rev.cat/...). Checkout appends the
 * app user id.
 *
 * Live has no baked-in default. The one that used to live here outlived the
 * RevenueCat link it named, and because it was a code constant every signed-in
 * web user kept being sent to a "Page not found" that no environment change
 * could switch off. Coming only from the environment, an operator can retarget
 * the web funnel — or close it — without a deploy, and callers can tell that
 * there is nowhere to send a buyer rather than sending them into a dead end.
 */
export function getRevenueCatPurchaseUrl() {
  const mode = getBillingMode();
  return mode === "live"
    ? (process.env.CLARITI_REVENUECAT_WEB_PURCHASE_URL || "").trim()
    : (process.env.CLARITI_REVENUECAT_SANDBOX_WEB_PURCHASE_URL || SANDBOX_PURCHASE_URL);
}

/** The secret Stripe key for the mode in play — checkout's emergency fallback. */
export function getStripeSecretKey() {
  const mode = getBillingMode();
  if (mode === "live") {
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
  }
  return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

/**
 * True when /api/billing/checkout has somewhere to send a web buyer. The paywall
 * reads this so it can say so plainly instead of rendering a button that lands
 * on an error page.
 */
export function hasWebCheckoutConfig() {
  if (getRevenueCatPurchaseUrl()) return true;
  return Boolean(getStripeSecretKey() && process.env.STRIPE_PLUS_PRICE_ID?.trim());
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

/**
 * The App Store / Play product ids the RevenueCat offering must attach to its
 * monthly and annual packages. They are already on
 * CLARITI_REVENUECAT_PLUS_PRODUCT_IDS, so an entitlement granted for either one
 * flows through the existing webhook unchanged.
 *
 * Exported so the release runbook and the code cannot drift apart: if these
 * change, App Store Connect, Play Console and RevenueCat all have to change too.
 */
export const CLARITI_STORE_PRODUCT_IDS = {
  monthly: "clariti_plus_monthly",
  annual: "clariti_plus_annual",
} as const;
