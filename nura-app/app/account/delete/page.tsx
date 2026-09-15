import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { NuraLogo } from "@/components/nura-logo";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export const metadata: Metadata = {
  title: "Delete account",
  description: "Permanently delete your Nura account and everything it holds.",
};

/**
 * Account deletion on its own page.
 *
 * App Review rejected 1.0 under Guideline 5.1.1(v) because the reviewer could
 * not find deletion: it lived at the bottom of Me → Data & export. This page
 * is linked as a plain "Delete account" row on Me, and from the trial-lock
 * and AI-consent screens, and middleware lets a signed-in user reach it
 * whatever state their account is in — no consent, expired trial, or
 * unfinished onboarding. Deleting an account must never be gated behind
 * agreeing to something first.
 */
export default async function DeleteAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/delete");
  const back = user.user_metadata?.onboarding_complete === true ? "/me" : "/onboarding";

  return (
    <main className="billing-lock-page">
      <div className="billing-lock-shell">
        <NuraLogo />
        <div className="billing-lock-card" role="region" aria-labelledby="delete-account-title">
          <span className="billing-lock-icon" aria-hidden="true">
            <Trash2 size={22} strokeWidth={2.2} />
          </span>
          <span className="auth-kicker">YOUR ACCOUNT</span>
          <h1 id="delete-account-title">Delete your account</h1>
          <p>
            This permanently deletes your Nura account and everything in it: Care plans, messages, check-ins,
            uploaded notes and documents, and your sign-in. It happens immediately and cannot be undone.
          </p>
          <p>
            Signed in as <strong>{user.email}</strong>.
          </p>
          <DeleteAccountButton />
          <Link href={back} className="secondary-cta billing-lock-secondary">
            <ArrowLeft size={16} /> Keep my account
          </Link>
        </div>
      </div>
    </main>
  );
}
