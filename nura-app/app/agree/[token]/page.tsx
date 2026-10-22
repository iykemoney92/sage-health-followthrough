import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { AgreeActions } from "@/components/agree-actions";
import { previewConsent } from "@/lib/care-recipient-admin";

export const dynamic = "force-dynamic";

/**
 * Where someone an owner cares for agrees (or not) to Nura's check-in calls. Public on purpose:
 * they have no account and the link itself is the secret. The page says plainly who set it up,
 * which number Nura would call, what the calls are, and how to stop them - the wording here is
 * what CONSENT_COPY_VERSION records, so bump that whenever it changes.
 */
export default async function AgreePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewConsent(token);

  if (preview.status === "invalid") {
    return (
      <main className="join-page agree-page">
        <header className="join-brand">
          <NuraLogo compact href="/" />
        </header>
        <section className="join-card">
          <h1>This link isn&apos;t working</h1>
          <p>Ask the person who sent it to you for a new one.</p>
        </section>
      </main>
    );
  }

  const { recipientFirstName, ownerFirstName, planTitle, phoneMasked } = preview;

  return (
    <main className="join-page agree-page">
      <header className="join-brand">
        <NuraLogo compact href="/" />
      </header>
      <section className="join-card">
        <span className="join-icon" aria-hidden="true">
          <PhoneCall />
        </span>
        <h1>Hi {recipientFirstName}</h1>
        <p>
          {ownerFirstName} would like Nura to give you a short phone call now and then about{" "}
          <b>{planTitle}</b>, so they know how you&apos;re getting on.
        </p>
        <ul className="agree-points">
          <li>Nura is an automated assistant, not a person or a doctor.</li>
          <li>It would call your number ending {phoneMasked.replace(/•/g, "")}, during the day.</li>
          <li>It asks how things are going and passes a short summary to {ownerFirstName}.</li>
          <li>Calls may be recorded so Nura can keep track of what was said.</li>
          <li>You can say &ldquo;stop&rdquo; on any call, or come back to this page, and the calls end.</li>
        </ul>
        <p className="agree-question">Is that OK with you?</p>
        <AgreeActions
          token={token}
          initialStatus={preview.status}
          recipientFirstName={recipientFirstName}
          ownerFirstName={ownerFirstName}
        />
        <p className="join-footnote">
          Nura is a follow-through companion, not a medical service. In an emergency, call your local emergency number. Read
          how <Link href="/data-use">data is used</Link> and the <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </main>
  );
}
