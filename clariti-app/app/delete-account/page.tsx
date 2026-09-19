import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/integrations/resend";
import "../legal.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to permanently delete your Clariti account and every document it holds, in about a minute from inside the app.",
};

const LAST_UPDATED = "September 19, 2026";

type Section = {
  title: string;
  body: string[];
  points?: string[];
  callout?: string;
  /** A link out of the page, rendered in the callout box so it reads as the route to take. */
  action?: { href: string; label: string };
};

const sections: Section[] = [
  {
    title: "Delete it yourself, in about a minute",
    body: [
      "Open Clariti, go to Settings, scroll to Your data and choose Delete account. Type DELETE to confirm and the deletion runs there and then — no waiting period, no request to file, and no way to undo it.",
      "The link below takes you straight there, and asks you to sign in first if you are signed out.",
    ],
    action: { href: "/settings", label: "Open Settings → Your data" },
  },
  {
    title: "If you cannot sign in",
    body: [
      "Reset your password rather than writing to us: the sign-in screen emails a reset link to the address on the account, and once you are back in, the deletion above is immediate and in your own hands.",
      `If you have lost that mailbox too, write to ${SUPPORT_EMAIL} with the subject "Delete my account" and enough detail to identify the account. We check that the request comes from the account holder before deleting anything, so this is slower than doing it yourself — use it only when the two routes above are closed to you.`,
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
    body: [
      "Individual documents and their analyses can be deleted at any time from History, and Export all data in Settings gives you a copy first.",
      "If what you want is to stop Clariti sending documents to the AI model, withdraw that consent in Settings under Privacy & support. Nothing further is analysed until you agree again, and your account and everything in it stays.",
    ],
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
          Deleting your account removes every document Clariti holds for you, immediately and permanently. You do it
          yourself, from inside the app, without asking anyone. Here is where the control is, and exactly what happens
          when you use it.
        </p>
        <small>Last updated {LAST_UPDATED}</small>
      </section>

      <section className="legal-body">
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.action ? (
              <p className="legal-callout">
                <Link href={section.action.href}>{section.action.label}</Link>
              </p>
            ) : null}
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
