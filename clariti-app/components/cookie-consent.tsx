"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics-consent";
import { getAdConsent, setAdConsent } from "@/lib/quora-pixel";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Consent only exists in the browser, so this can't be read during the
    // server render — deferring to an effect (and accepting the one extra
    // client-only render) is the correct approach here. Both reads are a hard
    // "denied" in the native shells, so the notice never shows there.
    //
    // The notice now also asks about Quora ad measurement, and an Accept given
    // before that question existed doesn't count as a yes to it, so it shows
    // once more for anyone who hasn't answered it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getAnalyticsConsent() === null || getAdConsent() === null) setVisible(true);
  }, []);

  function choose(value: "granted" | "denied") {
    setAnalyticsConsent(value);
    setAdConsent(value);
    // Consent event itself only fires when granted (track gates on consent).
    if (value === "granted") track("analytics_consent", { value });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-notice" role="dialog" aria-label="Cookie notice">
      <p>
        Clariti uses essential cookies to keep you signed in. If you accept, it also uses Google Analytics to understand
        how the product is used, and the Quora Pixel on our public pages to see which of our ads brought you here — never
        on your documents or anything written in them. You can change this answer any time in Settings, under Privacy &
        support.
      </p>
      <div className="cookie-notice-actions">
        <button type="button" className="cookie-notice-essential" onClick={() => choose("denied")}>
          Essential only
        </button>
        <button type="button" className="cookie-notice-accept" onClick={() => choose("granted")}>
          Accept
        </button>
      </div>
    </div>
  );
}
