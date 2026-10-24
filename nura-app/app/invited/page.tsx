import Link from "next/link";
import { cookies } from "next/headers";
import { Gift } from "lucide-react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { NuraLogo } from "@/components/nura-logo";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { FRIEND_PLUS_DAYS, lookupReferralCode, REFERRAL_COOKIE } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Where an invite link lands (/r/<code> sets the cookie and redirects here). Public on purpose,
 * and it shows nothing about the person who shared it beyond their first name.
 */
export default async function InvitedPage({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const [{ invalid }, cookieStore, user] = await Promise.all([searchParams, cookies(), getSessionUser()]);
  const owner = invalid ? null : await lookupReferralCode(getSupabaseAdminClient(), cookieStore.get(REFERRAL_COOKIE)?.value).catch(() => null);

  const status = !owner ? "invalid" : user ? "signed_in" : "valid";
  const name = owner?.firstName ?? "";

  const heading =
    status === "valid"
      ? `${name} has given you ${FRIEND_PLUS_DAYS} days of Nura Plus`
      : status === "signed_in"
        ? "You already have a Nura account"
        : "This invite link isn't valid";

  const body =
    status === "valid"
      ? "Nura helps you keep on top of appointments, medicines and follow-ups between visits, with check-in calls, WhatsApp reminders and a plan you can share with family. Everything in Plus is free for 30 days, and you don't need a card."
      : status === "signed_in"
        ? "Invite gifts are for new Nura accounts, so there's nothing to add here. Carry on where you left off."
        : "Check the link you were sent, or start with Nura's usual free trial.";

  return (
    <main className="join-page">
      <AnalyticsBeacon event="referral_landing" params={{ status }} />
      <header className="join-brand">
        <NuraLogo compact href="/" />
      </header>
      <section className="join-card">
        <span className="join-icon" aria-hidden="true">
          <Gift />
        </span>
        <span className="auth-kicker">{status === "valid" ? `A GIFT FROM ${name.toUpperCase()}` : "NURA"}</span>
        <h1>{heading}</h1>
        <p>{body}</p>
        <div className="join-actions">
          {status === "signed_in" ? (
            <Link href="/today" className="primary-cta">
              Go to Today
            </Link>
          ) : (
            <>
              <Link href="/signup" className="primary-cta">
                {status === "valid" ? "Get started free" : "Get started"}
              </Link>
              <Link href="/login" className="secondary-cta">
                I already have an account
              </Link>
            </>
          )}
          {status === "valid" ? (
            <small>
              {`After ${FRIEND_PLUS_DAYS} days you can carry on with the free plan or choose Plus. Nothing is charged unless you decide to.`}
            </small>
          ) : null}
        </div>
        <p className="join-footnote">
          Nura is a follow-through companion, not a medical service. Read how{" "}
          <Link href="/data-use">data is used</Link> and the <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </main>
  );
}
