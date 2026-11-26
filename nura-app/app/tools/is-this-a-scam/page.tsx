import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { getGuide } from "@/lib/guides";
import { SCAM_CHECKER_TOOL, toolSignupHref } from "@/lib/tools";
import { GuideChrome, GuideDisclaimer } from "../../guides/guide-chrome";
import { ScamChecker } from "./scam-checker";
import "../tools-large.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";
const path = `/tools/${SCAM_CHECKER_TOOL.slug}`;
const url = `${appUrl}${path}`;

// The layout adds " · Nura".
const title = "Is this a scam? Free scam message and call checker";
const description =
  "Is this a scam? Paste a text, email or WhatsApp message, or describe a call, and see the warning signs and who to tell. Free, and nothing is sent.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { url: path, title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const CHECKED = "checked 26 November 2026";

/** Each opened and read on 26 November 2026; only details these pages state are used. */
const SOURCES = [
  { label: "NCSC: Report a scam text message (7726)", url: "https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-text-message" },
  { label: "NCSC: Report a scam email (report@phishing.gov.uk)", url: "https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-email" },
  { label: "NCSC: Report a scam phone call", url: "https://www.ncsc.gov.uk/collection/phishing-scams/report-scam-call" },
  {
    label: "GOV.UK: Report Fraud, new service from City of London Police",
    url: "https://www.gov.uk/government/news/report-fraud-new-service-from-city-of-london-police",
  },
  { label: "FCA: Banking and online account scams", url: "https://www.fca.org.uk/consumers/banking-online-account-scams" },
  { label: "Stop Scams UK: 159", url: "https://stopscamsuk.org.uk/159" },
  { label: "Take Five to Stop Fraud: Protect yourself", url: "https://www.takefive-stopfraud.org.uk/advice/general-advice/" },
  {
    label: "Citizens Advice: Contact the consumer service",
    url: "https://www.citizensadvice.org.uk/consumer/get-more-help/if-you-need-more-help-about-a-consumer-issue/",
  },
  { label: "Citizens Advice: What to do if you've been scammed", url: "https://www.citizensadvice.org.uk/consumer/scams/what-to-do-if-youve-been-scammed/" },
  { label: "Age UK: AI scams", url: "https://www.ageuk.org.uk/information-advice/money-legal/scams-fraud/ai-scams/" },
  { label: "Age UK: Phone scams", url: "https://www.ageuk.org.uk/information-advice/money-legal/scams-fraud/phone-scams/" },
  { label: "Age UK: Scams advice", url: "https://www.ageuk.org.uk/information-advice/money-legal/scams-fraud/" },
  { label: "FTC: How to recognize and report spam text messages", url: "https://consumer.ftc.gov/articles/how-recognize-and-report-spam-text-messages" },
  { label: "FTC: What to do if you were scammed", url: "https://consumer.ftc.gov/articles/what-do-if-you-were-scammed" },
];

const FAQS = [
  {
    q: "How can I tell if a message is a scam?",
    a: "Look for pressure to act fast, a request for money, gift cards, crypto, bank details or a one-time code, a link or number you're asked to use, and someone claiming to be your bank, HMRC, the IRS, the police, a delivery firm or a relative on a new number. Paste the message into the checker to see which of these signs it has.",
  },
  {
    q: "Does the checker send my message anywhere?",
    a: "No. It runs entirely in your browser on this device. There is no AI and no server step, and nothing you paste is saved. Closing the page clears it.",
  },
  {
    q: "Can the checker tell me a message is genuine?",
    a: "No. It can only point out common warning signs. Some scams look completely normal, so the best it will say is that it found no common signs. If a message asks for money, a code or your details, check with the organisation using contact details you find yourself.",
  },
  {
    q: "I've already paid or given my bank details. What should I do?",
    a: "Contact your bank straight away using the number on your card or statement. In the UK, 159 connects you to most banks, and you can report it to Report Fraud at reportfraud.police.uk or on 0300 123 2040 (Police Scotland on 101 in Scotland). In the US, report it to your bank and at ReportFraud.ftc.gov.",
  },
  {
    q: "Where do I forward a scam text or email?",
    a: "In the UK, forward scam texts to 7726 and suspicious emails to report@phishing.gov.uk. In the US, forward scam texts to 7726 (SPAM) and report them at ReportFraud.ftc.gov.",
  },
  {
    q: "How can I help an older parent avoid scams?",
    a: "Agree a family safe phrase that only you know and never share it by text or online, and agree that anyone asking for money gets a call back on a number you already have. Age UK suggests both. Talk about common scams without blame, so they feel able to check with you first.",
  },
];

