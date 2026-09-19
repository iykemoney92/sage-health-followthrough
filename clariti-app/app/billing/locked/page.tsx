"use client";

import { CreditCard, FileHeart, Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { SignOutButton } from "@/components/sign-out-button";
import { billingSurface, UpgradeCta } from "@/components/upgrade-cta";
import "../../billing-lock.css";
import "../billing-plans.css";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function BillingLockedPage() {
  const router = useRouter();
  const [trialEndedLabel, setTrialEndedLabel] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [webCheckoutAvailable, setWebCheckoutAvailable] = useState(true);
  // Null until /api/billing/access answers, and the beacon below only mounts on
  // false: a Plus holder who lands here is redirected straight out and never
  // sees the wall, so counting them — labelled or not — would inflate every
  // paywall the funnel is measured against. /billing is the other way round and
  // keeps them, because a Plus holder there really is using the page; has_plus
  // stays on both events so the two sources group the same way.
  const [hasPlus, setHasPlus] = useState<boolean | null>(null);

  /** Also the post-purchase refetch: once Plus is on, this screen is over. */
  const loadAccess = useCallback(async () => {
    const payload = await fetch("/api/billing/access", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!payload?.ok) return;
    setTrialEndedLabel(formatDate(payload.trialEndsAt ?? null));
    setHasPlus(Boolean(payload.hasPlus));
    setWebCheckoutAvailable(payload.webCheckoutAvailable !== false);
    if (payload.hasPlus) router.replace("/workspace");
  }, [router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const authPayload = await fetch("/api/auth/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (alive) setUserId(authPayload?.user?.id ?? null);
      await loadAccess();
    })();
    return () => {
      alive = false;
    };
  }, [loadAccess]);

  return (
    <main className="billing-lock-page">
      {hasPlus === false && (
        <AnalyticsBeacon event="paywall_view" params={{ surface: billingSurface(), has_plus: hasPlus }} />
      )}
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
          {/* Not a direct link to /api/billing/checkout: inside the app that is a
              web checkout for digital content, which Guideline 3.1.1 forbids.
              UpgradeCta picks StoreKit there and the web link on the web. */}
          <UpgradeCta
            userId={userId}
            authenticated={Boolean(userId)}
            hasPlus={false}
            label="Upgrade to Plus"
            className="billing-lock-cta"
            webCheckoutAvailable={webCheckoutAvailable}
            onPurchased={loadAccess}
          />
          <Link href="/billing" className="billing-lock-secondary">View billing details</Link>
          <SignOutButton className="billing-lock-signout">Sign out</SignOutButton>
        </div>
      </div>
    </main>
  );
}
