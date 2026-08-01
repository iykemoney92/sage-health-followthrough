"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

/**
 * Instant handoff after hosted checkout.
 * Middleware stamps nura_checkout_pending; /api/billing/enter syncs RevenueCat and redirects.
 */
export default function BillingReturnPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace("/api/billing/enter");
    }, 50);

    const failSafe = window.setTimeout(() => setFailed(true), 8000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(failSafe);
    };
  }, []);

  return (
    <main className="billing-return-page">
      <div className="billing-return-card">
        <LoaderCircle className="billing-return-spin" size={28} aria-hidden />
        <h1>You&apos;re all set</h1>
        <p>Confirming your Plus trial and opening your dashboard…</p>
        {failed ? (
          <a href="/api/billing/enter" className="primary-cta">
            Continue to Nura
          </a>
        ) : null}
      </div>
    </main>
  );
}
