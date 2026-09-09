import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../legal.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to permanently delete your Clariti account and every document it holds, from inside the app or by email.",
};

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@useclariti.app";
const LAST_UPDATED = "September 9, 2026";

type Section = {
  title: string;
  body: string[];
  points?: string[];
  callout?: string;
};

const sections: Section[] = [
  {
    title: "Delete from inside the app",
    body: ["Sign in, open Settings, scroll to Your data, and choose Delete account. Confirm once and the deletion runs immediately — there is no waiting period and no way to undo it."],
  },
  {
    title: "Delete by email",
    body: [
      `If you can no longer sign in, email ${SUPPORT_EMAIL} from the address on the account with the subject "Delete my account". We verify that the request comes from the account holder and delete the account within 30 days.`,
    ],
  },
  {
    title: "What is deleted",
    body: ["Everything Clariti holds for you:"],
    points: [
      "your profile and sign-in",
      "every uploaded document and the text extracted from it",
      "analyses, explanations, chat and saved artifacts",
      "explainer videos and illustrations",
      "scheduled follow-ups and check-ins",
      "push-notification registrations",
    ],
  },
  {
    title: "What is kept, and for how long",
    body: [
      "If you subscribed to Clariti Plus, the payment processor (Apple, Google, Stripe or RevenueCat) keeps the transaction record it is legally required to hold; it contains no document contents. Server logs that may reference your account id expire within 30 days. Nothing else is retained.",
    ],
  },
  {
    title: "Delete some data without deleting the account",
    body: ["Individual documents and their analyses can be deleted at any time from History, and Export all data in Settings gives you a copy first."],
  },
];

export default function DeleteAccountPage() {
  return (
    <main className="clariti-legal-page">
      <header className="legal-nav">
        <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
        <nav className="legal-nav-links" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <Link href="/" className="legal-back"><ArrowLeft /> Back to Clariti</Link>
      </header>

      <section className="legal-hero">
        <span className="clariti-kicker">YOUR ACCOUNT</span>
        <h1>Delete your Clariti account.</h1>
        <p>
          Deleting your account removes every document Clariti holds for you, immediately and permanently. Here is how
          to do it, and exactly what happens when you do.
        </p>
        <small>Last updated {LAST_UPDATED}</small>
      </section>

      <section className="legal-body">
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.points ? (
              <ul>
                {section.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            ) : null}
            {section.callout ? <p className="legal-callout">{section.callout}</p> : null}
          </article>
        ))}
      </section>

      <footer className="legal-footer">
        <span>© 2026 Zapx Solutions Limited. Clariti is a product of Zapx Solutions Limited.</span>
        <nav aria-label="Legal links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
        </nav>
      </footer>
    </main>
  );
}
