"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { AnalyticsConsent } from "@/lib/analytics-consent";

/**
 * Firebase Analytics in the Android shell, reached through the
 * @capacitor-firebase/analytics plugin that nura-mobile bundles.
 *
 * It has one job: tell Google Ads which Play installs went on to create an
 * account. App campaigns can only bid on and report in-app events that come
 * from the app's own Firebase SDK, so the web GA tag can't do this.
 *
 * Registered by name instead of importing the plugin package, because only
 * nura-mobile ships the native half. Android builds older than 1.0.2 don't
 * have it, and `isPluginAvailable` turns every call into a no-op there.
 */
type ConsentType = "ANALYTICS_STORAGE" | "AD_STORAGE" | "AD_USER_DATA" | "AD_PERSONALIZATION";
type ConsentStatus = "GRANTED" | "DENIED";

interface FirebaseAnalyticsPlugin {
  setConsent(options: { type: ConsentType; status: ConsentStatus }): Promise<void>;
  logEvent(options: { name: string; params?: Record<string, string | number> }): Promise<void>;
}

const FirebaseAnalytics = registerPlugin<FirebaseAnalyticsPlugin>("FirebaseAnalytics");

export function isNativeAnalyticsAvailable() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android" &&
    Capacitor.isPluginAvailable("FirebaseAnalytics")
  );
}

/**
 * Mirrors the cookie-notice choice into Firebase consent mode. Ad
 * personalisation stays denied either way: the conversion is used to measure
 * campaigns, never to build remarketing audiences.
 */
export async function syncNativeAnalyticsConsent(consent: AnalyticsConsent | null) {
  if (!isNativeAnalyticsAvailable()) return;
  const status: ConsentStatus = consent === "granted" ? "GRANTED" : "DENIED";
  try {
    await Promise.all([
      FirebaseAnalytics.setConsent({ type: "ANALYTICS_STORAGE", status }),
      FirebaseAnalytics.setConsent({ type: "AD_STORAGE", status }),
      FirebaseAnalytics.setConsent({ type: "AD_USER_DATA", status }),
      FirebaseAnalytics.setConsent({ type: "AD_PERSONALIZATION", status: "DENIED" }),
    ]);
  } catch {
    // Analytics must never break the app.
  }
}

/** Logs a Firebase event; resolves false when nothing was sent. */
export async function logNativeEvent(name: string, params?: Record<string, string | number>) {
  if (!isNativeAnalyticsAvailable()) return false;
  try {
    await FirebaseAnalytics.logEvent({ name, params });
    return true;
  } catch {
    return false;
  }
}