const RELATED = [
  "worried-about-elderly-parent-living-alone",
  "how-to-check-on-an-elderly-parent-who-lives-alone",
  "caring-for-a-parent-from-a-distance",
  "how-to-help-a-lonely-elderly-parent",
]
  .map((slug) => getGuide(slug))
  .filter((g) => g !== null);

export default function ScamCheckerPage() {
  const signupHref = toolSignupHref(SCAM_CHECKER_TOOL);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        url,
        name: "Is this a scam? Scam message and call checker",
        description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any (runs in a web browser)",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
        publisher: { "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
        isPartOf: { "@id": "https://usenura.app/#website" },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "Free tools", item: `${appUrl}/tools` },
          { "@type": "ListItem", position: 3, name: "Is this a scam?", item: url },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="tool" signupHref={signupHref}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main tool-main tool-large">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <Link href="/tools">Free tools</Link>
          <span aria-hidden="true">/</span>
          <span>Is this a scam?</span>
        </nav>

        <span className="guide-kicker">Free tool</span>
        <h1>Is this a scam? Check a message or call</h1>
        <p className="guide-lead">
          Paste a text, email, WhatsApp or social media message, or describe a phone call, and answer a few quick
          questions. You&apos;ll see the common warning signs it has, the words that raised them, and who to tell.
          It&apos;s free, there&apos;s no sign-up, and nothing you type leaves this device.
        </p>
        <p className="tool-safety">
          If you&apos;ve already paid, or shared bank details or a code, contact your bank now on the number on your
          card or statement. In the UK you can also call 159.
        </p>

        <div className="tool-app ph-mask ph-sensitive">
          <ScamChecker />
        </div>

        <article>
          <section className="guide-section" id="next-steps" aria-labelledby="next-steps-heading">
            <h2 id="next-steps-heading">What to do next</h2>
            <p>
              Whatever the checker says: don&apos;t reply, don&apos;t tap links, and don&apos;t call a number from the
              message. If it might be real, contact the person or company yourself on a number or website you already
              know.
            </p>

            <h3>If you&apos;ve paid, or shared bank details or a code</h3>
            <ul className="tool-tips">
              <li>
                <b>Tell your bank immediately</b>, using the contact details on your card or statements, as the FCA
                advises. In the UK, 159 connects you to most banks&apos; fraud teams and, according to Stop Scams UK,
                can&apos;t be spoofed.
              </li>
              <li>
                <b>Report it to the police.</b> In England, Wales and Northern Ireland, use Report Fraud (which replaced
                Action Fraud in December 2025) at{" "}
                <a href="https://www.reportfraud.police.uk/" target="_blank" rel="noopener noreferrer">
                  reportfraud.police.uk
                </a>{" "}
                or call 0300 123 2040. In Scotland, call Police Scotland on 101.
              </li>
              <li>
                <b>If you feel threatened or unsafe</b>, call 999 (UK) or 911 (US).
              </li>
            </ul>

            <h3>In the UK</h3>
            <ul className="tool-tips">
              <li>
                <b>Scam text:</b> forward it to <b>7726</b>. It&apos;s free.
              </li>
              <li>
                <b>Suspicious email:</b> forward it to <b>report@phishing.gov.uk</b>.
              </li>
              <li>
                <b>Unexpected call about your money:</b> hang up and call <b>159</b>, or the number on your card. Age
                UK suggests using a different phone or waiting 10 to 15 minutes, in case the line is still open.
              </li>
              <li>
                <b>Advice:</b> the Citizens Advice consumer helpline is <b>0808 223 1133</b> (England), or{" "}
                <b>0808 223 1144</b> for a Welsh-speaking adviser. Age UK&apos;s free Advice Line is{" "}
                <b>0800 678 1602</b>, 8am to 7pm, every day of the year.
              </li>
            </ul>

            <h3>In the US</h3>
            <ul className="tool-tips">
              <li>
                <b>Scam text:</b> forward it to <b>7726 (SPAM)</b>, and use your messaging app&apos;s report-junk
                option.
              </li>
              <li>
                <b>Report it</b> to the Federal Trade Commission at{" "}
                <a href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener noreferrer">
                  ReportFraud.ftc.gov
                </a>
                .
              </li>
              <li>
                <b>If you paid:</b> the FTC says to contact your bank, credit union or card issuer immediately and ask
                for a refund; for a gift card, call the number on the back of the card; for crypto, contact the
                exchange or ATM operator.
              </li>
            </ul>

            <h3>Anywhere else</h3>
            <ul className="tool-tips">
              <li>Stop. Don&apos;t reply, tap, call back or pay while you check.</li>
              <li>Contact your bank on the number on your card if money or bank details are involved.</li>
              <li>Check with the person or organisation using details you find yourself.</li>
              <li>Report it to your local police and your country&apos;s consumer or fraud reporting service.</li>
              <li>Tell someone you trust. Scammers count on people feeling rushed and alone.</li>
            </ul>
          </section>

          <section className="guide-section" aria-labelledby="older-parent-heading">
            <h2 id="older-parent-heading">Helping an older parent spot scams</h2>
            <p>
              Anyone can be caught out, and scammers work hard to sound real. A few habits agreed in advance make it
              easier for a parent to pause and check, without feeling foolish.
            </p>
            <ul className="tool-tips">
              <li>
                <b>Agree a family safe phrase.</b> Age UK suggests a word only close family know, so you can be sure
                it&apos;s really them, and never sharing it by text or online.
              </li>
              <li>
                <b>Always call back on a known number.</b> If &quot;you&quot; message from a new number asking for
                money, they call your old number first. Age UK says it&apos;s fine to hang up and call back on a number
                you already have.
              </li>
              <li>
                <b>Make one simple rule:</b> nobody genuine minds waiting while you check. Age UK advises ignoring any
                caller who asks for personal information such as a PIN.
              </li>
              <li>
                <b>Keep the tone kind.</b> Talk about scams as something that happens to everyone, so they&apos;ll tell
                you if something feels off, or if they&apos;ve already replied.
              </li>
              <li>
                <b>Put the numbers where they&apos;ll see them:</b> 159, the bank&apos;s number from their card, and
                yours, on a note by the phone.
              </li>
            </ul>
          </section>

          <section className="guide-nura" aria-labelledby="tool-nura-heading">
            <h2 id="tool-nura-heading">Someone to talk it through with</h2>
            <p>
              Scams work best when someone feels rushed and on their own. Nura is an AI wellbeing companion that checks
              in by message, WhatsApp or a short phone call at times you choose, and you can tell it what&apos;s going
              on in plain words, by typing or a voice note. It doesn&apos;t check messages for scams and isn&apos;t a
              fraud service: for anything involving money, your bank is the place to go. If you look out for an older
              parent, Nura can also give them a short call now and then, with their agreement, and send you a summary
              of how they&apos;re doing.
            </p>
            <div className="guide-nura-actions">
              <TrackedLink
                href={signupHref}
                className="guide-button"
                event="tool_cta_click"
                eventParams={{ tool: SCAM_CHECKER_TOOL.slug, cta: "get_started", placement: "tool_body" }}
              >
                Try Nura <ArrowRight size={16} aria-hidden="true" />
              </TrackedLink>
              <StoreBadges placement="tool_body" compact utmContent={`tool-${SCAM_CHECKER_TOOL.slug}`} />
            </div>
          </section>

          <section className="guide-section">
            <h2>What happens to what you type</h2>
            <p>
              Nothing leaves your device. The checker is a set of simple rules that run in your browser: there&apos;s no
              AI, no account and no server step, and nothing is saved, so closing the page clears it. It looks for
              patterns that official fraud guidance warns about; it can&apos;t check whether a phone number, website or
              person is real.
            </p>
          </section>

          <section className="guide-section guide-faq">
            <h2>Common questions</h2>
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </section>

          <section className="guide-section guide-sources">
            <h2>Sources</h2>
            <ul>
              {SOURCES.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>{" "}
                  ({CHECKED})
                </li>
              ))}
            </ul>
          </section>

          <GuideDisclaimer />
        </article>

        <section className="guide-section" aria-labelledby="tool-related-heading">
          <h2 id="tool-related-heading">Related guides</h2>
          <ul className="guide-related">
            {RELATED.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/guides/${guide.slug}`}>
                  <b>{guide.question}</b>
                  <small>{guide.description}</small>
                </Link>
              </li>
            ))}
          </ul>
          <p className="guide-all">
            <Link href="/tools">All free tools →</Link>
          </p>
        </section>
      </main>
    </GuideChrome>
  );
}
