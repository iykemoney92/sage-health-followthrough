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
export default async function InvitedPage({ searchParams }: { searchParams: Promise<{ invalid?: string; own?: string }> }) {
  const [{ invalid, own }, cookieStore, user] = await Promise.all([searchParams, cookies(), getSessionUser()]);
  // /r/<code> sends the link's owner here with own=1 and no cookie, so there's no owner to look up.
  const isOwnLink = Boolean(own && user);
  const owner =
    invalid || isOwnLink ? null : await lookupReferralCode(getSupabaseAdminClient(), cookieStore.get(REFERRAL_COOKIE)?.value).catch(() => null);

  const status = isOwnLink ? "own_link" : !owner ? "invalid" : user ? "signed_in" : "valid";
  const name = owner?.firstName ?? "";

  const heading =
    status === "valid"
      ? `${name} has given you ${FRIEND_PLUS_DAYS} days of Nura Plus`
      : status === "own_link"
        ? "This is your own invite link"
        : status === "signed_in"
          ? "You already have a Nura account"
          : "This invite link isn't valid";

  const body =
    status === "valid"
      ? "Nura helps you keep on top of appointments, medicines and follow-ups between visits, with check-in calls, WhatsApp reminders and a plan you can share with family. Everything in Plus is free for 30 days, and you don't need a card."
      : status === "own_link"
        ? `Share it with friends: anyone who makes a new Nura account through it gets ${FRIEND_PLUS_DAYS} days of Nura Plus. Opening it yourself doesn't change anything.`
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
          {status === "own_link" ? (
            <Link href="/me" className="primary-cta">
              Back to Me
            </Link>
          ) : status === "signed_in" ? (
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
