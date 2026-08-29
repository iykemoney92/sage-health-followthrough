import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../legal.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms",
  description: "How Clariti is meant to be used, what it will not do, and the terms that apply to Clariti Plus.",
};

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@useclariti.app";
const LAST_UPDATED = "August 29, 2026";

type Section = {
  title: string;
  body: string[];
  points?: string[];
  callout?: string;
};

const sections: Section[] = [
  {
    title: "What Clariti is",
    body: [
      "Clariti is a consumer health document copilot operated by Zapx Solutions Limited. You upload a medical bill, an insurance EOB, a lab result, a radiology report, or a discharge note, and Clariti explains it in plain English, points at the wording it came from, and helps you decide what to do next.",
      "Using Clariti means agreeing to these terms.",
    ],
  },
  {
    title: "What Clariti is not",
    body: ["Clariti is not a medical device, a clinician, an emergency service, an insurer, or a legal adviser."],
    points: [
      "It does not diagnose, and it does not tell you what a result means for your health.",
      "It does not prescribe or recommend treatment.",
      "It does not decide what your plan covers or what you owe — only a payer can do that.",
      "It is not for emergencies. If something may be urgent, contact emergency or urgent-care services directly.",
    ],
    callout: "Clariti explains and organises your paperwork. It is not a substitute for professional medical, insurance, or legal advice.",
  },
  {
    title: "AI-generated explanations",
    body: [
      "Clariti's explanations, questions, next steps, illustrations, and explainer videos are produced by AI models. They are grounded in the document you uploaded and Clariti shows you the wording each point came from, but they can still be incomplete or wrong.",
      "Read them as a starting point for a conversation with your clinician, your billing office, or your insurer — never as the final word. Check anything that would change a decision.",
    ],
  },
  {
    title: "Eligibility",
    body: ["You must be at least 16 to create a Clariti account. By signing up you confirm the details you give are accurate and that you are old enough to agree to these terms where you live."],
  },
  {
    title: "The documents you upload",
    body: [
      "You keep ownership of everything you upload. You give Clariti permission to process it only so it can produce your explanation and the features you ask for.",
      "Upload only documents that are yours, or that you are authorised to handle on someone else's behalf — a child you are responsible for, or a relative who has asked you to. Do not upload a third party's records without that authority.",
    ],
  },
  {
    title: "Clariti Plus and billing",
    body: [
      "Clariti is free to start: three document analyses and one explainer video. Clariti Plus removes those limits and adds document comparison and email check-ins.",
      "On iPhone and iPad, Plus is sold as an in-app purchase through Apple's App Store. Payment is taken by Apple, the subscription renews automatically until you cancel, and you manage or cancel it in your App Store subscription settings — not in Clariti. On the web, Plus is billed by card through RevenueCat or Stripe. Price, renewal period, and any trial length are shown before you confirm.",
      "Cancelling stops the next renewal. Plus stays active until the end of the period you already paid for. Refunds for App Store purchases are handled by Apple under its own policy.",
    ],
  },
  {
    title: "Acceptable use",
    body: ["Use Clariti for its purpose and nothing else."],
    points: [
      "Do not upload content you have no right to share.",
      "Do not use Clariti to impersonate someone else or to misrepresent a document to a third party.",
      "Do not attempt to disrupt, overload, scrape, or reverse-engineer the service.",
      "Do not use Clariti in a way that breaks the law where you are.",
    ],
  },
  {
    title: "Ending your account",
    body: [
      "You can delete your account at any time from Me, then Your data. Deletion is immediate and permanent: your documents, analyses, chat, generated media, and scheduled check-ins are removed and cannot be restored. Export your data first if you want to keep a copy.",
      "Deleting your account does not on its own cancel an App Store subscription — cancel that in your App Store settings. We may suspend or close accounts that break these terms or applicable law.",
    ],
  },
  {
    title: "Changes and availability",
    body: [
      "Clariti is an actively developed product. Features, providers, limits, and pricing may change, and parts of it can be unavailable while we work on them.",
      "The service is provided as is. We do not promise it will be uninterrupted, error-free, or that any particular document will be readable.",
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      "To the fullest extent the law allows, Clariti and its operators are not liable for indirect, incidental, or consequential losses arising from your use of the service — including any decision made on the strength of an explanation Clariti produced.",
      "Nothing here limits liability that cannot be excluded under the law that applies to you, including liability for death or personal injury caused by negligence.",
    ],
  },
  {
    title: "Changes to these terms",
    body: ["If these terms change, this page changes with them and the date above moves. Continuing to use Clariti after a change means accepting the updated terms."],
  },
  {
    title: "Contact us",
    body: [`Questions about these terms can go to ${SUPPORT_EMAIL}.`],
  },
];

export default function TermsPage() {
  return (
    <main className="clariti-legal-page">
      <header className="legal-nav">
        <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
        <nav className="legal-nav-links" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms" className="is-active" aria-current="page">Terms</Link>
        </nav>
        <Link href="/" className="legal-back"><ArrowLeft /> Back to Clariti</Link>
      </header>

      <section className="legal-hero">
        <span className="clariti-kicker">TERMS</span>
        <h1>Plain terms for confusing paperwork.</h1>
        <p>
          These terms cover what Clariti is for, what it will never claim to do, and how Clariti Plus is billed. They are
          written to be read, not skipped.
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
