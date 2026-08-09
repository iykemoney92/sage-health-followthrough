export const ANALYTICS_CONSENT_KEY = "nura_analytics_consent";
export const ANALYTICS_CONSENT_EVENT = "nura-analytics-consent";

export type AnalyticsConsent = "granted" | "denied";

export function getGaMeasurementId() {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
  } catch {
    // Private browsing or storage disabled.
  }
  return null;
}

export function setAnalyticsConsent(value: AnalyticsConsent) {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // Private browsing or storage disabled — consent won't persist.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  }
}
