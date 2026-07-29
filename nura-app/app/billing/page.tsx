import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, MessageCircle, Mic, Settings, Sparkles } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { hasBillingPortalConfig } from "@/lib/billing/revenuecat";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const features = [
  { title: "Voice notes", copy: "Speak naturally and let Nura turn it into useful context.", Icon: Mic },
  { title: "WhatsApp follow-up", copy: "Send updates from WhatsApp and keep Threads moving.", Icon: MessageCircle },
  { title: "More Threads", copy: "Track multiple health and life follow-through areas at once.", Icon: CheckCircle2 },
];

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
  const access = user ? await getSubscriptionAccess(supabase, user.id) : null;
  const params = searchParams ? await searchParams : {};
  const manageNotice = params.manage === "unavailable";
  const portalConfigured = hasBillingPortalConfig();
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  const avatarUrl = getUserAvatarUrl(user);
  const trialEnds = formatDate(access?.trialEndsAt ?? null);
  const paidUntil = formatDate(access?.currentPeriodEndsAt ?? null);

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page billing-page">
        <Link href="/me" className="back-link"><ArrowLeft /> Me</Link>
        <header className="billing-hero">
          <span className="settings-hero-icon"><Sparkles /></span>
          <div>
            <small>NURA PLUS</small>
            <h1>Keep Nura following through for you.</h1>
            <p>Plus unlocks voice notes, WhatsApp follow-up, proactive calls, journey steps, and more than one active Thread.</p>
          </div>
        </header>

        <section className="billing-panel">
          <div>
            <small>Current access</small>
            <h2>{access?.hasPlus ? "Plus active" : access?.status === "trialing" ? "Trial active" : "Free"}</h2>
            <p>
              {access?.status === "trialing" && trialEnds
                ? `Your trial runs until ${trialEnds}.`
                : paidUntil
                  ? `Your paid access runs until ${paidUntil}.`
                  : "Upgrade when you are ready to use the production follow-up channels."}
            </p>
            {manageNotice ? (
              <p className="billing-notice">Billing management needs a Stripe or RevenueCat portal key before it can open here.</p>
            ) : null}
          </div>
          <div className="billing-actions">
            <a href="/api/billing/checkout" className="primary-cta"><CreditCard /> Upgrade to Plus</a>
            {portalConfigured ? (
              <a href="/api/billing/portal" className="secondary-cta"><Settings /> Manage billing</a>
            ) : (
              <span className="secondary-cta billing-disabled"><Settings /> Manage billing</span>
            )}
          </div>
        </section>

        <section className="billing-features">
          {features.map(({ title, copy, Icon }) => (
            <article key={title}>
              <Icon />
              <div>
                <b>{title}</b>
                <span>{copy}</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </NuraShell>
  );
}
