/**
 * /faq — every question about Clariti itself in one place (SEO 1M playbook, 16 Nov 2026:
 * "build and index FAQs for all products"). The page and its FAQPage JSON-LD are
 * both built from this list, so they can't drift apart.
 *
 * Every answer has to be true of the live product. Where each fact comes from:
 * - free allowances: FREE_DOCUMENT_LIMIT / FREE_VIDEO_LIMIT (lib/billing/subscription.ts),
 *   FREE_CHECK_IN_LIMIT (app/api/follow-ups/route.ts), FREE_COMPARISON_LIMIT and its
 *   30-day window (app/api/compare/route.ts);
 * - web trial: CARD_TRIAL_DAYS (lib/billing/trial.ts), used by app/api/billing/checkout;
 * - plans and cancelling: app/billing/page.tsx (no prices printed on purpose — the
 *   store shows the local price, so this page doesn't name one either);
 * - files: the attach inputs in app/home-entry.tsx and MAX_UPLOAD_BYTES
 *   (lib/domain/clariti-uploads.ts);
 * - document kinds: claritiDocumentKindSchema (lib/ai/clariti-analysis.ts);
 * - privacy and providers: app/privacy/page.tsx.
 * Informational only: nothing here tells anyone what they owe, what to pay or what
 * treatment to have.
 */

import { FREE_DOCUMENT_LIMIT, FREE_VIDEO_LIMIT } from "@/lib/billing/subscription";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { MAX_UPLOAD_BYTES } from "@/lib/domain/clariti-uploads";

/** Mirrors FREE_CHECK_IN_LIMIT in app/api/follow-ups/route.ts (route files can't export it). */
const FREE_CHECK_INS = 3;
/** Mirrors FREE_COMPARISON_LIMIT in app/api/compare/route.ts, per 30 days. */
const FREE_COMPARISONS = 5;
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

