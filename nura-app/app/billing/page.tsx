import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FolderHeart,
  MessageCircle,
  Mic,
  Settings,
  Sparkles,
} from "lucide-react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { CheckoutFailTracker } from "@/components/checkout-fail-tracker";
import { NuraShell } from "@/components/nura-shell";
import { TrackedCheckoutLink, TrackedPortalLink } from "@/components/tracked-billing-links";
import { ManageSubscriptionCta, UpgradeCta } from "@/components/upgrade-cta";
import { getUserAvatarUrl } from "@/lib/avatar";
import { reconcileShortCardTrial } from "@/lib/billing/reconcile-trial";
import { getSubscriptionAccess, markExpiredSubscriptionIfNeeded } from "@/lib/billing/subscription";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getWhatsappConnectionStatus } from "@/lib/channel-links";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type BillingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();
  if (user) {
    await reconcileShortCardTrial(supabase, user.id);
  }
  let access = user ? await getSubscriptionAccess(supabase, user.id) : null;
  if (user && access && !access.hasPlus && access.status === "expired") {
    try {
      access = await markExpiredSubscriptionIfNeeded(getSupabaseServerClient(), user.id, access);
    } catch {
      // Keep computed access if service role isn't available locally.
    }
  }
  const whatsapp = user
    ? await getWhatsappConnectionStatus(supabase, user.id)
    : { linked: false, pendingCode: null, expiresAt: null };
  const params = searchParams ? await searchParams : {};
  const manageNotice = params.manage === "unavailable";
  const checkoutParam = typeof params.checkout === "string" ? params.checkout : null;
  const checkoutFailReason =
    checkoutParam === "failed" || checkoutParam === "profile-update-failed" ? checkoutParam : null;
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  const avatarUrl = getUserAvatarUrl(user);
  const trialEnds = formatDate(access?.trialEndsAt ?? null);
  const paidUntil = formatDate(access?.currentPeriodEndsAt ?? null);
  const isTrialing = access?.status === "trialing" && Boolean(trialEnds);
  const isCancelled = access?.status === "cancelled";
  const statusLabel = access?.hasPlus
    ? isTrialing
      ? "Trial active"
      : isCancelled
        ? "Cancelling"
        : "Plus active"
    : access?.status === "expired"
      ? "Trial expired"
      : "Free";
  const statusCopy = isTrialing && trialEnds
    ? `Your free trial runs until ${trialEnds} (then US$9.99/month unless you cancel).`
    : isCancelled && paidUntil && access?.hasPlus
      ? `Cancelled — Plus stays on until ${paidUntil}.`
      : access?.hasPlus && paidUntil
        ? `Your paid access runs until ${paidUntil}.`
        : access?.status === "expired"
          ? `Your free trial${trialEnds ? ` ended on ${trialEnds}` : " has ended"}. Upgrade to Plus to unlock Care plans and check-ins again.`
          : `Upgrade when you’re ready for voice, WhatsApp follow-up, and more Care plans. New plans include a ${CARD_TRIAL_DAYS}-day free trial.`;

  const features = [
    {
      title: "Voice notes",
      copy: "Speak naturally and let Nura turn it into useful context.",
      href: "/workspace",
      meta: access?.hasPlus ? "Included" : "Plus",
      Icon: Mic,
    },
    {
      title: "WhatsApp follow-up",
      copy: whatsapp.linked
        ? "Connected — manage linking in Connected apps."
        : "Send updates from WhatsApp and keep Care plans moving.",
      href: "/me/connections",
      meta: whatsapp.linked ? "Connected" : access?.hasPlus ? "Set up" : "Plus",
      Icon: MessageCircle,
    },
    {
      title: "More Care plans",
      copy: "Track multiple health and life follow-through areas at once.",
      href: "/plans",
      meta: access?.hasPlus ? "Included" : "1 on Free",
      Icon: FolderHeart,
    },
  ] as const;

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <AnalyticsBeacon
        event="billing_page_view"
        params={{ status: access?.status || "none", has_plus: Boolean(access?.hasPlus) }}
      />
      {manageNotice ? <AnalyticsBeacon event="portal_unavailable" /> : null}
      <CheckoutFailTracker reason={checkoutFailReason} />
      <div className="dashboard-page billing-page billing-v2">
        <Link href="/me" className="back-link">
          <ArrowLeft /> Me
        </Link>

        <header className="settings-detail-head">
          <span className="settings-hero-icon">
            <Sparkles />
          </span>
          <div>
            <h1>Billing</h1>
            <p>Nura Plus unlocks voice, WhatsApp follow-up, and more than one active Care plan.</p>
          </div>
        </header>

        <section className="billing-status-card">
          <div className="billing-status-copy">
            <small>Current access</small>
            <div className="billing-status-title-row">
              <h2>{statusLabel}</h2>
              <span className={`me-status-pill ${access?.hasPlus ? "is-on" : "is-off"}`}>
                {access?.hasPlus ? "Plus" : "Free"}
              </span>
            </div>
            <p>{statusCopy}</p>
            {manageNotice ? (
              <p className="billing-notice">
                Cancel/manage isn’t linked in-app yet. Use the “manage subscription” / “update payment method” link in
                your Stripe receipt email — that opens the real customer portal.
              </p>
            ) : null}
          </div>

          <div className="billing-actions">
            {access?.hasPlus ? (
              <ManageSubscriptionCta className="primary-cta">
                <TrackedPortalLink href="/api/billing/portal" className="primary-cta" hasPlus>
                  <Settings /> Manage or cancel
                </TrackedPortalLink>
              </ManageSubscriptionCta>
            ) : (
              <>
                <UpgradeCta userId={user?.id ?? null} renewing={access?.status === "expired"}>
                  <TrackedCheckoutLink
                    href={access?.status === "expired" ? "/api/billing/checkout?return=locked" : "/api/billing/checkout"}
                    className="primary-cta"
                    source="billing"
                    cta={access?.status === "expired" ? "renew_plus" : "upgrade_to_plus"}
                  >
                    <CreditCard /> {access?.status === "expired" ? "Renew Plus" : "Upgrade to Plus"}
                  </TrackedCheckoutLink>
                  <TrackedPortalLink href="/api/billing/portal" className="secondary-cta" hasPlus={false}>
                    <Settings /> Manage or cancel
                  </TrackedPortalLink>
                </UpgradeCta>
              </>
            )}
          </div>
          {access?.hasPlus ? (
            <p className="billing-cancel-hint">
              Opens Stripe’s customer portal to update your card, download invoices, or cancel. Access stays until the
              current period ends.
            </p>
          ) : null}
        </section>

        <section className="me-settings-group" aria-label="Included with Plus">
          <div className="me-section-label">Included with Plus</div>
          <div className="me-settings-list">
            {features.map(({ title, copy, href, meta, Icon }) => (
              <Link href={href} key={title} className="me-settings-row">
                <span className="me-settings-icon">
                  <Icon />
                </span>
                <span className="me-settings-copy">
                  <b>{title}</b>
                  <small>{copy}</small>
                </span>
                <span className="me-reach-trail">
                  <span className="me-settings-meta">{meta}</span>
                  <ChevronRight />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="billing-note-card">
          <CheckCircle2 size={18} />
          <p>
            WhatsApp linking lives in{" "}
            <Link href="/me/connections">Connected apps</Link>. Billing only controls whether the Plus channel is
            unlocked.
          </p>
        </section>
      </div>
    </NuraShell>
  );
}
