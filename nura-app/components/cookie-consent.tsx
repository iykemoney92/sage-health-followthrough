"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "nura_cookie_notice_ack";

function hasAcknowledged() {
  // A JS-set document.cookie is capped at 7 days by Safari/WebKit's ITP
  // regardless of max-age, which made this banner reappear weekly on iOS
  // (including the Capacitor shell's WKWebView). localStorage has no such
  // cap and this flag is never needed server-side, so it's the right store.
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Cookie state only exists in the browser, so this can't be read during the
    // server render - deferring to an effect (and accepting the one extra
    // client-only render) is the correct approach here, not a something-you-forgot-to-do.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasAcknowledged()) setVisible(true);
  }, []);

  function acknowledge() {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // Private browsing or storage disabled - nothing we can persist; the
      // banner will just reappear next visit, which is an acceptable fallback.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-notice" role="dialog" aria-label="Cookie notice">
      <p>
        Nura uses only essential cookies to keep you signed in and your session secure - no advertising or
        tracking cookies. <Link href="/privacy">Learn more</Link>
      </p>
      <button type="button" className="secondary-cta" onClick={acknowledge}>Got it</button>
    </div>
  );
}
