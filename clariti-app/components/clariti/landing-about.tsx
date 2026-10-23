import Link from "next/link";
import { FREE_DOCUMENT_LIMIT } from "@/lib/billing/subscription";
import { GUIDES } from "@/lib/content/guides";

// Server-rendered on purpose: this is the part of "/" a search engine reads.
// Every claim here is one the product makes elsewhere — llms.txt, the billing
// page, the example — so keep them in step when any of those change.

export const LANDING_DOCUMENTS = [
  {
    title: "Medical bills",
    copy: "Each charge in everyday words, which fees look odd, and what to check before you pay.",
  },
  {
    title: "Insurance EOBs",
    copy: "What was billed, what your plan allowed and paid, and what is left to you — and why an EOB is not a bill.",
  },
  {
    title: "Lab results",
    copy: "What each marker measures, where your number sits against the range printed on the report, and what to ask next.",
  },
  {
    title: "Radiology reports",
    copy: "Findings and anatomy words from an X-ray, CT, MRI or ultrasound report, with questions to take to your doctor.",
  },
  {
    title: "Discharge summaries",
    copy: "Why you were there, which medicines changed, and the follow-up you were asked to arrange.",
  },
  {
    title: "Medication lists",
    copy: "Names, doses and timings in plain language, with questions for your pharmacist.",
  },
];

export const LANDING_FAQS = [
  {
    question: "What does Clariti do?",
    answer:
      "Clariti reads one health document at a time — a medical bill, insurance EOB, lab result, scan report, discharge summary or medication list — and explains it in plain language. It then suggests questions to ask your doctor, pharmacist or insurer.",
  },
  {
    question: "Can Clariti diagnose me or tell me what treatment to have?",
    answer:
      "No. Clariti explains what your paperwork says. It does not diagnose, recommend treatment, or replace advice from your doctor, pharmacist or insurer.",
  },
  {
    question: "How do I give Clariti a document?",
    answer:
      "Attach a PDF or image, take a photo of the paper in your hand, or paste the text. Clariti works from the document you give it.",
  },
  {
    question: "Is Clariti free?",
    answer: `Your first ${FREE_DOCUMENT_LIMIT} document analyses are free. Clariti Plus removes the limit.`,
  },
  {
    question: "What is the difference between an EOB and a medical bill?",
    answer:
      "An explanation of benefits (EOB) comes from your insurer and shows what was billed, what the plan covered and what may be left to you. It is not a request for payment. The bill comes from the provider. Clariti can explain both and help you check that they match.",
  },
  {
    question: "Can I delete my documents?",
    answer: "Yes. You can export or delete your documents and your account from Settings at any time.",
  },
];

export function LandingAbout() {
  return (
    <section className="clariti-about" aria-labelledby="clariti-about-title">
      <div className="clariti-about-inner">
        <h2 id="clariti-about-title">Health paperwork, explained in plain language</h2>
        <p className="clariti-about-lead">
          Medical documents are written for professionals. Clariti reads the one in front of you and tells you what it
          says, which parts matter, and what to ask next — before you pay a bill, call your insurer, or see your doctor.
        </p>

        <h2>What Clariti explains</h2>
        <ul className="clariti-about-grid">
          {LANDING_DOCUMENTS.map((doc) => (
            <li key={doc.title}>
              <h3>{doc.title}</h3>
              <p>{doc.copy}</p>
            </li>
          ))}
        </ul>

        <h2>How it works</h2>
        <ol className="clariti-about-steps">
          <li>
            <b>Add one document.</b> Attach a PDF or image, take a photo, or paste the text.
          </li>
          <li>
            <b>Read the explanation.</b> A summary first, then each term, figure and charge in everyday words.
          </li>
          <li>
            <b>Take the next step.</b> Clariti suggests questions for your clinician, pharmacist or insurer.
          </li>
        </ol>
        <p>
          <Link href="/example">See a finished example analysis</Link> of an invented MRI report before you upload
          anything of your own.
        </p>

        <h2>Guides</h2>
        <ul className="clariti-about-guides">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`}>{guide.metaTitle}</Link>
            </li>
          ))}
        </ul>

        <h2>Questions people ask</h2>
        <dl className="clariti-about-faq">
          {LANDING_FAQS.map((faq) => (
            <div key={faq.question}>
              <dt>{faq.question}</dt>
              <dd>{faq.answer}</dd>
            </div>
          ))}
        </dl>

        <p className="clariti-about-foot">
          Clariti is made by <a href="https://zapxlabs.com/products/clariti">Zapx Labs</a>.{" "}
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </div>
    </section>
  );
}
