"use client";

import { useEffect, useState } from "react";
import { COOKIE_NOTICE_REOPEN_EVENT } from "@/components/cookie-consent";
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent } from "@/lib/analytics-consent";
import { AD_CONSENT_EVENT, adMeasurementApplies, getAdConsent } from "@/lib/quora-pixel";

/**
 * "Change my cookie choice" on the privacy page. The notice only appears while
 * a choice is missing, so without this a first answer could never be taken
 * back. It reopens the same notice rather than offering a second set of
 * controls.
 */
export function CookieChoiceButton() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // Hidden in the iOS shell, where analytics and ads are always off.
    const update = () => {
      if (!adMeasurementApplies() && getAnalyticsConsent() === "denied") return setLabel(null);
      const accepted = getAnalyticsConsent() === "granted" && (!adMeasurementApplies() || getAdConsent() === "granted");
      setLabel(accepted ? "You accepted optional cookies." : "Only essential cookies are in use.");
    };
    update();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, update);
    window.addEventListener(AD_CONSENT_EVENT, update);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, update);
      window.removeEventListener(AD_CONSENT_EVENT, update);
    };
  }, []);

  if (label === null) return null;

  return (
    <article id="cookie-choice">
      <h2>Your cookie choice</h2>
      <p>
        {label}{" "}
        <button
          type="button"
          className="cookie-notice-essential"
          style={{ color: "inherit", fontSize: "inherit", padding: 0, minHeight: 0 }}
          onClick={() => window.dispatchEvent(new Event(COOKIE_NOTICE_REOPEN_EVENT))}
        >
          Change my cookie choice
        </button>
      </p>
    </article>
  );
}
