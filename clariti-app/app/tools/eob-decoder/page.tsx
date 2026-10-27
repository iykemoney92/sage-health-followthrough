import type { Metadata } from "next";
import Link from "next/link";
import { ClaritiShell } from "@/components/clariti-shell";
import { getGuide } from "@/lib/content/guides";
import { getTopic } from "@/lib/content/topics";
import { EOB_DECODER } from "@/lib/content/tools";
import { EobDecoderTool } from "./eob-decoder-tool";
import "../../guides/guides.css";
import "./eob-decoder.css";

// Free tool #3 (marketing/seo-2026-10-26/free-tools-brief.md). Server-rendered
// explainer around a client-only calculator; like /guides it answers before
// sign-in, so it stays out of PROTECTED_PREFIXES in proxy.ts.

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";
const path = `/tools/${EOB_DECODER.slug}`;
const url = `${appUrl}${path}`;

const title = "EOB calculator and decoder: what do you owe? · Clariti";
const description =
  "Free EOB calculator: enter billed, allowed, plan paid, deductible, copay and coinsurance to see what you owe and whether your medical bill matches.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "website",
    siteName: "Clariti",
    title,
    description,
    url: path,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Clariti — understand your health documents" }],
  },
};

const CHECKED = "checked 27 Oct 2026";

const SOURCES = [
  { label: "HealthCare.gov — Allowed amount", url: "https://www.healthcare.gov/glossary/allowed-amount/" },
  { label: "HealthCare.gov — Deductible", url: "https://www.healthcare.gov/glossary/deductible/" },
  { label: "HealthCare.gov — Copayment", url: "https://www.healthcare.gov/glossary/co-payment/" },
  { label: "HealthCare.gov — Coinsurance", url: "https://www.healthcare.gov/glossary/co-insurance/" },
  { label: "HealthCare.gov — Balance billing", url: "https://www.healthcare.gov/glossary/balance-billing/" },
  { label: "HealthCare.gov — Claim", url: "https://www.healthcare.gov/glossary/claim/" },
  { label: "CMS.gov — Medical bill rights (No Surprises Act)", url: "https://www.cms.gov/medical-bill-rights" },
  {
    label: "CMS.gov — Know your medical bill rights when using insurance",
    url: "https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/know-your-rights/insurance",
  },
];

const FAQS = [
  {
    question: "How do I calculate what I owe from my EOB?",
    answer:
      "Add the amounts applied to your deductible, copay and coinsurance, plus anything marked not covered. That total is your patient responsibility, and it should match the provider’s bill. Plan paid plus your deductible, copay and coinsurance should equal the allowed amount.",
  },
  {
    question: "Why is my medical bill higher than my EOB?",
    answer:
      "The bill may have been sent before the claim finished processing, the provider may be billing you for the difference between its charge and the allowed amount (balance billing), or there may be a coding or billing error. Ask for an itemized bill and ask your insurer whether the claim is final.",
  },
  {
    question: "Can an in-network provider bill me more than my EOB says?",
    answer:
      "HealthCare.gov says a preferred (in-network) provider may not balance bill you for covered services. If the claim is final and the bill is still higher, ask the provider why and tell your insurer.",
  },
  {
    question: "When does the No Surprises Act protect me?",
    answer:
      "CMS says it protects most people with private insurance from unexpected out-of-network bills for emergency room visits, non-emergency care linked to a visit to an in-network hospital, hospital outpatient department or ambulatory surgical center, and air ambulance services. The help desk is 1-800-985-3059.",
  },
  {
    question: "Does this EOB decoder send my figures anywhere?",
    answer:
      "No. The arithmetic and the paste box both run in your browser, nothing is stored, and no AI reads your text. Close the page and the figures are gone.",
  },
];

const RELATED = EOB_DECODER.guides.map((slug) => getGuide(slug) ?? getTopic(slug)).filter((guide) => guide !== undefined);

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Clariti EOB decoder",
    url,
    description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (runs in the browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": "https://zapxlabs.com/#organization", "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
    isPartOf: { "@id": `${appUrl}/#app` },
    citation: SOURCES.map((source) => source.url),
  },
  {
    // Built from the FAQ list rendered below, word for word.
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Clariti", item: `${appUrl}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${appUrl}/guides` },
      { "@type": "ListItem", position: 3, name: "EOB decoder", item: url },
    ],
  },
];

