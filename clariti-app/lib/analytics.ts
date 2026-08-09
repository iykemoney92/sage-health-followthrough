import { getAnalyticsConsent, getGaMeasurementId } from "@/lib/analytics-consent";

export type AnalyticsParams = Record<string, string | number | boolean | undefined | null>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    // GA uses the `arguments` object; keep this loose.
    gtag?: (...args: unknown[]) => void;
  }
}

function sanitizeParams(params?: AnalyticsParams) {
  if (!params) return undefined;
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") return;
  // Must push the Arguments object (not a rest array) so queued calls work
  // once the real gtag.js script boots.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
}

/** Fire a GA4 custom event when the user has granted analytics consent. */
export function track(event: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;
  if (!getGaMeasurementId()) return;
  if (getAnalyticsConsent() !== "granted") return;

  ensureGtagStub();
  const payload = sanitizeParams(params);
  if (payload) window.gtag!("event", event, payload);
  else window.gtag!("event", event);
}