/** A link shown under the answer on the page (not part of the schema text). */
export type FaqLink = { href: string; label: string };
export type Faq = { question: string; answer: string; link?: FaqLink };
export type FaqGroup = { id: string; heading: string; items: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "about",
    heading: "What Clariti is",
    items: [
      {
        question: "What is Clariti?",
        answer:
          "Clariti is an app that explains health paperwork in plain language. You give it one document — a medical bill, an insurance EOB, a lab result, a scan report, a discharge summary or a medication list — and it tells you what the document says, flags anything worth checking, and suggests questions to ask your doctor, pharmacist, insurer or billing office. It is made by Zapx Labs.",
      },
      {
        question: "What kinds of documents can Clariti explain?",
        answer:
          "Medical bills and itemized statements, insurance explanations of benefits (EOBs), lab and blood test results, radiology reports (X-ray, CT, MRI, ultrasound), discharge summaries, medication lists, pathology reports, referral letters, visit notes and prior authorization letters. It works on paperwork, not on symptoms: it won’t answer questions about a rash or a pain without a document.",
      },
      {
        question: "Does Clariti give medical, legal or financial advice?",
        answer:
          "No. Clariti explains what a document says in everyday words. It does not diagnose, prescribe, decide insurance coverage, give legal advice or tell you whether you owe money or should pay a bill. For decisions, it points you to the right person to ask — your clinician, pharmacist, insurer or the provider’s billing office.",
      },
      {
        question: "What does Clariti do if a document mentions something urgent?",
        answer:
          "If a document or your question contains urgent or emergency language, Clariti tells you to seek urgent or emergency care rather than wait on an explanation. It is not a way to get medical help quickly; if you feel unwell, contact a clinician or emergency services.",
      },
      {
        question: "Is Clariti a medical billing advocate?",
        answer:
          "No. Clariti doesn’t negotiate with providers or insurers or make calls for you. It helps you understand a bill or EOB, spot the lines worth questioning and prepare what to ask, so you can handle the conversation yourself or with an advocate.",
      },
      {
        question: "How is Clariti different from asking a general AI chatbot?",
        answer:
          "Clariti is built for one health document at a time. It explains only what is in the document you give it, ties each point back to the line it came from, flags charges or results worth checking, and ends with questions and next steps. Your documents and analyses stay together in one place, and you can compare documents over time or set an email check-in. It is also deliberately limited: it won’t diagnose or tell you what to do.",
      },
      {
        question: "Does Clariti work with paperwork from outside the US?",
        answer:
          "Clariti reads the text of whatever document you give it, so it can explain a lab report or discharge letter from the UK as well as a US bill or EOB. Insurance and billing documents are mostly a US thing, so most of the billing guides on this site describe US rules; the lab result guides show both US and UK units.",
      },
    ],
  },
  {
    id: "using",
    heading: "Using Clariti",
    items: [
      {
        question: "How do I give Clariti a document?",
        answer:
          "Attach a file, take a photo of the paper with your phone, or paste the text. Then ask your question in your own words — for example “What am I paying for, and is anything unusual?” — and send it. The answer usually arrives in under a minute.",
      },
      {
        question: "What file types can I upload?",
        answer: `PDF files, photos and images (including PNG, JPG, WEBP and iPhone HEIC photos) and plain text files, up to ${MAX_UPLOAD_MB} MB each. If a document is long or hard to photograph, you can paste the text instead.`,
      },
      {
        question: "What if Clariti can’t read my photo?",
        answer:
          "It will tell you rather than guess. Try a clearer photo in good light with the whole page flat in the frame, upload a text-based PDF, or paste the text of the document.",
      },
      {
        question: "Can I ask follow-up questions about a document?",
        answer:
          "Yes. After the explanation, ask anything else about the same document in the chat — for example what to say to the billing office about one charge — and Clariti answers from that document.",
      },
      {
        question: "Can I compare two documents, like two lab results?",
        answer:
          "Yes. Clariti can compare documents over time and show what changed — two lab results, two bills or a bill and its EOB, or two scan reports.",
      },
      {
        question: "What is an email check-in?",
        answer:
          "When you set one, Clariti emails you on the date you choose to ask whether anything has changed — a corrected bill, a decision on an appeal, a new result — so the follow-up doesn’t get forgotten.",
      },
      {
        question: "What is an explainer video?",
        answer:
          "Clariti can turn an analysis it has already written into a short plain-language walkthrough video, which some people find easier than reading. It is made from the explanation, not from your original file.",
      },
      {
        question: "Can I see what Clariti does before uploading anything?",
        answer:
          "Yes. The example analysis shows a finished explanation of an invented report, exactly as the app displays it, and a 90-second walkthrough video shows a sample bill being explained. The guides and the free EOB decoder also work without signing up.",
        link: { href: "/videos/clariti-walkthrough", label: "Watch the walkthrough" },
      },
      {
        question: "Do I need an account?",
        answer:
          "You need a free account to have a document explained, so your documents and analyses can be saved and kept private to you. The guides, the example analysis and the free EOB decoder don’t need an account.",
      },
    ],
  },
  {
    id: "pricing",
    heading: "Price, plans and cancelling",
    items: [
      {
        question: "Is Clariti free?",
        answer: `You can start free. A free account includes ${FREE_DOCUMENT_LIMIT} document analyses, ${FREE_VIDEO_LIMIT} explainer video and ${FREE_CHECK_INS} email check-ins, plus ${FREE_COMPARISONS} document comparisons every 30 days. Clariti Plus removes those limits.`,
      },
      {
        question: "What does Clariti Plus include?",
        answer:
          "Unlimited document analyses, unlimited explainer videos, comparing documents over time, and email check-ins without the free limit.",
      },
      {
        question: "How much does Clariti Plus cost?",
        answer:
          "Clariti Plus is available monthly or yearly, and the yearly plan is the better value. The price is shown in your own currency at checkout — on the web, in the App Store or in Google Play — because it differs between countries and stores.",
      },
      {
        question: "Is there a free trial of Clariti Plus?",
        answer: `On the web, Clariti Plus starts with a ${CARD_TRIAL_DAYS}-day free trial when you add a card at checkout; you are charged when the trial ends unless you cancel first. In the iPhone and Android apps, the store shows any offer before you confirm.`,
      },
      {
        question: "How do I cancel Clariti Plus?",
        answer:
          "Use “Manage subscription” on the Billing page in Clariti. If you subscribed in the iPhone app, cancel in your Apple Account settings; in the Android app, in Google Play subscriptions. Plus is auto-renewing, so cancel at least 24 hours before the period ends to stop the next charge.",
      },
    ],
  },
  {
    id: "privacy",
    heading: "Privacy and your data",
    items: [
      {
        question: "Are my documents used to train AI?",
        answer:
          "No. Your documents and the analyses built from them are not used to train AI models — not by Zapx Labs, and not by the AI providers Clariti uses, whose terms prohibit it.",
      },
      {
        question: "Who can see my documents?",
        answer:
          "Your documents are stored in your Clariti account. To write an explanation, the text of the document is sent to Anthropic’s AI model, directly or through the Vercel AI Gateway. Before your first analysis Clariti shows exactly where documents go, and nothing is sent until you agree. The privacy policy lists every provider and what each one receives.",
        link: { href: "/privacy", label: "Read the privacy policy" },
      },
      {
        question: "Does Clariti sell my data or show me ads based on it?",
        answer:
          "No. Your documents and analyses are not sold, not shared with advertisers and not used to build a profile of you.",
      },
      {
        question: "Can I delete my documents or my account?",
        answer:
          "Yes. Individual documents and their analyses can be deleted from History, Export all data in Settings gives you a copy, and Delete account in Settings removes everything at once, with no waiting period. You can also withdraw consent to AI analysis in Settings without deleting anything.",
        link: { href: "/delete-account", label: "How to delete your account" },
      },
    ],
  },
  {
    id: "platforms",
    heading: "Where Clariti works",
    items: [
      {
        question: "Is Clariti available on iPhone and Android?",
        answer:
          "Yes. Clariti is on the App Store for iPhone and on Google Play for Android, and it also works in any web browser at useclariti.app. Your account and documents are the same everywhere you sign in.",
      },
      {
        question: "Can Clariti explain radiology report wording phrase by phrase?",
        answer:
          "Clariti explains a whole radiology report in plain language with questions for your doctor. For a dictionary of individual phrases radiologists use, such as “unremarkable” or “clinical correlation recommended”, Zapx Labs’ sister product Radily has a free phrase guide.",
        link: { href: "https://radily.ai/report-phrases", label: "Radily’s report phrase guide" },
      },
    ],
  },
  {
    id: "paperwork",
    heading: "Common paperwork questions",
    items: [
      {
        question: "What is the difference between an EOB and a medical bill?",
        answer:
          "An explanation of benefits (EOB) comes from your insurer and shows how a claim was processed — what was billed, what the plan allowed and paid, and what is left for you. It is not a bill. The bill comes from the provider and should match the EOB’s patient responsibility.",
        link: { href: "/guides/eob-vs-medical-bill", label: "EOB vs medical bill, explained" },
      },
      {
        question: "What is a CPT code on my bill?",
        answer:
          "A five-character code for what a provider did — an office visit, a test or a procedure. Each line of an itemized bill usually has one. The guides explain the most common codes one by one.",
        link: { href: "/guides/cpt-code-on-medical-bill", label: "What a CPT code is" },
      },
      {
        question: "How do I check a medical bill for errors?",
        answer:
          "Ask for the itemized bill, compare every line with your EOB, and look for duplicates, services you didn’t get, wrong quantities and insurance payments that weren’t applied. Then call the billing office with the specific lines you’re questioning.",
        link: { href: "/guides/how-to-check-a-hospital-bill-for-errors", label: "Step-by-step bill check" },
      },
      {
        question: "What is prior authorization?",
        answer:
          "Approval from your health plan that may be required before you get a service or fill a prescription, so the plan will cover it. Your doctor’s office usually requests it; a denial is a coverage decision you can usually appeal.",
        link: { href: "/guides/what-is-prior-authorization", label: "Prior authorization, explained" },
      },
    ],
  },
];

export const ALL_FAQS: Faq[] = FAQ_GROUPS.flatMap((group) => group.items);