export default function EobDecoderPage() {
  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="guide-page">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/guides">Guides</Link> <span aria-hidden="true">/</span> <span>free tool</span>
        </nav>
        <p className="clariti-kicker">FREE TOOL · NO SIGN-UP</p>
        <h1>EOB decoder: what do you owe, and does the bill match?</h1>
        <p className="guide-answer">
          Type in the figures from one line of your explanation of benefits (EOB). The decoder explains each number, adds up
          what you may owe — deductible + copay + coinsurance + anything not covered — checks the figures agree, and tells
          you whether the provider’s bill matches. It runs on your device; nothing is sent or saved.
        </p>

        <EobDecoderTool />

        <h2>How to use it</h2>
        <ol className="eob-steps">
          <li>
            Find one claim line on your EOB — one date of service and one provider. An EOB can list several lines; decode
            them one at a time.
          </li>
          <li>
            Copy the amounts into the boxes: amount billed, allowed amount, plan paid, and the parts of your share. Leave a
            box empty if the EOB doesn’t show it. Or open “Paste text from your EOB”, paste the text from your insurer’s
            portal, and check every figure it fills.
          </li>
          <li>
            If you have the provider’s bill, enter its amount due, and say whether the provider was in-network and where the
            care happened.
          </li>
          <li>Press Decode. Anything that doesn’t add up, or a bill that asks for more, is flagged with what to ask.</li>
        </ol>

        <h2>How the numbers are worked out</h2>
        <p>
          Your share starts from the allowed amount, not the billed amount. HealthCare.gov defines the allowed amount as the
          maximum a plan will pay for a covered service, also called the negotiated rate. For an in-network provider, the gap
          between the billed amount and the allowed amount is usually a discount you don’t pay.
        </p>
        <p>
          Within the allowed amount, the EOB splits the cost between the plan and you. Your part is made of the
          deductible (what you pay before the plan starts to pay), a copay (a fixed amount, such as $30) and coinsurance (a
          percentage, such as 20%). The decoder checks that <b>plan paid + deductible + copay + coinsurance = allowed amount</b>,
          allowing a cent for rounding. Some EOBs count a not-covered amount inside the allowed amount and some show it
          separately, so both layouts are accepted.
        </p>
        <p>
          Then it adds <b>deductible + copay + coinsurance + not covered</b> to get your patient responsibility, and
          compares that with the total printed on the EOB if you entered it. The figure the bill is compared with is the
          EOB’s printed total when you give one, otherwise the sum of the parts.
        </p>

        <h2>When the bill asks for more than the EOB</h2>
        <p>A bill higher than the EOB’s patient responsibility usually means one of three things:</p>
        <ul className="guide-checks">
          <li>
            <b>The claim was still being processed.</b> Providers sometimes bill before the insurer’s payment and discount are
            applied — a bill for the full charge is the giveaway. Ask the billing office to check your account against the
            EOB.
          </li>
          <li>
            <b>Balance billing.</b> HealthCare.gov describes this as a provider billing you for the difference between its
            charge and the allowed amount. It says a preferred (in-network) provider may not balance bill you for covered
            services.
          </li>
          <li>
            <b>A coding or billing error.</b> A wrong code, date or a duplicate line can push the bill up. Ask for an itemized
            bill and compare it line by line with the EOB.
          </li>
        </ul>
        <p>
          For out-of-network care, the federal No Surprises Act may apply. CMS says it protects most people with private
          insurance from unexpected out-of-network bills for emergency room visits, for non-emergency care related to a
          visit to an in-network hospital, hospital outpatient department or ambulatory surgical center, and for air
          ambulance services. In most of those cases you can’t be charged more than your in-network cost-sharing. CMS lists
          exceptions — ground ambulances, and protections given up by signing a notice and consent form among them — and
          runs a help desk on 1-800-985-3059.
        </p>

        <h2>What this tool doesn’t do</h2>
        <p>
          It doesn’t know your plan, so it can’t tell whether a service should have been covered, whether a deductible was
          applied correctly, or what your plan’s coinsurance rate is. It reads only the figures you give it, and the paste
          box only finds amounts written next to a label on the same line. It can’t decide whether a law applies to your
          bill; your insurer and CMS can.
        </p>

        <h2>Common questions</h2>
        <dl className="guide-faq">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <dt>{faq.question}</dt>
              <dd>{faq.answer}</dd>
            </div>
          ))}
        </dl>

        <h2>Sources</h2>
        <p className="guide-aside">Definitions and rules on this page come from these official pages, {CHECKED}.</p>
        <ul className="guide-related">
          {SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener" target="_blank">
                {source.label}
              </a>{" "}
              <small>({CHECKED})</small>
            </li>
          ))}
        </ul>

        <h2>Related guides</h2>
        <ul className="guide-related">
          {RELATED.map((guide) => (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`}>{guide.metaTitle}</Link>
            </li>
          ))}
        </ul>

        <footer className="guide-foot">
          General information, not insurance or legal advice. The decoder does arithmetic on the figures you enter; your plan
          documents and your insurer have the final word on what you owe. Clariti is made by{" "}
          <a href="https://zapxlabs.com/products/clariti">Zapx Labs</a>.
        </footer>
      </article>
    </ClaritiShell>
  );
}
