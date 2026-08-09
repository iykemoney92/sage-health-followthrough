"use client";

import { CreditCard, FileHeart, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function BillingLockedPage() {
  const [trialEndedLabel, setTrialEndedLabel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/billing/access", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!alive || !payload?.ok) return;
        setTrialEndedLabel(formatDate(payload.trialEndsAt ?? null));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="billing-lock-page">
      <div className="billing-lock-shell">
        <span className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></span>
        <div className="billing-lock-card" role="dialog" aria-labelledby="billing-lock-title" aria-modal="true">
          <span className="billing-lock-icon" aria-hidden="true"><Lock size={22} strokeWidth={2.2} /></span>
          <span className="clariti-kicker">TRIAL ENDED</span>
          <h1 id="billing-lock-title">Your free trial has ended</h1>
          <p>
            {trialEndedLabel ? `Your ${trialEndedLabel} trial is over, so Clariti Plus features are paused.` : "Your trial is over, so Clariti Plus features are paused."}{" "}
            Upgrade to keep unlimited document analyses, videos, and follow-ups.
          </p>
          <ul className="billing-lock-benefits">
            <li><FileHeart size={16} strokeWidth={2.2} /> Your saved documents and analyses stay safe</li>
            <li><CreditCard size={16} strokeWidth={2.2} /> Renew anytime — cancel whenever you need to</li>
          </ul>
          <a href="/api/billing/checkout" className="billing-lock-cta"><CreditCard size={18} /> Upgrade to Plus</a>
          <Link href="/billing" className="billing-lock-secondary">View billing details</Link>
          <SignOutButton className="billing-lock-signout">Sign out</SignOutButton>
        </div>
      </div>

      <style jsx global>{`
        .billing-lock-page{min-height:100vh;display:grid;place-items:center;background:#f7f8f7;padding:32px}
        .billing-lock-shell{display:grid;gap:22px;justify-items:center;width:min(420px,100%)}
        .billing-lock-card{width:100%;background:#fff;border:1px solid #e1e8e4;border-radius:24px;padding:30px;display:grid;gap:12px;box-shadow:0 24px 60px rgba(31,52,45,.1)}
        .billing-lock-icon{width:46px;height:46px;border-radius:14px;background:#fbf3e7;color:#8a5a1f;display:grid;place-items:center}
        .billing-lock-card h1{margin:2px 0 0;font:500 24px/1.2 Georgia,"Times New Roman",serif;color:#21332f;letter-spacing:-.02em}
        .billing-lock-card>p{margin:0;color:#61726d;font-size:13px;line-height:1.6}
        .billing-lock-benefits{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:8px}
        .billing-lock-benefits li{display:flex;align-items:center;gap:9px;color:#3d4f49;font-size:12.5px;font-weight:600}
        .billing-lock-cta{margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;background:#4d8d83;color:#fff;border-radius:13px;padding:13px;font-size:13px;font-weight:800}
        .billing-lock-secondary{text-align:center;text-decoration:none;color:#426f67;font-size:12px;font-weight:700}
        .billing-lock-signout{margin-top:4px;width:100%;border:1px solid #e2e7e5;border-radius:13px;background:#fff;color:#68756f;padding:11px;font-size:12px;font-weight:700}
      `}</style>
    </main>
  );
}
