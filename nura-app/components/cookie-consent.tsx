"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_COOKIE = "nura_cookie_notice_ack";

function hasAcknowledged() {
  return document.cookie.split("; ").some((row) => row.startsWith(`${CONSENT_COOKIE}=`));
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
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${CONSENT_COOKIE}=1; max-age=${oneYear}; path=/; SameSite=Lax`;
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
