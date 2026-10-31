"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { track } from "@/lib/analytics";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";

const SEEN_KEY = "nura.trialAfterCheckIn.seen";
const PAYWALL_HREF = "/onboarding?paywall=1&reason=after_checkin";

/**
 * Shown on Today once someone without Plus has had their free first check-in
 * (lib/billing/free-checkin). The first time, it takes them to the trial screen; after that
 * it stays as a card, because their next check-ins wait for the trial.
 */
export function TrialAfterCheckIn({ show }: { show: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!show) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      return;
    }
    track("trial_after_checkin_shown", { placement: "redirect" });
    router.replace(PAYWALL_HREF);
  }, [show, router]);

  if (!show) return null;

  return (
    <section className="today-trial-after-checkin" aria-label="Keep Nura checking in">
      <div>
        <strong>Your first check-in is done</strong>
        <p>
          Nura’s next check-ins wait until you start your {CARD_TRIAL_DAYS}-day free trial. You won’t be charged for{" "}
          {CARD_TRIAL_DAYS} days, and you can cancel anytime.
        </p>
      </div>
      <Link
        href={PAYWALL_HREF}
        className="primary-cta"
        onClick={() => track("trial_after_checkin_click", { placement: "today_card" })}
      >
        <CreditCard size={16} /> Start free trial
      </Link>
    </section>
  );
}
