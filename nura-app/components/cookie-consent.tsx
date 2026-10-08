"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics-consent";
import { isNativeAnalyticsAvailable } from "@/lib/native-analytics";
import { adMeasurementApplies, getAdConsent, setAdConsent } from "@/lib/quora-pixel";

/** Fired by the privacy page's "Change my cookie choice" to bring the notice back. */
export const COOKIE_NOTICE_REOPEN_EVENT = "nura-cookie-notice-reopen";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [androidApp, setAndroidApp] = useState(false);
  const [web, setWeb] = useState(false);

  useEffect(() => {
    // Consent only exists in the browser, so this can't be read during the
    // server render — deferring to an effect (and accepting the one extra
    // client-only render) is the correct approach here.
    const onWeb = adMeasurementApplies();
    // On the web the notice also asks about Quora ad measurement, and an
    // answer given before that question existed doesn't count, so it shows
    // again once for anyone who hasn't answered it.
    const unanswered = () => getAnalyticsConsent() === null || (onWeb && getAdConsent() === null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeb(onWeb);
    if (unanswered()) setVisible(true);
    // Only the Android shell sends a sign-up conversion to Google Ads, so only
    // it may say so; on the web the notice names Quora instead.
    setAndroidApp(isNativeAnalyticsAvailable());
    const reopen = () => setVisible(true);
    window.addEventListener(COOKIE_NOTICE_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_NOTICE_REOPEN_EVENT, reopen);
  }, []);

  function choose(value: "granted" | "denied") {
    setAnalyticsConsent(value);
    if (web) setAdConsent(value);
    // Consent event itself only fires when granted (track gates on consent).
    if (value === "granted") track("analytics_consent", { value });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-notice" role="dialog" aria-label="Cookie notice">
      <p>
        {androidApp ? (
          <>
            Nura uses essential cookies to keep you signed in, and optional
            analytics (Google Analytics) to understand how the app is used and to
            tell Google which of our ads led to a new account. No health
            information is shared, and nothing is used to target you with ads.{" "}
          </>
        ) : web ? (
          <>
            Nura uses essential cookies to keep you signed in. If you accept, it
            also uses Google Analytics to see how the product is used, and the
            Quora Pixel on our public pages to see which of our ads brought you
            here. Neither ever receives your health information.{" "}
          </>
        ) : (
          <>
            Nura uses essential cookies to keep you signed in, and optional analytics
            cookies (Google Analytics) to understand how the product is used — never
            for ads.{" "}
          </>
        )}
        <Link href="/privacy">Learn more</Link>
      </p>
      <div className="cookie-notice-actions">
        <button type="button" className="cookie-notice-essential" onClick={() => choose("denied")}>
          Essential only
        </button>
        <button type="button" className="secondary-cta" onClick={() => choose("granted")}>
          Accept
        </button>
      </div>
    </div>
  );
}
