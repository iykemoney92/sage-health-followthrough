export const ANALYTICS_CONSENT_KEY = "nura_analytics_consent";
export const ANALYTICS_CONSENT_EVENT = "nura-analytics-consent";

export type AnalyticsConsent = "granted" | "denied";

export function getGaMeasurementId() {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
}

/**
 * True inside the Capacitor iOS shell only.
 *
 * Read off the injected bridge rather than importing `@capacitor/core`, because
 * this module is also pulled into server components, where that import has no
 * business running.
 */
function isIosShell() {
  if (typeof window === "undefined") return false;
  const bridge = (window as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  return (
    typeof bridge?.isNativePlatform === "function" &&
    bridge.isNativePlatform() &&
    bridge.getPlatform?.() === "ios"
  );
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  // Hard "denied" in the iOS shell, never the stored value and never null.
  // App Review rejected the iOS build under guideline 5.1.2(i) for showing a
  // cookie prompt without asking through App Tracking Transparency first, and
  // Apple's own first remedy is to stop collecting tracking cookies on their
  // devices. Returning "denied" here is that remedy at the one choke point all
  // three consumers share: the banner only appears on `null`, the Google
  // Analytics tag and `track()` both require "granted". So the iOS shell shows
  // no prompt, loads no tag and sends no events, which keeps the ATT
  // requirement from applying at all.
  //
  // Android has no ATT, so its shell behaves like the web app: the cookie
  // notice asks, and analytics only runs after Accept. Blanket-denying it as
  // well left every Google Play install invisible in Analytics.
  if (isIosShell()) return "denied";

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
