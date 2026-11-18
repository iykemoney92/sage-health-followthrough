"use client";

import { CalendarCheck, CreditCard, Files, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { SignOutButton } from "@/components/sign-out-button";
import { billingSurface, UpgradeCta } from "@/components/upgrade-cta";
import { safeNextPath } from "@/lib/auth/safe-path";
import "../billing-lock.css";
import "../billing/billing-plans.css";

/**
 * The card step of onboarding (card-first, 18 Nov 2026).
 *
 * Every signed-in account without a trial or plan lands here: proxy.ts sends
 * the app pages, the upload screen sends itself, and the consent gate hands off
 * to it. There is no skip on purpose. What must stay reachable does: sign out,
 * and Settings for export and deletion, which Apple's 5.1.1(v) will not accept
 * behind a paywall.
 *
 * The buy control is UpgradeCta, the one place that decides how Plus is sold:
 * Stripe Checkout on the web, the store's own sheet inside the apps (with
 * Restore purchases), so this screen cannot drift out of 3.1.1 on its own.
 */
export default function StartTrialPage() {
  return (
    <Suspense>
      <StartTrial />
    </Suspense>
  );
}

function StartTrial() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/workspace");
  const checkout = searchParams.get("checkout");

  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [trialDays, setTrialDays] = useState(7);
  const [trialEligible, setTrialEligible] = useState(true);
  const [webCheckoutAvailable, setWebCheckoutAvailable] = useState(true);

  /** Also the post-purchase refetch: once Plus is on, this step is over. */
  const loadAccess = useCallback(async () => {
    const payload = await fetch("/api/billing/access", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!payload?.ok) return false;
    if (payload.hasPlus || payload.cardFirst === false) {
      router.replace(next);
      return true;
    }
    if (payload.locked) {
      router.replace("/billing/locked");
      return true;
    }
    setTrialDays(payload.trialDays ?? 7);
    setTrialEligible(payload.trialEligible !== false);
    setWebCheckoutAvailable(payload.webCheckoutAvailable !== false);
    return false;
  }, [next, router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const auth = await fetch("/api/auth/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!alive) return;
      if (!auth?.authenticated) {
        router.replace("/?auth=1&mode=signin");
        return;
      }
      setUserId(auth.user?.id ?? null);
      const leaving = await loadAccess();
      if (alive && !leaving) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [loadAccess, router]);

  const label = trialEligible ? `Start ${trialDays}-day free trial` : "Continue with Clariti Plus";

  return (
    <main className="billing-lock-page">
      {ready && <AnalyticsBeacon event="paywall_view" params={{ surface: billingSurface(), has_plus: false, step: "onboarding" }} />}
      <div className="billing-lock-shell">
        <span className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></span>
        <div className="billing-lock-card" role="dialog" aria-labelledby="start-trial-title" aria-modal="true">
          <span className="billing-lock-icon" aria-hidden="true"><ShieldCheck size={22} strokeWidth={2.2} /></span>
          <span className="clariti-kicker">ONE LAST STEP</span>
          <h1 id="start-trial-title">
            {trialEligible ? `Try Clariti free for ${trialDays} days` : "Pick up where you left off"}
          </h1>
          <p>
            {trialEligible
              ? `Add a payment method to start. You pay nothing today, and nothing at all if you cancel before day ${trialDays}.`
              : "Your free trial has been used. Subscribe to Clariti Plus to keep going."}
          </p>

          {checkout === "card_declined" ? (
            <p className="billing-notice billing-notice-error" role="alert">
              That card could not be approved, so the trial was not started and nothing was charged. Please try
              another card.
            </p>
          ) : checkout === "failed" || checkout === "profile-update-failed" ? (
            <p className="billing-notice billing-notice-error" role="alert">
              Checkout did not complete. Please try again.
            </p>
          ) : null}

          <ul className="billing-lock-benefits">
            <li><Files size={16} strokeWidth={2.2} /> Bills, EOBs, lab results and letters in plain English</li>
            <li><CalendarCheck size={16} strokeWidth={2.2} /> Unlimited analyses, explainer videos and check-ins</li>
            <li><CreditCard size={16} strokeWidth={2.2} /> Cancel any time in a couple of taps</li>
          </ul>

          {ready ? (
            <UpgradeCta
              userId={userId}
              authenticated={Boolean(userId)}
              hasPlus={false}
              label={label}
              className="billing-lock-cta"
              webCheckoutAvailable={webCheckoutAvailable}
              checkoutFrom="start-trial"
              trialDays={trialEligible ? trialDays : null}
              onPurchased={async () => {
                await loadAccess();
              }}
            />
          ) : (
            <p className="billing-notice" role="status">Checking your account…</p>
          )}

          <p className="billing-notice">
            Clariti Plus renews automatically at the price shown at checkout until you cancel. Cancel at least 24
            hours before a period ends to avoid the next charge.{" "}
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
          </p>
          <Link href="/settings" className="billing-lock-secondary">Account settings, export and deletion</Link>
          <SignOutButton className="billing-lock-signout">Sign out</SignOutButton>
        </div>
      </div>
    </main>
  );
}
