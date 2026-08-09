"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Instant handoff after hosted checkout. `/api/billing/enter` syncs RevenueCat
 * entitlements (or Stripe checkout-success already granted a trial) and redirects
 * into the workspace or the paywall.
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
        <p>Confirming your Clariti Plus access and opening your workspace...</p>
        {failed ? (
          <a href="/api/billing/enter" className="billing-return-cta">Continue to Clariti</a>
        ) : null}
      </div>

      <style jsx global>{`
        .billing-return-page{min-height:100vh;display:grid;place-items:center;background:#f7f8f7;padding:32px}
        .billing-return-card{width:min(380px,100%);text-align:center;background:#fff;border:1px solid #e1e8e4;border-radius:22px;padding:32px;box-shadow:0 20px 50px rgba(31,52,45,.08)}
        .billing-return-spin{color:#4d8d83;animation:clariti-spin 1s linear infinite}
        .billing-return-card h1{margin:16px 0 0;font:500 22px/1.2 Georgia,"Times New Roman",serif;color:#21332f}
        .billing-return-card p{margin:8px 0 0;color:#65746f;font-size:13px}
        .billing-return-cta{display:inline-flex;margin-top:16px;text-decoration:none;background:#4d8d83;color:#fff;border-radius:12px;padding:11px 18px;font-size:12px;font-weight:800}
        @keyframes clariti-spin{to{transform:rotate(360deg)}}
      `}</style>
    </main>
  );
}
