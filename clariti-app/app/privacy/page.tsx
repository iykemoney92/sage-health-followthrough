import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../legal.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Clariti collects when you upload a health document, who else processes it, and how to export or delete it.",
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
    title: "What Clariti collects",
    body: ["Clariti holds what you give it and what it makes from that. Nothing else."],
    points: [
      "Your account: the email address you sign up with, a display name if you set one, and the authentication record behind them.",
      "Documents you upload: the file itself — a medical bill, an insurance EOB, a lab result, a radiology report, a discharge note — and the text Clariti reads out of it so it can be explained.",
      "What Clariti produces from a document: the plain-English analysis, key points, questions for your clinician, suggested next steps, any illustrations or explainer video you generate, and the chat that goes with them.",
      "Check-ins you schedule: the email address and time you pick, and which document the check-in is about. Accounts created earlier may still hold a phone number from when check-ins could be called instead of emailed.",
      "Your Clariti Plus status: plan, trial dates, and the subscription identifiers needed to keep it accurate. Clariti never receives your card number.",
      "Optional product analytics: which screens and features get used — and only if you choose Accept on the cookie notice.",
    ],
  },
  {
    title: "What Clariti does with it",
    body: [
      "Your document is read for one purpose: to produce your explanation. The extracted text goes to the model that writes the analysis and the result comes straight back to you and your account.",
      "Your documents, and the analyses built from them, are not used to train AI models — not by us, and not by the providers below, whose terms prohibit it. They are not sold, not shared with advertisers, and not used to build a profile of you.",
    ],
  },
  {
    title: "Who else processes your data",
    body: ["Clariti runs on a small set of providers. Each one receives only what its job needs, and none of them may use your health information for their own purposes."],
    points: [
      "Supabase — the database, sign-in, and file storage that hold your account, documents, and generated media.",
      "Anthropic, reached either directly or through the Vercel AI Gateway — the model that reads your document text and writes the plain-English explanation.",
      "Google's video and image models, reached through the Vercel AI Gateway — used only when you ask for an explainer video or illustration, and only on the analysis Clariti already wrote, not the original file.",
      "Shotstack — stitches generated video scenes into one explainer. It receives short-lived links to those clips, never your document.",
      "Resend — sends account emails and the check-in emails you schedule.",
      "RevenueCat, with Apple's App Store or Stripe behind it — records whether Clariti Plus is active. Payment details stay with Apple or Stripe.",
      "ElevenLabs — the voice explanation call. This is switched off today, so no phone number and no document context reach ElevenLabs while it stays off. If it returns, this policy will say so first.",
      "Vercel — hosting and the ordinary request logs that come with it.",
      "Google Analytics — aggregated product usage, and only after you choose Accept on the cookie notice. Never document contents.",
    ],
  },
  {
    title: "Where it is stored",
    body: [
      "Uploaded files go into a private storage bucket, in a folder named after your account. Generated videos and illustrations go into a second private bucket. Neither is publicly readable — Clariti mints a short-lived signed link each time you open one.",
      "Database rows are protected by row-level security, so a signed-in session can only ever read the rows that belong to it.",
      "The providers above run infrastructure in more than one country, including the United States, so your data may be processed outside the country you live in. Each of them is contractually bound to the transfer safeguards that apply to it.",
    ],
  },
  {
    title: "How long it is kept",
    body: [
      "Clariti keeps your data for as long as your account exists. Deleting your account removes it immediately: documents, extracted text, analyses, chat, saved artifacts, videos, illustrations, scheduled check-ins, and your profile. That deletion is permanent and cannot be reversed.",
      "Encrypted infrastructure backups held by our hosting providers may still contain a copy for a short period until they expire on their normal rotation.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Depending on where you live, you may have the right to access, correct, delete, or receive a portable copy of your data, and to object to or restrict some processing.",
      "Two of those are built into the app. Open Me, then Your data: Export all data gives you everything Clariti holds about you as a JSON file, and Delete account removes it. For anything else, write to us and we will handle it.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "Clariti sets essential cookies to keep you signed in and your session secure. Those cannot be turned off without breaking sign-in.",
      "With your consent it also sets Google Analytics cookies to understand how the product is used — pages opened, device type, and similar signals. These are never used for advertising and never carry your document contents. Choose Essential only or Accept when the cookie notice appears.",
    ],
  },
  {
    title: "HIPAA and medical advice",
    body: [
      "Clariti is a consumer tool you choose to use with your own paperwork. It is not your doctor, your hospital, or your insurer, and it does not act on their behalf.",
      "Clariti explains wording and organises next steps. It does not diagnose, prescribe, or decide what your insurer will pay. Check anything that matters with a qualified professional, and if something may be urgent, contact emergency or urgent-care services rather than Clariti.",
    ],
    callout: "Clariti is not a covered entity or business associate under HIPAA, and is not a substitute for professional medical advice, diagnosis, or treatment.",
  },
  {
    title: "Age requirement",
    body: ["Clariti is built for adults handling their own health paperwork. It is not directed at, and should not be used by, anyone under 16."],
  },
  {
    title: "Changes to this policy",
    body: ["If what Clariti collects or who processes it changes, this page changes with it and the date above moves. Material changes are announced in the app before they take effect."],
  },
  {
    title: "Contact us",
    body: [`Questions about this policy, or a data request that account settings do not cover, can go to ${SUPPORT_EMAIL}.`],
  },
];

export default function PrivacyPage() {
  return (
    <main className="clariti-legal-page">
      <header className="legal-nav">
        <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
        <nav className="legal-nav-links" aria-label="Legal">
          <Link href="/privacy" className="is-active" aria-current="page">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <Link href="/" className="legal-back"><ArrowLeft /> Back to Clariti</Link>
      </header>

      <section className="legal-hero">
        <span className="clariti-kicker">PRIVACY</span>
        <h1>Your documents stay yours.</h1>
        <p>
          Clariti reads the health paperwork you upload so it can explain it back to you in plain English. This page says
          exactly what that means for your data — what is kept, who else touches it, and how to take it back.
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
