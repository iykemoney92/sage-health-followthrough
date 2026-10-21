import Link from "next/link";
import { MailX } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { StopCircleEmailsButton } from "@/components/stop-circle-emails-button";
import { readStopEmailsToken } from "@/lib/care-circle-email";

export const dynamic = "force-dynamic";

/**
 * Where "Stop these emails" in a Care circle email lands. Public: the signed link is the proof.
 * Nothing changes until the button is pressed, so link scanners can't unsubscribe anyone.
 */
export default async function StopCircleEmailsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = Boolean(readStopEmailsToken(token));

  return (
    <main className="join-page">
      <header className="join-brand">
        <NuraLogo compact href="/" />
      </header>
      <section className="join-card">
        <span className="join-icon" aria-hidden="true">
          <MailX />
        </span>
        <span className="auth-kicker">CARE CIRCLE EMAILS</span>
        <h1>{valid ? "Stop emails about this Care plan?" : "This link isn't valid"}</h1>
        <p>
          {valid
            ? "You'll stay in the Care circle and can still see the plan in Nura. You just won't get the weekly update or missed check-in emails for it. You can turn them back on from the plan page."
            : "Check the link in your email, or turn emails off from the Care plan page in Nura."}
        </p>
        {valid && <StopCircleEmailsButton token={token} />}
        <p className="join-footnote">
          Read the <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </main>
  );
}
