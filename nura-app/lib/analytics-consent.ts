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
export function isIosShell() {
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

/**
 * True inside an Android shell new enough (1.0.2+) to send the Google Ads
 * sign-up conversion through Firebase. Read off the bridge for the same reason
 * as `isIosShell`.
 */
function isAndroidAdsMeasurementShell() {
  if (typeof window === "undefined") return false;
  const bridge = (window as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      isPluginAvailable?: (name: string) => boolean;
    };
  }).Capacitor;
  return (
    typeof bridge?.isNativePlatform === "function" &&
    bridge.isNativePlatform() &&
    bridge.getPlatform?.() === "android" &&
    bridge.isPluginAvailable?.("FirebaseAnalytics") === true
  );
}

/**
 * Where the choice is stored. That Android shell asks a different question
 * ("…and tell Google which ads led to a new account"), so an Accept given to
 * the old "never for ads" notice must not carry over to it.
 */
function consentStorageKey() {
  return isAndroidAdsMeasurementShell() ? `${ANALYTICS_CONSENT_KEY}:android-ads` : ANALYTICS_CONSENT_KEY;
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
    const value = localStorage.getItem(consentStorageKey());
    if (value === "granted" || value === "denied") return value;
  } catch {
    // Private browsing or storage disabled.
  }
  return null;
}

/**
 * PostHog (product analytics and session recordings) needs an answer given to
 * the notice that names it: an Accept from before PostHog was added doesn't
 * count, so the notice asks once more. An earlier "Essential only" still
 * stands.
 *
 * In the iOS shell PostHog is on unless the person turns it off on the privacy
 * page, and no prompt is shown. It is first-party product analytics: never
 * combined with other companies' data, never used for ads and never shared with
 * data brokers, so it isn't "tracking" under App Tracking Transparency, and the
 * App Store privacy label declares it (Ike, 24 Oct 2026). The cookie notice,
 * Google Analytics and the ad tags stay off there, as above.
 */
const POSTHOG_CONSENT_KEY = "nura_posthog_consent";

export function getPostHogConsent(): AnalyticsConsent | null {
  if (isIosShell()) {
    try {
      if (localStorage.getItem(POSTHOG_CONSENT_KEY) === "denied") return "denied";
    } catch {
      // Storage unavailable: stays on, as it would on a fresh install.
    }
    return "granted";
  }
  try {
    const value = localStorage.getItem(POSTHOG_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
  } catch {
    // Private browsing or storage disabled.
  }
  return getAnalyticsConsent() === "denied" ? "denied" : null;
}

/** The iOS shell's own PostHog switch (privacy page); the cookie notice never shows there. */
export function setPostHogConsent(value: AnalyticsConsent) {
  try {
    localStorage.setItem(POSTHOG_CONSENT_KEY, value);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  }
}

export function setAnalyticsConsent(value: AnalyticsConsent) {
  try {
    localStorage.setItem(consentStorageKey(), value);
    localStorage.setItem(POSTHOG_CONSENT_KEY, value);
  } catch {
    // Private browsing or storage disabled — consent won't persist.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  }
}
