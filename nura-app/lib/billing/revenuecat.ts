const LIVE_PURCHASE_URL = "https://pay.rev.cat/rukaqqrifcmrfqaf/";
const SANDBOX_PURCHASE_URL = "https://pay.rev.cat/sandbox/zxhobyxujoduesql/";

export function getRevenueCatPurchaseUrl() {
  const mode = getBillingMode();
  const sandboxUrl = process.env.REVENUECAT_SANDBOX_WEB_PURCHASE_URL || SANDBOX_PURCHASE_URL;
  const liveUrl = process.env.REVENUECAT_WEB_PURCHASE_URL || LIVE_PURCHASE_URL;

  return mode === "live" ? liveUrl : sandboxUrl;
}

export function getBillingMode() {
  const explicitMode = process.env.REVENUECAT_BILLING_MODE;
  if (explicitMode === "sandbox" || explicitMode === "live") return explicitMode;

  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";
  return isProduction ? "live" : "sandbox";
}

export function getRevenueCatSubscriberApiKey() {
  return process.env.REVENUECAT_REST_API_KEY || process.env.REVENUECAT_PUBLIC_API_KEY || "";
}

export function hasBillingPortalConfig() {
  return Boolean(getRevenueCatSubscriberApiKey() || process.env.STRIPE_SECRET_KEY);
}
