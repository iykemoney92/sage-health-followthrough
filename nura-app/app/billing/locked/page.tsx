import { CreditCard, FolderHeart, Lock } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { getSubscriptionAccess, markExpiredSubscriptionIfNeeded } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BillingLockedPage() {
  const user = await getSessionUser();
  let trialEndedLabel: string | null = null;

  if (user) {
    try {
      const admin = getSupabaseServerClient();
      const access = await markExpiredSubscriptionIfNeeded(
        admin,
        user.id,
        await getSubscriptionAccess(admin, user.id),
      );
      trialEndedLabel = formatDate(access.trialEndsAt);
    } catch {
      // Fall through with generic copy if billing lookup fails.
    }
  }

  return (
    <main className="billing-lock-page">
      <div className="billing-lock-shell">
        <NuraLogo />
        <div className="billing-lock-card" role="dialog" aria-labelledby="billing-lock-title" aria-modal="true">
          <span className="billing-lock-icon" aria-hidden="true">
            <Lock size={22} strokeWidth={2.2} />
          </span>
          <span className="auth-kicker">TRIAL ENDED</span>
          <h1 id="billing-lock-title">Your free trial has ended</h1>
          <p>
            {trialEndedLabel
              ? `Your ${trialEndedLabel} trial is over, so Nura is paused for now.`
              : "Your trial is over, so Nura is paused for now."}{" "}
            Upgrade to Plus to unlock your Care plans, check-ins, and conversations again.
          </p>
          <ul className="billing-lock-benefits">
            <li>
              <FolderHeart size={16} strokeWidth={2.2} /> Your Care plans stay saved
            </li>
            <li>
              <CreditCard size={16} strokeWidth={2.2} /> Renew anytime — cancel when you need to
            </li>
          </ul>
          <a href="/api/billing/checkout?return=locked" className="primary-cta billing-lock-cta">
            <CreditCard size={18} /> Upgrade to Plus
          </a>
          <a href="/billing" className="secondary-cta billing-lock-secondary">
            View billing details
          </a>
          <SignOutButton className="skip-intake-button billing-lock-signout" />
        </div>
      </div>
    </main>
  );
}
