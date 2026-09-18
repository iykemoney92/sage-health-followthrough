import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, FolderHeart, Lock } from "lucide-react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { NuraLogo } from "@/components/nura-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { TrackedCheckoutLink } from "@/components/tracked-billing-links";
import { UpgradeCta } from "@/components/upgrade-cta";
import { getSubscriptionAccess, markExpiredSubscriptionIfNeeded } from "@/lib/billing/subscription";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BillingLockedPage() {
  const user = await getSessionUser();
  let endedLabel: string | null = null;
  // A lapsed trial and a lapsed paid subscription are different situations
  // and were both being called "your free trial has ended".
  let hadPaidPlan = false;

  if (user) {
    try {
      const admin = getSupabaseServerClient();
      // Last check with the store of record before telling anyone they are
      // locked out. If RevenueCat has a live entitlement, this page is wrong.
      const synced = await syncPlusFromRevenueCat(admin, user.id);
      if (synced.hasPlus) redirect("/today");
      const access = await markExpiredSubscriptionIfNeeded(
        admin,
        user.id,
        await getSubscriptionAccess(admin, user.id),
      );
      const paidUntil = access.currentPeriodEndsAt;
      const trialEnd = access.trialEndsAt;
      hadPaidPlan = Boolean(paidUntil && (!trialEnd || new Date(paidUntil).getTime() > new Date(trialEnd).getTime() + 60_000));
      endedLabel = formatDate(hadPaidPlan ? paidUntil : trialEnd);
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error; // Next redirect
      // Fall through with generic copy if billing lookup fails.
    }
  }

  return (
    <main className="billing-lock-page">
      <AnalyticsBeacon event="billing_locked_view" />
      <AnalyticsBeacon event="trial_end_lock" />
      <div className="billing-lock-shell">
        <NuraLogo />
        <div className="billing-lock-card" role="dialog" aria-labelledby="billing-lock-title" aria-modal="true">
          <span className="billing-lock-icon" aria-hidden="true">
            <Lock size={22} strokeWidth={2.2} />
          </span>
          <span className="auth-kicker">{hadPaidPlan ? "PLUS ENDED" : "TRIAL ENDED"}</span>
          <h1 id="billing-lock-title">{hadPaidPlan ? "Your Plus subscription has ended" : "Your free trial has ended"}</h1>
          <p>
            {hadPaidPlan
              ? `Plus ended${endedLabel ? ` on ${endedLabel}` : ""}, so Nura is paused for now.`
              : `Your trial ended${endedLabel ? ` on ${endedLabel}` : ""}, so Nura is paused for now.`}{" "}
            Renew to unlock your Care plans, check-ins and conversations again.
          </p>
          <ul className="billing-lock-benefits">
            <li>
              <FolderHeart size={16} strokeWidth={2.2} /> Your Care plans stay saved
            </li>
            <li>
              <CreditCard size={16} strokeWidth={2.2} /> Renew anytime — cancel when you need to
            </li>
          </ul>
          <UpgradeCta userId={user?.id ?? null} renewing>
            <TrackedCheckoutLink
              href="/api/billing/checkout?return=locked"
              className="primary-cta billing-lock-cta"
              source="billing_locked"
              cta="upgrade_to_plus"
            >
              <CreditCard size={18} /> Upgrade to Plus
            </TrackedCheckoutLink>
          </UpgradeCta>
          <a href="/billing" className="secondary-cta billing-lock-secondary">
            View billing details
          </a>
          <div className="billing-lock-foot">
            <SignOutButton className="billing-lock-signout" source="billing_locked" />
            <Link href="/account/delete" className="billing-lock-footnote">
              Delete my account instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
