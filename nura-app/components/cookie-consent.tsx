"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Consent only exists in the browser, so this can't be read during the
    // server render — deferring to an effect (and accepting the one extra
    // client-only render) is the correct approach here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getAnalyticsConsent() === null) setVisible(true);
  }, []);

  function choose(value: "granted" | "denied") {
    setAnalyticsConsent(value);
    // Consent event itself only fires when granted (track gates on consent).
    if (value === "granted") track("analytics_consent", { value });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-notice" role="dialog" aria-label="Cookie notice">
      <p>
        Nura uses essential cookies to keep you signed in, and optional analytics
        cookies (Google Analytics) to understand how the product is used — never
        for ads. <Link href="/privacy">Learn more</Link>
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
