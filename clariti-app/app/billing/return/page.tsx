"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";

/**
 * Handoff after hosted checkout. `/api/billing/enter` syncs RevenueCat
 * entitlements (or Stripe checkout-success already granted a trial) and redirects
 * into the workspace or the paywall.
 */
export default function BillingReturnPage() {
  const [failed, setFailed] = useState(false);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    let alive = true;
    let handoff = 0;
    const failSafe = window.setTimeout(() => setFailed(true), 8000);

    void (async () => {
      // Nothing stops a reload, a back-navigation or a pasted URL landing here,
      // so the purchase is only real if the entitlement is. /api/billing/access
      // syncs RevenueCat before answering, the same sync /api/billing/enter runs
      // a moment later.
      const payload = await fetch("/api/billing/access", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!alive) return;
      if (payload?.ok && payload.hasPlus) setPurchased(true);
      // A tick so the beacon mounts and sends before the handoff leaves the page.
      handoff = window.setTimeout(() => window.location.replace("/api/billing/enter"), 50);
    })();

    return () => {
      alive = false;
      window.clearTimeout(handoff);
      window.clearTimeout(failSafe);
    };
  }, []);

  return (
    <main className="billing-return-page">
      {/* Held until the access fetch above confirms Plus is really on — landing
          on this URL is not a purchase. Only the hosted web checkout lands here
          — a StoreKit purchase never leaves the app — so the surface is "web" by
          construction. No plan: neither the RevenueCat purchase link nor the
          Stripe fallback passes the package back through
          /api/billing/checkout-success. */}
      {purchased && <AnalyticsBeacon event="purchase_completed" params={{ surface: "web" }} />}
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
