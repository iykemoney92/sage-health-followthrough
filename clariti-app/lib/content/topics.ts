/**
 * The second wave of /guides pages: one per exact question people type with a
 * document in their hand ("what does patient responsibility mean on an EOB",
 * "eGFR result explained").
 *
 * Copied from what brings Radily its search visits. The four walkthroughs in
 * guides.ts take one document from top to bottom; these each answer one
 * question properly. The fields that do the work are `answer` (one sentence
 * that stands alone as a snippet), `why` (what makes the paperwork confusing)
 * and `notMean` (the misreading that made someone search).
 *
 * Accuracy rules for anything added here:
 * - Health and money facts only where an official source on the page says
 *   them (NHS, MedlinePlus, Lab Tests Online UK, CMS.gov, HealthCare.gov, AMA
 *   for CPT). Put that source in `sources`.
 * - Never read anyone's own result, never put a number on anyone's risk, never
 *   tell anyone what they owe or whether to pay. Ranges quoted are the ones the
 *   source prints, and the page says to use the range on your own report.
 * - `clariti` may only describe what the live product does (see
 *   lib/ai/clariti-analysis.ts and lib/billing/subscription.ts).
 * - Radiology report wording belongs to Radily (radily.ai) — link it, don't
 *   duplicate it here.
 * - Examples are invented and labelled so.
 */

import type { GuideExampleRow } from "@/lib/content/guides";

export type TopicCategory = "insurance" | "bills" | "labs" | "hospital";

export type TopicSource = { label: string; url: string };

export type TopicGuide = {
  slug: string;
  category: TopicCategory;
  /** The <title> and the search result line. Keep it under ~60 characters. */
  metaTitle: string;
  /** Under 160 characters. */
  metaDescription: string;
  kicker: string;
  /** The question as people type it. */
  h1: string;
  /** The direct answer, written to stand alone as a snippet. */
  answer: string;
  /** Why it is confusing — what almost nobody explains. */
  why: string[];
  /** How to read it, honestly. */
  reading: string[];
  example?: {
    caption: string;
    rows: GuideExampleRow[];
    takeaway: string;
  };
  /** The misreadings. This is usually why they searched. */
  notMean: string[];
  /** Where it shows up. */
  whereSeen: string[];
  questions: { who: string; items: string[] }[];
  /** Where Clariti fits. Live features only. */
  clariti: string;
  ctaPrompt: string;
  faqs: { question: string; answer: string }[];
  sources: TopicSource[];
  /** Slugs from GUIDES or TOPICS. */
  related: string[];
};

export const TOPIC_CATEGORIES: { id: TopicCategory; heading: string; blurb: string }[] = [
  {
    id: "insurance",
    heading: "Insurance EOBs and claims",
    blurb: "The words on an explanation of benefits, and what to do when a claim is denied.",
  },
  {
    id: "bills",
    heading: "Medical bills and codes",
    blurb: "Billing codes, surprise bills, estimates and how to check a bill before you pay.",
  },
  {
    id: "labs",
    heading: "Lab and blood test results",
    blurb: "What common blood tests measure and how the numbers on the report are laid out.",
  },
  {
    id: "hospital",
    heading: "Hospital paperwork",
    blurb: "The shorthand on discharge summaries and medicines lists.",
  },
];

const HC = "https://www.healthcare.gov";
const SRC = {
  billRights: { label: "CMS.gov — Medical bill rights (No Surprises Act)", url: "https://www.cms.gov/medical-bill-rights" },
  allowed: { label: "HealthCare.gov — Allowed amount", url: `${HC}/glossary/allowed-amount/` },
  balance: { label: "HealthCare.gov — Balance billing", url: `${HC}/glossary/balance-billing/` },
  deductible: { label: "HealthCare.gov — Deductible", url: `${HC}/glossary/deductible/` },
  copay: { label: "HealthCare.gov — Copayment", url: `${HC}/glossary/co-payment/` },
  coinsurance: { label: "HealthCare.gov — Coinsurance", url: `${HC}/glossary/co-insurance/` },
  oop: { label: "HealthCare.gov — Out-of-pocket maximum", url: `${HC}/glossary/out-of-pocket-maximum-limit/` },
  network: { label: "HealthCare.gov — Network", url: `${HC}/glossary/network/` },
  claim: { label: "HealthCare.gov — Claim", url: `${HC}/glossary/claim/` },
  internalAppeal: { label: "HealthCare.gov — Internal appeals", url: `${HC}/appeal-insurance-company-decision/internal-appeals/` },
  externalReview: { label: "HealthCare.gov — External review", url: `${HC}/appeal-insurance-company-decision/external-review/` },
  priorAuth: { label: "HealthCare.gov — Prior authorization", url: `${HC}/glossary/prior-authorization/` },
  hcpcs: { label: "CMS.gov — HCPCS (CPT and Level II codes)", url: "https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system" },
  icd10: { label: "CMS.gov — ICD-10 codes", url: "https://www.cms.gov/medicare/coding-billing/icd-10-codes" },
  ama: { label: "AMA — CPT code overview", url: "https://www.ama-assn.org/practice-management/cpt/cpt-overview-and-code-approval" },
  labResults: { label: "MedlinePlus — How to understand your lab results", url: "https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/" },
  cbc: { label: "MedlinePlus — Complete blood count (CBC)", url: "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/" },
  rbcIndices: { label: "MedlinePlus — RBC indices", url: "https://medlineplus.gov/ency/article/003648.htm" },
  ltoIndices: { label: "Lab Tests Online UK — Red cell indices", url: "https://labtestsonline.org.uk/tests/red-cell-indices" },
  ltoFbc: { label: "Lab Tests Online UK — Full blood count (FBC)", url: "https://labtestsonline.org.uk/tests/full-blood-count-fbc" },
  cholesterol: { label: "MedlinePlus — Cholesterol levels", url: "https://medlineplus.gov/lab-tests/cholesterol-levels/" },
  nhsCholesterol: { label: "NHS — Cholesterol levels", url: "https://www.nhs.uk/conditions/high-cholesterol/cholesterol-levels/" },
  ltoLipid: { label: "Lab Tests Online UK — Lipid profile", url: "https://labtestsonline.org.uk/tests/lipid-profile" },
  a1c: { label: "MedlinePlus — Hemoglobin A1C (HbA1c) test", url: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/" },
  ltoA1c: { label: "Lab Tests Online UK — HbA1c", url: "https://labtestsonline.org.uk/tests/hba1c-test" },
  gfr: { label: "MedlinePlus — Glomerular filtration rate (GFR) test", url: "https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/" },
  nhsKidney: { label: "NHS — Chronic kidney disease: diagnosis", url: "https://www.nhs.uk/conditions/kidney-disease/diagnosis/" },
  ltoEgfr: { label: "Lab Tests Online UK — eGFR", url: "https://labtestsonline.org.uk/tests/egfr-estimated-creatinine-clearance" },
  cmp: { label: "MedlinePlus — Comprehensive metabolic panel (CMP)", url: "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/" },
  ltoLiver: { label: "Lab Tests Online UK — Liver blood tests", url: "https://labtestsonline.org.uk/tests/liver-blood-tests" },
  ltoRenal: { label: "Lab Tests Online UK — Renal panel", url: "https://labtestsonline.org.uk/tests/renal-panel" },
  tsh: { label: "MedlinePlus — TSH test", url: "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/" },
  ltoThyroid: { label: "Lab Tests Online UK — Thyroid function tests", url: "https://labtestsonline.org.uk/tests/thyroid-function-tests" },
  nhsBlood: { label: "NHS — Blood tests", url: "https://www.nhs.uk/conditions/blood-tests/" },
  discharge: { label: "MedlinePlus — Leaving the hospital: your discharge plan", url: "https://medlineplus.gov/ency/patientinstructions/000867.htm" },
} satisfies Record<string, TopicSource>;

export const TOPICS: TopicGuide[] = [
  // ——— Insurance EOBs and claims ———
  {
    slug: "eob-vs-medical-bill",
    category: "insurance",
    metaTitle: "EOB vs medical bill: what’s the difference?",
    metaDescription:
      "An EOB comes from your insurer and is not a request for payment; the bill comes from the provider. How to tell them apart and match one to the other.",
    kicker: "EOB VS BILL",
    h1: "EOB vs medical bill: what’s the difference?",
    answer:
      "An explanation of benefits (EOB) is your insurer telling you how it handled a claim; a medical bill is the doctor, hospital or lab asking you to pay. The EOB usually says “This is not a bill” — the amount you may owe on it is what the provider’s bill should later match.",
    why: [
      "Both documents arrive in the post or in a portal within a few weeks of the same visit, both list the same date and service, and both show dollar amounts. The EOB often arrives first, so people pay from it — or ignore the bill because they think they already dealt with it.",
      "They also use different words for the same thing. The insurer may say “patient responsibility” or “what you owe”; the provider may say “amount due” or “balance”. The provider’s charges on the bill may be the full list price, while the EOB shows the lower allowed amount your plan agreed.",
    ],
    reading: [
      "Look at the top of the page. An EOB carries your insurer’s name and logo, a claim number and your member ID, and usually the words “This is not a bill”. A bill carries the provider’s name, an account or statement number, a due date and a way to pay.",
      "Then match them. Find the same date of service and the same provider on both. The “you may owe” or “patient responsibility” figure on the EOB is the number to compare with the provider’s “amount due”. If they agree, the bill reflects how insurance processed the claim. If they don’t, that is the moment to call — before paying.",
      "One visit can produce more than one bill and more than one EOB: a hospital stay may involve separate claims from the hospital, the doctors who treated you and the lab. Match each bill to its own EOB.",
    ],
    example: {
      caption: "An invented EOB and bill for the same clinic visit. Not anyone’s real paperwork.",
      rows: [
        { label: "EOB: amount billed", value: "$310.00", reading: "The clinic’s full charge, as sent to the insurer." },
        { label: "EOB: allowed amount", value: "$180.00", reading: "The price the plan agreed with this in-network clinic." },
        { label: "EOB: plan paid", value: "$140.00", reading: "Sent by the insurer to the clinic." },
        { label: "EOB: you may owe", value: "$40.00", reading: "Your share — here, a copay." },
        { label: "Bill: amount due", value: "$40.00", reading: "Matches the EOB, so the bill reflects the processed claim." },
      ],
      takeaway: "Had the bill asked for $170 — the full $310 less what the plan paid — the EOB would be your reason to ask why the in-network discount was missing.",
    },
    notMean: [
      "That you must pay the amount on the EOB to your insurer. You do not pay an EOB; you pay the provider, once their bill arrives.",
      "That a bill showing a higher amount than the EOB is automatically wrong. It may have been sent before the claim was processed. Ask the provider whether insurance has been applied.",
      "That no EOB means nothing is owed. Some claims are still being processed, and some services are not sent to insurance at all.",
    ],
    whereSeen: [
      "EOBs: posted by your insurer, or in your insurer’s app or member portal under “claims”.",
      "Bills: posted or emailed by the hospital, practice, lab or imaging centre, or shown in the provider’s patient portal.",
    ],
    questions: [
      {
        who: "Ask the provider’s billing office",
        items: [
          "Has my insurance payment been applied to this bill?",
          "Why is the amount due different from the patient responsibility on my EOB?",
        ],
      },
      { who: "Ask your insurer", items: ["Has the claim for this date of service been processed?", "Was this provider treated as in-network?"] },
    ],
    clariti:
      "Clariti explains EOBs and medical bills one document at a time. Give it the EOB and it sets out what was billed, allowed, paid and left to you, quoting the lines it is explaining; give it the bill and it does the same for each charge, flagging anything worth checking and suggesting what to ask.",
    ctaPrompt: "Not sure whether you’re holding an EOB or a bill? Attach it or take a photo, and Clariti will tell you what it is and walk through each line.",
    faqs: [
      {
        question: "Is an EOB a bill?",
        answer: "No. An EOB comes from your insurer and explains how a claim was processed. The bill comes from the provider, and it is the bill you pay.",
      },
      {
        question: "Which comes first, the EOB or the bill?",
        answer: "Either can arrive first. Many people wait for the EOB, then check that the provider’s bill matches its patient responsibility figure before paying.",
      },
      {
        question: "What if the bill and the EOB don’t match?",
        answer: "Ask the provider’s billing office whether insurance has been applied, and ask your insurer whether the claim was processed. Have the claim number from the EOB to hand.",
      },
    ],
    sources: [SRC.claim, SRC.allowed, SRC.balance],
    related: ["how-to-read-an-eob", "patient-responsibility-on-eob", "how-to-check-a-hospital-bill-for-errors"],
  },
  {
    slug: "patient-responsibility-on-eob",
    category: "insurance",
    metaTitle: "What does “patient responsibility” mean on an EOB?",
    metaDescription:
      "Patient responsibility is the part of a claim your plan did not pay — deductible, copay, coinsurance or non-covered amounts. How it is worked out.",
    kicker: "PATIENT RESPONSIBILITY",
    h1: "What does “patient responsibility” mean on an EOB?",
    answer:
      "“Patient responsibility” is the part of a claim your insurer says is yours to pay the provider — usually your deductible, copay or coinsurance, plus any amount the plan did not cover. It is what the provider can bill you for, not a bill from the insurer.",
    why: [
      "The phrase sounds final, as if the insurer has sent you a demand. It hasn’t: the EOB is a report on how the claim was processed, and the provider sends the actual bill.",
      "It is also a total of several different things, and EOBs show them in separate columns with different names — “deductible”, “copay”, “coinsurance”, “not covered”, “amount you owe”. Insurers word these differently, so two EOBs for similar visits can look nothing alike.",
    ],
    reading: [
      "Start from the allowed amount, not the billed amount. Your share is worked out from the allowed amount — the price your plan agreed — so the gap between billed and allowed is usually not yours if the provider is in-network.",
      "Then look at how your share is split. Money applied to your deductible is what you pay before the plan starts sharing costs. A copay is a fixed amount. Coinsurance is a percentage of the allowed amount. A “not covered” amount is a service the plan did not pay for at all, and there should be a reason code next to it.",
      "Add those up and you should reach the patient responsibility figure. That total is what you compare with the provider’s bill.",
    ],
    example: {
      caption: "An invented EOB line for an in-network specialist visit. Not anyone’s real claim.",
      rows: [
        { label: "Allowed amount", value: "$250.00", reading: "The plan’s agreed price for the visit." },
        { label: "Applied to deductible", value: "$100.00", reading: "The last of this year’s deductible." },
        { label: "Coinsurance (20%)", value: "$30.00", reading: "20% of the remaining $150." },
        { label: "Plan paid", value: "$120.00", reading: "80% of the remaining $150." },
        { label: "Patient responsibility", value: "$130.00", reading: "$100 deductible + $30 coinsurance." },
      ],
      takeaway: "Deductible plus coinsurance gives $130, and the plan’s $120 makes up the rest of the $250 allowed amount. The provider’s bill should ask for $130.",
    },
    notMean: [
      "That the insurer wants payment from you. You pay the provider, not the insurer.",
      "That the amount is beyond question. If something is marked “not covered” and you think it should be, you can ask the insurer and, if needed, appeal.",
      "That you owe it today. Wait for the provider’s bill, and check it matches.",
    ],
    whereSeen: ["Insurance EOBs, often in a column headed “patient responsibility”, “what you owe” or “your share”.", "Claims screens in insurer apps and member portals."],
    questions: [
      {
        who: "Ask your insurer",
        items: [
          "Which part of this is deductible, copay, coinsurance or not covered?",
          "How much of my deductible and out-of-pocket maximum is left this year?",
          "Why was this part not covered, and can I appeal?",
        ],
      },
    ],
    clariti:
      "Attach an EOB and Clariti breaks the patient responsibility figure into the parts that make it up, in plain words, quoting the lines on your EOB it is reading from. It flags anything marked not covered and suggests what to ask your insurer.",
    ctaPrompt: "Want to see how your patient responsibility was worked out? Attach the EOB or take a photo, and Clariti will explain each part.",
    faqs: [
      {
        question: "Is patient responsibility the same as what I owe?",
        answer: "It is what the insurer says the provider may bill you for on that claim. What you are asked to pay comes on the provider’s bill, which should match it.",
      },
      {
        question: "Why is my patient responsibility so high?",
        answer: "Often because the cost went towards your deductible, which you pay before the plan shares costs. A “not covered” amount or an out-of-network provider can also raise it.",
      },
      {
        question: "Does patient responsibility count towards my out-of-pocket maximum?",
        answer: "Deductible, copay and coinsurance for covered in-network care count towards it. Premiums and services the plan does not cover do not. Check your plan for details.",
      },
    ],
    sources: [SRC.deductible, SRC.copay, SRC.coinsurance, SRC.oop],
    related: ["deductible-copay-coinsurance", "allowed-amount-on-eob", "how-to-read-an-eob"],
  },
  {
    slug: "allowed-amount-on-eob",
    category: "insurance",
    metaTitle: "What is the “allowed amount” on an EOB?",
    metaDescription:
      "The allowed amount is the most your plan will pay for a covered service, also called the negotiated rate. Why it is lower than the billed amount.",
    kicker: "ALLOWED AMOUNT",
    h1: "What is the “allowed amount” on an EOB?",
    answer:
      "The allowed amount is the most your health plan will pay for a covered service — the price it has agreed with in-network providers. Your deductible, copay and coinsurance are all worked out from it, not from the provider’s billed charge.",
    why: [
      "Two prices appear side by side and look like they should be the same. The billed amount is the provider’s list price; the allowed amount is the agreed price. The gap between them can be large, and people worry they will be asked for it.",
      "The term also goes by other names. HealthCare.gov lists “eligible expense”, “payment allowance” and “negotiated rate”, so it can be hard to spot on your EOB.",
    ],
    reading: [
      "Find the allowed amount column. Everything to its right — plan paid, deductible, coinsurance, what you may owe — should add up to it.",
      "Look for a discount or adjustment column too. That is usually the difference between billed and allowed. For an in-network provider covering a covered service, that difference is written off; a preferred provider may not balance-bill you for it.",
      "For an out-of-network provider the picture can be different: the plan still pays based on its allowed amount, but the provider may not have agreed to accept it. Billing you for the difference is called balance billing, and the No Surprises Act limits it for emergency care and some other situations.",
    ],
    notMean: [
      "That the allowed amount is what you pay. It is the total agreed price, shared between you and the plan.",
      "That the billed amount minus the allowed amount is owed by you, when the provider is in-network.",
      "That the same service has the same allowed amount everywhere. It depends on the plan and the provider’s contract.",
    ],
    whereSeen: ["Insurance EOBs, sometimes headed “allowed”, “plan allowance”, “eligible amount” or “negotiated rate”.", "Claims details in insurer apps."],
    questions: [
      { who: "Ask your insurer", items: ["Was this provider in-network for this claim?", "What allowed amount was used, and how was my share worked out from it?"] },
      { who: "Ask the provider", items: ["Has the insurer’s adjustment been applied to my account?"] },
    ],
    clariti:
      "Clariti reads the columns of an EOB for you — billed, allowed, adjustment, plan paid, your share — explains each in everyday words and shows how they add up, quoting the figures from your own document.",
    ctaPrompt: "Want each column on your EOB explained? Attach it or take a photo, and Clariti will walk through it.",
    faqs: [
      {
        question: "Why is the allowed amount lower than the billed amount?",
        answer: "In-network providers agree prices with insurers in advance. The billed amount is the provider’s list price; the allowed amount is the agreed price.",
      },
      {
        question: "Do I pay the difference between billed and allowed?",
        answer: "Not for covered services from an in-network provider — that difference is written off. Out-of-network providers may balance-bill in some situations, which federal rules limit for emergency care.",
      },
      {
        question: "Is the allowed amount the same as the negotiated rate?",
        answer: "Yes. HealthCare.gov says the allowed amount may also be called the eligible expense, payment allowance or negotiated rate.",
      },
    ],
    sources: [SRC.allowed, SRC.balance, SRC.billRights],
    related: ["patient-responsibility-on-eob", "out-of-network-and-balance-billing", "how-to-read-an-eob"],
  },
  {
    slug: "deductible-copay-coinsurance",
    category: "insurance",
    metaTitle: "Deductible vs copay vs coinsurance on your EOB",
    metaDescription:
      "How a deductible, a copay and coinsurance differ, how each shows up on an EOB, and how they add up to what you may owe the provider.",
    kicker: "DEDUCTIBLE, COPAY, COINSURANCE",
    h1: "Deductible vs copay vs coinsurance: what they mean on your EOB",
    answer:
      "A deductible is what you pay for covered care before your plan starts to pay; a copay is a fixed amount for a service, such as $30; coinsurance is a percentage of the allowed amount, such as 20%. Your EOB shows how much of each applied to a claim.",
    why: [
      "All three are “your share”, and an EOB can show more than one on the same line. Plans also use them differently — some services have a copay even before the deductible is met, and many plans pay for certain preventive care before the deductible.",
      "The deductible resets each plan year, so the same visit can cost you very different amounts in January and in October.",
    ],
    reading: [
      "Deductible: look for “applied to deductible”. That amount is yours, and it brings you closer to meeting the deductible for the year.",
      "Copay: a flat fee for a type of service — a doctor visit, a prescription, a specialist. It is usually the same each time for the same kind of service.",
      "Coinsurance: a percentage of the allowed amount, usually charged after the deductible is met. If your coinsurance is 20%, the plan pays the other 80% of the allowed amount.",
      "All three count towards your out-of-pocket maximum for covered in-network care. Once you reach it, the plan pays 100% of covered services for the rest of the plan year.",
    ],
    example: {
      caption: "HealthCare.gov’s own illustration, laid out as an EOB would show it. Not anyone’s real claim.",
      rows: [
        { label: "Covered hospital bill", value: "$12,000", reading: "The allowed cost of the care." },
        { label: "Deductible", value: "$3,000", reading: "You pay all of this first." },
        { label: "Coinsurance (20%)", value: "$1,800", reading: "20% of the remaining $9,000." },
        { label: "Your total", value: "$4,800", reading: "Deductible plus coinsurance." },
        { label: "Out-of-pocket maximum", value: "$6,850", reading: "The most you would pay for covered care that plan year." },
      ],
      takeaway: "If your costs reached $6,850, you would pay only that amount and the plan would pay for covered services for the rest of the plan year.",
    },
    notMean: [
      "That a copay is the whole cost. Other charges — a test done at the same visit, for example — can be billed separately.",
      "That meeting your deductible means everything is free. You usually still pay copays or coinsurance until the out-of-pocket maximum.",
      "That premiums count towards your deductible or out-of-pocket maximum. They don’t.",
    ],
    whereSeen: ["Insurance EOBs, in separate columns for deductible, copay and coinsurance.", "Your plan’s summary of benefits, which lists the amounts that apply to you."],
    questions: [
      {
        who: "Ask your insurer",
        items: [
          "How much of my deductible have I met this year?",
          "Is this service subject to the deductible, or does it have a copay?",
          "How close am I to my out-of-pocket maximum?",
        ],
      },
    ],
    clariti:
      "Attach an EOB and Clariti labels each part of your share — deductible, copay, coinsurance — in plain words and shows how they add up to what you may owe, quoting the lines it read.",
    ctaPrompt: "Can’t tell which part of your EOB is deductible and which is coinsurance? Attach it, and Clariti will break it down.",
    faqs: [
      {
        question: "What is the difference between a copay and coinsurance?",
        answer: "A copay is a fixed amount, such as $30. Coinsurance is a percentage of the allowed amount, such as 20%.",
      },
      {
        question: "Do I pay a copay before meeting my deductible?",
        answer: "It depends on the plan. Some services have a copay regardless of the deductible. Your summary of benefits says which.",
      },
      {
        question: "What happens when I reach my out-of-pocket maximum?",
        answer: "HealthCare.gov says your plan then pays 100% of the costs of covered benefits for the rest of the plan year.",
      },
    ],
    sources: [SRC.deductible, SRC.copay, SRC.coinsurance, SRC.oop],
    related: ["out-of-pocket-maximum-explained", "patient-responsibility-on-eob", "how-to-read-an-eob"],
  },
  {
    slug: "out-of-pocket-maximum-explained",
    category: "insurance",
    metaTitle: "Out-of-pocket maximum explained, using your EOB",
    metaDescription:
      "The out-of-pocket maximum is the most you pay for covered in-network care in a plan year. What counts towards it and how to track it.",
    kicker: "OUT-OF-POCKET MAXIMUM",
    h1: "What is an out-of-pocket maximum, and how do I track it?",
    answer:
      "Your out-of-pocket maximum is the most you have to pay for covered services in a plan year. Once your deductibles, copays and coinsurance for in-network care reach it, your plan pays 100% of covered benefits for the rest of that year.",
    why: [
      "It is a safety cap, but it only counts certain spending. Premiums don’t count, care the plan doesn’t cover doesn’t count, and out-of-network spending may not count — so people add up everything they spent and are surprised the cap hasn’t been reached.",
      "Family plans can have both an individual and a family limit, and the figure resets at the start of each plan year.",
    ],
    reading: [
      "Your EOBs show how much of each claim went to your deductible, copay and coinsurance. Many EOBs also show a running “year to date” total against your deductible and out-of-pocket maximum — often near the top or the end.",
      "If yours doesn’t, your insurer’s app or member portal usually does. Compare that running total with the maximum in your plan’s summary of benefits.",
      "When a claim arrives after you have reached the maximum, the EOB should show the plan paying the full allowed amount for covered in-network care, with nothing left for you.",
    ],
    notMean: [
      "That nothing else can be billed once you reach it. Non-covered services and some out-of-network charges sit outside the cap.",
      "That monthly premiums count towards it. They don’t.",
      "That it carries over. It resets each plan year.",
    ],
    whereSeen: ["Year-to-date summaries on insurance EOBs.", "Your plan’s summary of benefits and coverage.", "The “benefits” or “spending” page of an insurer’s app or portal."],
    questions: [
      {
        who: "Ask your insurer",
        items: [
          "How much have I paid towards my out-of-pocket maximum this year?",
          "Is there a separate family limit on my plan?",
          "Will this service count towards my out-of-pocket maximum?",
        ],
      },
    ],
    clariti:
      "If your EOB prints year-to-date figures, Clariti points them out and explains what they track. It explains your share on each claim in plain words and suggests what to ask your insurer about the rest.",
    ctaPrompt: "Want to know what your EOB says about your yearly totals? Attach it, and Clariti will explain.",
    faqs: [
      {
        question: "What doesn’t count towards the out-of-pocket maximum?",
        answer: "Your monthly premiums and anything the plan doesn’t cover. Out-of-network care may not count either. Your plan documents say exactly what counts.",
      },
      {
        question: "Is the out-of-pocket maximum the same as the deductible?",
        answer: "No. The deductible is what you pay before the plan starts sharing costs. The out-of-pocket maximum is the cap on your total share, deductible included.",
      },
      {
        question: "Does the out-of-pocket maximum reset?",
        answer: "Yes, at the start of each plan year.",
      },
    ],
    sources: [SRC.oop, SRC.deductible, SRC.coinsurance],
    related: ["deductible-copay-coinsurance", "patient-responsibility-on-eob", "eob-vs-medical-bill"],
  },
  {
    slug: "claim-denied-on-eob",
    category: "insurance",
    metaTitle: "Claim denied on your EOB? What it means and how to appeal",
    metaDescription:
      "What a denied claim on an EOB means, how to find the reason, and the internal appeal and external review steps HealthCare.gov describes.",
    kicker: "DENIED CLAIM",
    h1: "My EOB says the claim was denied. What does that mean, and can I appeal?",
    answer:
      "A denied claim means your insurer decided not to pay for that service, and the EOB or a letter should say why. You can ask the insurer to reconsider through an internal appeal — HealthCare.gov says you must file within 180 days of being told the claim was denied — and, if it is still denied, ask for an external review.",
    why: [
      "Denials are explained in short codes and phrases — “not medically necessary”, “prior authorization required”, “out of network”, “duplicate claim” — that hide very different problems. Some are simple paperwork errors a provider can fix by resubmitting; others need a formal appeal.",
      "A denial on an EOB also doesn’t mean a bill is coming tomorrow, but it may mean the provider bills you for the full amount, so it is worth acting early.",
    ],
    reading: [
      "Find the reason. Look for a remark or reason code next to the denied line, and the key that explains it — often on the back or last page of the EOB. Your insurer must tell you in writing why the claim was denied.",
      "Sort it into one of two kinds. A billing or paperwork problem (wrong code, missing information, duplicate) is often fixed by the provider correcting and resubmitting the claim — call their billing office first. A coverage decision (not medically necessary, not covered, experimental) is what the appeal process is for.",
      "To appeal, HealthCare.gov says you complete your insurer’s forms or write to it with your name, claim number and insurance ID, and you can include extra information such as a letter from your doctor. File within 180 days of receiving the denial. If the insurer still says no, you can ask for an external review — an independent decision your insurer must accept — within 4 months of the final denial. In an urgent health situation you can ask for both at the same time.",
    ],
    notMean: [
      "That you definitely owe the full amount. A corrected claim or a successful appeal can change it.",
      "That the care was wrong or unnecessary. “Not medically necessary” is a coverage decision, not a medical verdict.",
      "That there is nothing you can do. Keep copies of the EOB, the denial and everything you send.",
    ],
    whereSeen: ["Insurance EOBs, as “denied”, “not covered” or “$0 paid” with a reason code.", "Denial letters, sometimes called an adverse benefit determination."],
    questions: [
      {
        who: "Ask your insurer",
        items: [
          "What exactly is the reason for this denial?",
          "Is this something the provider can correct and resubmit?",
          "How do I file an internal appeal, and what is my deadline?",
        ],
      },
      { who: "Ask the provider’s billing office", items: ["Was the claim coded correctly?", "Can you resubmit it, and will you hold the bill while it is reviewed?"] },
    ],
    clariti:
      "Attach the EOB or denial letter and Clariti explains in plain words what was denied and the reason the document gives, quoting the wording it is explaining. It suggests questions for your insurer and the billing office. It does not file appeals or decide whether you will win one.",
    ctaPrompt: "Got a denial you can’t make sense of? Attach the EOB or letter, and Clariti will explain the reason and what to ask.",
    faqs: [
      {
        question: "How long do I have to appeal a denied claim?",
        answer: "HealthCare.gov says you must file an internal appeal within 180 days (6 months) of receiving notice that your claim was denied. Your denial notice should state your deadline.",
      },
      {
        question: "What is an external review?",
        answer: "An independent review of your insurer’s decision. HealthCare.gov says you must request it in writing within 4 months of the final denial, and your insurer must accept the reviewer’s decision.",
      },
      {
        question: "Should I call the provider or the insurer first?",
        answer: "If the reason looks like a coding or paperwork error, the provider’s billing office can often fix and resubmit it. For coverage decisions, contact your insurer about an appeal.",
      },
    ],
    sources: [SRC.internalAppeal, SRC.externalReview, SRC.priorAuth],
    related: ["eob-remark-codes", "how-to-read-an-eob", "cpt-code-on-medical-bill"],
  },
  {
    slug: "eob-remark-codes",
    category: "insurance",
    metaTitle: "What do the remark codes on an EOB mean?",
    metaDescription:
      "Remark and reason codes explain why an insurer adjusted or denied part of a claim. Where to find the key on your EOB and what to ask.",
    kicker: "REMARK CODES",
    h1: "What do the remark codes on my EOB mean?",
    answer:
      "Remark codes (also called reason or adjustment codes) are short codes your insurer puts next to a line on an EOB to explain why it paid, reduced or denied that amount. The meaning of each code is printed in a key on the EOB itself — usually on the back or the last page.",
    why: [
      "The codes are a few letters or numbers, such as “PR”, “45” or “N130”, printed next to a figure with no explanation on that line. Insurers use their own formats on member EOBs, so a code on one insurer’s EOB may mean something different on another’s.",
      "Many codes are routine — the most common simply explain the in-network discount — so a page full of codes doesn’t mean something has gone wrong.",
    ],
    reading: [
      "Find the code on the line you’re asking about, then find the key. Look for a section headed “remarks”, “notes”, “message codes” or “explanation of codes”.",
      "Read the code against the column it sits next to. A code beside the discount or adjustment column usually explains the in-network write-off. A code beside a denied or “not covered” amount explains why the plan didn’t pay, and is the one worth acting on.",
      "If the key is missing or vague, ask your insurer. They must tell you in writing why a claim was denied, and they can tell you what any code on your EOB means.",
    ],
    notMean: [
      "That every coded line is a problem. Many codes describe ordinary discounts or the part that went to your deductible.",
      "That the code is a diagnosis or medical judgement. It is about payment.",
      "That a code you found online means the same on your EOB. Use the key on your own EOB or ask your insurer.",
    ],
    whereSeen: ["Insurance EOBs, next to adjusted or denied amounts, with a key at the end.", "Denial letters, which often repeat the code and give more detail."],
    questions: [
      {
        who: "Ask your insurer",
        items: [
          "What does this code mean on my claim?",
          "Does it mean the provider needs to correct or resubmit something?",
          "If it is a denial, how do I appeal?",
        ],
      },
    ],
    clariti:
      "Attach the EOB, key and all, and Clariti explains each coded line in plain words using the explanations printed on your document. Where a code isn’t explained on the page, it says so and suggests asking your insurer, rather than guessing.",
    ctaPrompt: "Got an EOB full of codes? Attach the whole thing, and Clariti will explain each one it can find a key for.",
    faqs: [
      {
        question: "Where is the key to the remark codes on my EOB?",
        answer: "Usually on the back or the last page, under a heading like “remarks” or “message codes”. If you can’t find it, your insurer can explain any code.",
      },
      {
        question: "Are remark codes the same for every insurer?",
        answer: "Not on member EOBs. Insurers often use their own codes, so read the key on your own EOB.",
      },
      {
        question: "What should I do if a remark code means my claim was denied?",
        answer: "Ask your insurer for the full reason. If it is a coding or paperwork problem, the provider may be able to resubmit; otherwise you can file an internal appeal.",
      },
    ],
    sources: [SRC.internalAppeal, SRC.claim],
    related: ["claim-denied-on-eob", "how-to-read-an-eob", "allowed-amount-on-eob"],
  },
  {
    slug: "out-of-network-and-balance-billing",
    category: "insurance",
    metaTitle: "Out of network on your EOB? Balance billing explained",
    metaDescription:
      "What “out of network” means on an EOB, what balance billing is, and when the No Surprises Act protects you from surprise medical bills.",
    kicker: "OUT OF NETWORK",
    h1: "What does “out of network” mean on an EOB — and can they bill me the difference?",
    answer:
      "“Out of network” means the provider has no contract with your health plan, so the plan may pay less and the provider may bill you for the difference between its charge and the plan’s allowed amount — called balance billing. The federal No Surprises Act, in effect since January 1, 2022, protects most insured people from surprise out-of-network bills for emergency care and some other situations.",
    why: [
      "You often don’t choose the provider who turns out to be out of network: an emergency department doctor, an anesthesiologist at an in-network hospital, or an air ambulance. The EOB is where you first find out.",
      "The EOB may also show a lower plan payment and a larger “you may owe”, without saying whether federal protections apply.",
    ],
    reading: [
      "Check the network status on the EOB line. Some EOBs mark it plainly; others show it through a different coinsurance rate or a remark code.",
      "Check whether the care is one of the situations the No Surprises Act covers. According to CMS, it protects you from unexpected out-of-network bills for emergency room visits; non-emergency care related to a visit to an in-network hospital, hospital outpatient department or ambulatory surgical center; and air ambulance services.",
      "If the bill is higher than your in-network share would have been in one of those situations, contact the provider and your insurer, and you can contact the No Surprises Help Desk run by CMS on 1-800-985-3059.",
    ],
    notMean: [
      "That every out-of-network bill is illegal. Outside the protected situations, balance billing may be allowed.",
      "That “in-network hospital” means every clinician there was in network. That is exactly the gap the law addresses for some services.",
      "That you must pay before asking questions. Ask first, especially if you think the protections apply.",
    ],
    whereSeen: ["Insurance EOBs, on the line for the out-of-network provider.", "Bills from emergency physicians, anesthesia groups, labs or air ambulance companies."],
    questions: [
      {
        who: "Ask your insurer",
        items: ["Was this provider out of network, and how was the payment worked out?", "Do No Surprises Act protections apply to this claim?"],
      },
      { who: "Ask the provider", items: ["Why are you billing more than my in-network share?", "Is this care covered by surprise billing protections?"] },
    ],
    clariti:
      "Clariti explains what an EOB or bill says about network status, what was paid and what is left to you, in plain words, and suggests what to ask. It doesn’t decide whether a law applies to your bill — CMS and your insurer can.",
    ctaPrompt: "Got an out-of-network charge you didn’t expect? Attach the EOB or bill, and Clariti will explain what it says.",
    faqs: [
      {
        question: "What is balance billing?",
        answer: "When a provider bills you for the difference between its charge and your plan’s allowed amount. HealthCare.gov notes a preferred (in-network) provider may not balance-bill you for covered services.",
      },
      {
        question: "What does the No Surprises Act cover?",
        answer: "CMS says it protects you from unexpected out-of-network bills for emergency room visits, some non-emergency care linked to in-network facilities, and air ambulance services.",
      },
      {
        question: "Who can I call about a surprise bill?",
        answer: "CMS runs a help line for questions and complaints about the No Surprises Act: 1-800-985-3059.",
      },
    ],
    sources: [SRC.billRights, SRC.balance, SRC.network],
    related: ["allowed-amount-on-eob", "why-two-bills-for-one-hospital-visit", "good-faith-estimate"],
  },

  // ——— Medical bills and codes ———
  {
    slug: "cpt-code-on-medical-bill",
    category: "bills",
    metaTitle: "What is a CPT code on my medical bill?",
    metaDescription:
      "CPT codes are five-character codes for what a provider did — a visit, test or procedure. How to read them on a bill and why they matter.",
    kicker: "CPT CODES",
    h1: "What is a CPT code on my medical bill?",
    answer:
      "A CPT code is a five-character code that describes what a provider did — an office visit, a blood test, an X-ray, a procedure. It is how the provider tells your insurer what to pay for, so each charge on an itemized bill usually has one.",
    why: [
      "Bills often print the code with a short, abbreviated description — “OFFICE O/P EST LOW 20 MIN” — or with no description at all. The codes look like account numbers, so people skip them, but they are the most useful thing on the bill when something looks wrong.",
      "CPT codes also sit alongside other codes. HCPCS Level II codes (a letter followed by four numbers) cover supplies, drugs and services such as ambulance trips; ICD-10 codes describe the diagnosis, the reason for the care.",
    ],
    reading: [
      "CPT stands for Current Procedural Terminology. The code set is maintained by the American Medical Association, and CMS describes it as Level I of the national coding system insurers use to process claims.",
      "Most CPT codes are five digits (Category I, which runs from 00100 to 99499). Category II and III codes are alphanumeric — four numbers and a letter — used for tracking quality measures and for new technology.",
      "On your bill, read each code with its date and quantity. The same code twice on one date may be a duplicate, or may be two of the same service — it is fair to ask which. A code for something you don’t remember having is also worth asking about.",
    ],
    example: {
      caption: "Invented lines from an itemized bill. Not anyone’s real bill.",
      rows: [
        { label: "99213", value: "$165.00", reading: "An office visit for an established patient — a five-digit Category I CPT code." },
        { label: "85025", value: "$48.00", reading: "A complete blood count, a common lab test." },
        { label: "J1100", value: "$22.00", reading: "A HCPCS Level II code — the letter shows it is a drug or supply rather than a CPT service." },
      ],
      takeaway: "Reading the code, not just the description, lets you ask the billing office a precise question about any one line.",
    },
    notMean: [
      "That the code describes your diagnosis. That is what ICD-10 codes are for.",
      "That a code with a higher number costs more. The numbers are organised by type of service, not by price.",
      "That a code is proof the service happened. Mistakes happen, and you can ask for the record behind any charge.",
    ],
    whereSeen: ["Itemized bills and statements from doctors, hospitals and labs.", "Insurance EOBs, sometimes as a “procedure code” column."],
    questions: [
      {
        who: "Ask the billing office",
        items: [
          "Can you send an itemized bill with the code for each charge?",
          "What does this code describe, and why does it appear twice?",
          "Was this code billed to my insurance?",
        ],
      },
    ],
    clariti:
      "Attach an itemized bill and Clariti explains each charge in everyday words — including the codes printed beside it — quoting the lines it is reading, and flags charges worth checking, such as a code repeated on the same date.",
    ctaPrompt: "Got a bill full of codes? Attach it or take a photo, and Clariti will explain each charge in plain language.",
    faqs: [
      {
        question: "Who decides what a CPT code means?",
        answer: "The CPT code set is maintained by the American Medical Association through its CPT Editorial Panel and updated regularly.",
      },
      {
        question: "What is the difference between CPT and HCPCS codes?",
        answer: "CPT codes (HCPCS Level I) describe services and procedures. HCPCS Level II codes, which start with a letter, cover items such as supplies, drugs, ambulance services and equipment.",
      },
      {
        question: "Can I ask what a code on my bill means?",
        answer: "Yes. The provider’s billing office can tell you what each code describes and send an itemized bill showing every code.",
      },
    ],
    sources: [SRC.ama, SRC.hcpcs],
    related: ["icd-10-code-on-medical-bill", "er-visit-level-codes-99281-99285", "how-to-check-a-hospital-bill-for-errors"],
  },
  {
    slug: "icd-10-code-on-medical-bill",
    category: "bills",
    metaTitle: "What is an ICD-10 code on a medical bill or EOB?",
    metaDescription:
      "ICD-10 codes describe the diagnosis or reason for care on a claim. How to read them, how they differ from CPT codes, and why they affect coverage.",
    kicker: "ICD-10 CODES",
    h1: "What is an ICD-10 code on my medical bill or EOB?",
    answer:
      "An ICD-10 code describes the reason for your care — a diagnosis, symptom or condition — on a medical claim. A CPT code says what was done; the ICD-10 code says why, and insurers look at both when deciding whether to pay.",
    why: [
      "ICD-10 codes look cryptic — a letter, then numbers, often with a decimal point — and they can be alarming when the description printed beside one sounds more serious than anything you were told.",
      "A code can also reflect what was being checked, not what was found. A test ordered to rule something out may carry a code for the symptom or the suspected condition.",
    ],
    reading: [
      "In the US, diagnosis codes on claims use ICD-10-CM. CMS notes the change from ICD-9 to ICD-10 happened on October 1, 2015, and the code set is updated every year from October 1.",
      "ICD-10-CM codes start with a letter, followed by numbers, and can run up to seven characters. Broadly, the first three characters name a category and the characters after the decimal add detail.",
      "If a description on your bill or EOB doesn’t fit your visit, ask. A wrong diagnosis code can make an insurer deny a claim, and the provider can correct it.",
    ],
    notMean: [
      "That you have been diagnosed with what the description says. Codes can record symptoms or conditions being ruled out.",
      "That a code tells you how serious something is. It is a classification for records and billing.",
      "That the code can’t be wrong. Coding errors happen and can be corrected by the provider.",
    ],
    whereSeen: ["Itemized bills and claim forms, often labelled “diagnosis” or “Dx”.", "Insurance EOBs and denial letters."],
    questions: [
      {
        who: "Ask your doctor’s office",
        items: ["Why was this diagnosis code used for my visit?", "Can it be corrected if it doesn’t match what happened?"],
      },
      { who: "Ask your insurer", items: ["Was the claim denied because of the diagnosis code?"] },
    ],
    clariti:
      "Clariti explains the codes and descriptions on a bill or EOB in plain words, quoting what your document says, and suggests what to ask. It does not tell you what a diagnosis means for your health — your doctor does.",
    ctaPrompt: "Seeing a diagnosis code you don’t recognise? Attach the bill or EOB, and Clariti will explain what the document says.",
    faqs: [
      {
        question: "What is the difference between ICD-10 and CPT codes?",
        answer: "ICD-10 codes describe the diagnosis or reason for care. CPT codes describe the service or procedure that was done.",
      },
      {
        question: "Can a wrong ICD-10 code cause a claim denial?",
        answer: "Yes, it can. If the code doesn’t match the care, ask the provider’s office to review it and resubmit the claim.",
      },
      {
        question: "Does a code on my bill mean I have that condition?",
        answer: "Not necessarily. Codes can record symptoms or a condition being ruled out. Ask your doctor what was found.",
      },
    ],
    sources: [SRC.icd10, SRC.hcpcs],
    related: ["cpt-code-on-medical-bill", "claim-denied-on-eob", "understand-your-medical-bill"],
  },
  {
    slug: "how-to-check-a-hospital-bill-for-errors",
    category: "bills",
    metaTitle: "How to check a hospital bill for errors, step by step",
    metaDescription:
      "A step-by-step way to check a hospital bill: get the itemized bill, match it to your EOB, look for duplicates, and what to ask before you pay.",
    kicker: "CHECK A BILL",
    h1: "How to check a hospital bill for errors, step by step",
    answer:
      "Ask for an itemized bill, match it line by line against your insurer’s EOB, and check for duplicate charges, services you didn’t receive and charges billed before insurance was applied. Raise anything you can’t explain with the billing office before you pay.",
    why: [
      "A hospital’s first statement is usually a summary — a few lines and a total — so there is nothing to check against. The detail only appears on the itemized bill, which many people don’t know they can ask for.",
      "A single stay also produces several bills, from the hospital and from the clinicians who treated you, often weeks apart. It is easy to pay one twice or to pay before insurance has finished processing.",
    ],
    reading: [
      "1. Wait for the EOB. Your insurer’s explanation of benefits shows what was allowed, what the plan paid and what you may owe. That is the figure the bill should match.",
      "2. Ask for the itemized bill. It lists every charge with a date, a description and usually a code (CPT, HCPCS or a revenue code).",
      "3. Check the basics: your name, date of birth, insurance details and dates of admission and discharge.",
      "4. Look line by line for duplicates (the same code twice on one date), services you don’t recall, and charges for days you weren’t there.",
      "5. Check that insurance has been applied — the bill should show an insurance payment or adjustment.",
      "6. Note anything you can’t explain and call the billing office. Ask them to put the account on hold while it is reviewed, and keep a record of who you spoke to and when.",
    ],
    notMean: [
      "That every unfamiliar line is an error. Hospital bills list supplies, drugs and room charges in ways that look odd but can be correct.",
      "That a bill you’re disputing can be ignored. Keep talking to the billing office while it is reviewed.",
      "That you must pay first and argue later. Questions are easier to settle before the money has gone.",
    ],
    whereSeen: ["Hospital statements and itemized bills, by post or in a patient portal.", "Separate bills from emergency physicians, anesthesia, radiology and lab groups."],
    questions: [
      {
        who: "Ask the hospital billing office",
        items: [
          "Please send me an itemized bill with codes for every charge.",
          "Has my insurer’s payment been applied?",
          "Can you put my account on hold while I query these charges?",
          "Do you have a financial assistance policy I can apply under?",
        ],
      },
    ],
    clariti:
      "Attach the itemized bill and Clariti explains each charge in plain words, quoting the lines it reads, and flags ones worth checking — like a code that appears twice on one date. Attach the EOB too and it explains that, so you can compare the two.",
    ctaPrompt: "Checking a hospital bill? Attach it or take a photo, and Clariti will explain each charge and flag what to ask about.",
    faqs: [
      {
        question: "How do I get an itemized hospital bill?",
        answer: "Call or write to the hospital’s billing office and ask for an itemized bill with the codes for each charge.",
      },
      {
        question: "What are the most common hospital billing errors?",
        answer: "Duplicate charges, charges for services you didn’t receive, wrong dates, and bills sent before insurance was applied are all worth checking for.",
      },
      {
        question: "Who can help if a billing dispute isn’t resolved?",
        answer: "Your insurer, and for surprise out-of-network bills, the No Surprises Help Desk run by CMS on 1-800-985-3059.",
      },
    ],
    sources: [SRC.billRights, SRC.hcpcs],
    related: ["understand-your-medical-bill", "why-two-bills-for-one-hospital-visit", "cpt-code-on-medical-bill"],
  },
  {
    slug: "why-two-bills-for-one-hospital-visit",
    category: "bills",
    metaTitle: "Why did I get two bills for one hospital visit?",
    metaDescription:
      "Hospitals and the clinicians who treat you often bill separately. How facility and professional bills differ and how to match each to an EOB.",
    kicker: "TWO BILLS",
    h1: "Why did I get two (or more) bills for one hospital visit?",
    answer:
      "Because the hospital and the clinicians who treated you often bill separately. The hospital’s bill covers the facility — the room, nursing, equipment and supplies — while doctors such as the emergency physician, anesthesiologist or radiologist may send their own “professional” bills.",
    why: [
      "From the inside it felt like one visit, so a second bill from a company you have never heard of looks like a mistake or a scam. Often it is a physician group that works in the hospital but bills on its own.",
      "Each bill also has its own EOB from your insurer, and they arrive at different times, so it is easy to lose track of what has been paid.",
    ],
    reading: [
      "Look at who sent each bill. A hospital or facility bill usually lists room, emergency department, lab, pharmacy and supply charges. A professional bill comes from a physician group and lists the clinician’s services, often with CPT codes.",
      "Match each bill to the EOB with the same provider name and date of service. Each should have its own “you may owe” figure.",
      "Check network status. Clinicians at an in-network hospital are not always in your network. For some care at in-network hospitals and for emergencies, the No Surprises Act limits what out-of-network providers can bill you.",
    ],
    notMean: [
      "That you are being charged twice for the same thing. Facility and professional fees cover different parts of the care.",
      "That an unfamiliar company’s bill is genuine just because it names the hospital. Match it to an EOB before paying.",
      "That every bill from the same visit has the same network status.",
    ],
    whereSeen: ["Separate statements from the hospital and from physician groups (emergency, anesthesia, radiology, pathology).", "Separate claims on your insurer’s app or EOBs."],
    questions: [
      {
        who: "Ask the billing office on each bill",
        items: ["What service does this bill cover, and who provided it?", "Has it been sent to my insurer?"],
      },
      { who: "Ask your insurer", items: ["How many claims are there for this date?", "Was each provider in network?"] },
    ],
    clariti:
      "Attach each bill and Clariti explains who it is from and what it covers, in plain words, quoting the lines it reads. It flags charges worth checking and suggests questions for each billing office.",
    ctaPrompt: "Not sure what a second bill is for? Attach it, and Clariti will explain who sent it and what it covers.",
    faqs: [
      {
        question: "What is a facility fee?",
        answer: "A charge from the hospital or facility for the setting of your care — the room, staff, equipment and supplies — separate from the clinician’s own fee.",
      },
      {
        question: "Why did I get a bill from a doctor I never met?",
        answer: "Some clinicians, such as radiologists or pathologists, review scans or samples without meeting you, and bill separately for that work.",
      },
      {
        question: "Can an out-of-network doctor at an in-network hospital bill me more?",
        answer: "For emergencies and some non-emergency care at in-network facilities, the No Surprises Act protects most insured people from surprise out-of-network bills.",
      },
    ],
    sources: [SRC.billRights, SRC.network],
    related: ["out-of-network-and-balance-billing", "how-to-check-a-hospital-bill-for-errors", "eob-vs-medical-bill"],
  },
  {
    slug: "er-visit-level-codes-99281-99285",
    category: "bills",
    metaTitle: "ER visit levels 99281–99285 on a bill, explained",
    metaDescription:
      "Emergency department visits are billed at five levels, CPT 99281 to 99285. What the level means, what it doesn’t, and what to ask.",
    kicker: "ER VISIT LEVELS",
    h1: "What do ER visit codes 99281–99285 mean on my bill?",
    answer:
      "CPT codes 99281 to 99285 are the five levels used to bill an emergency department visit, from the least to the most complex. The level reflects how complex the visit was judged to be — not how long you waited — and a higher level usually means a higher charge.",
    why: [
      "The level often appears as just “ER visit level 4” or “ED VISIT 99284”, and people assume it is a rating of how sick they were or how long they spent there.",
      "The level is for the evaluation and management part of the visit. Tests, scans, drugs and procedures are billed on their own lines, so one ER visit can produce a long bill.",
    ],
    reading: [
      "Find the visit line on the itemized bill. It may appear on the hospital’s bill, and a similar code may appear on a separate bill from the emergency physician group.",
      "Read the level as a billing category: 99281 is the lowest, 99285 the highest. The level is chosen from the visit’s documentation.",
      "If the level seems high for what happened, it is reasonable to ask the provider how it was chosen and to see the documentation it was based on.",
    ],
    notMean: [
      "That the level is a measure of how serious your condition was. It is about the complexity of the visit as documented.",
      "That waiting longer means a higher level. Waiting time isn’t what it measures.",
      "That it is the whole charge for the visit. Tests and treatment are billed separately.",
    ],
    whereSeen: ["Hospital itemized bills, on the emergency department visit line.", "Bills from emergency physician groups.", "Insurance EOBs, as the procedure code for the visit."],
    questions: [
      {
        who: "Ask the billing office",
        items: ["Which visit level was billed, and how was it chosen?", "Is there a separate bill from the emergency physician?", "Has my insurer’s payment been applied?"],
      },
    ],
    clariti:
      "Attach the bill and Clariti explains the visit-level line and every other charge in plain words, quoting your document, and suggests what to ask the billing office.",
    ctaPrompt: "Got an ER bill you can’t follow? Attach it or take a photo, and Clariti will explain each line.",
    faqs: [
      {
        question: "What is the difference between 99284 and 99285?",
        answer: "Both are emergency department visit codes. 99285 is the highest of the five levels and 99284 the next one down; the level reflects how complex the visit was as documented.",
      },
      {
        question: "Why is there a separate bill from the ER doctor?",
        answer: "Emergency physicians are often part of a separate group that bills for their own services, apart from the hospital’s facility bill.",
      },
      {
        question: "Am I protected from surprise ER bills?",
        answer: "CMS says the No Surprises Act protects most insured people from unexpected out-of-network bills for emergency room visits.",
      },
    ],
    sources: [SRC.ama, SRC.hcpcs, SRC.billRights],
    related: ["cpt-code-on-medical-bill", "why-two-bills-for-one-hospital-visit", "understand-your-medical-bill"],
  },
  {
    slug: "good-faith-estimate",
    category: "bills",
    metaTitle: "Good faith estimate: what it is and the $400 rule",
    metaDescription:
      "If you’re uninsured or self-paying, providers usually must give a good faith estimate. What it covers and when you can dispute a bill.",
    kicker: "GOOD FAITH ESTIMATE",
    h1: "What is a good faith estimate, and what if my bill is higher?",
    answer:
      "A good faith estimate is a provider’s written estimate of what your care will cost if you don’t have or don’t use health insurance. CMS says you usually get one when you schedule care at least 3 business days ahead or ask for one — and you may be able to dispute the bill if it is at least $400 more than the estimate.",
    why: [
      "Most people never see one, because the rule is for people who are uninsured or choose to pay themselves. Those are the people most exposed to a large bill.",
      "An estimate from one provider may not include everything — a separate lab or anesthesia charge, for example — so the final bills can add up to more than the figure you were given.",
    ],
    reading: [
      "Check who it is from and what it covers: the services, the expected dates and the expected charges. Keep a copy.",
      "When the bills arrive, compare each one with the estimate for that provider.",
      "If a bill is at least $400 more than the estimate, CMS says you may be able to dispute it. Its help line (1-800-985-3059) can explain the process and take complaints.",
    ],
    notMean: [
      "That the estimate is a fixed price. It is an estimate, and bills can differ.",
      "That it applies when you use insurance. Insured people are covered by other No Surprises Act protections instead.",
      "That a bill $400 over is automatically cancelled. You may be able to dispute it through the process CMS describes.",
    ],
    whereSeen: ["Written estimates from providers when you book care as a self-pay patient.", "Price discussions before planned procedures."],
    questions: [
      {
        who: "Ask the provider",
        items: [
          "Can I have a good faith estimate for this care?",
          "Does it include other providers involved, such as anesthesia or lab work?",
          "Why is my bill different from the estimate?",
        ],
      },
    ],
    clariti:
      "Attach the bill and Clariti explains each charge in plain words, quoting your document. Attach the estimate separately and it explains that too, so you can see where the two differ.",
    ctaPrompt: "Bill higher than your estimate? Attach it, and Clariti will explain each charge so you know what to ask.",
    faqs: [
      {
        question: "Who can get a good faith estimate?",
        answer: "CMS says providers usually must give one if you don’t have or don’t use health insurance and you schedule care at least 3 business days ahead or ask for one.",
      },
      {
        question: "What is the $400 rule?",
        answer: "CMS says you may be able to dispute your bill if it is at least $400 more than your good faith estimate.",
      },
      {
        question: "Where can I get help?",
        answer: "CMS runs a No Surprises Act help line at 1-800-985-3059 for questions and complaints.",
      },
    ],
    sources: [SRC.billRights],
    related: ["out-of-network-and-balance-billing", "how-to-check-a-hospital-bill-for-errors", "understand-your-medical-bill"],
  },

  // ——— Lab and blood test results ———
  {
    slug: "what-does-reference-range-mean",
    category: "labs",
    metaTitle: "What does “reference range” mean on lab results?",
    metaDescription:
      "A reference range is the span of results seen in most healthy people, for that lab and method. Why results outside it aren’t always a problem.",
    kicker: "REFERENCE RANGE",
    h1: "What does “reference range” mean on my lab results?",
    answer:
      "A reference range is the span of results found in most healthy people for that test, at that lab, using that method. It is printed beside your result so you can see where it sits — but a result just outside the range is not necessarily a problem, and one inside it is not a guarantee.",
    why: [
      "Ranges look like pass/fail limits, and a result one point outside gets a flag that feels alarming. But ranges are set from large groups of healthy people, so it is common for a healthy person to sit outside one now and then.",
      "Ranges also differ between labs, because labs use different equipment and methods. A range you find online may not apply to your report.",
    ],
    reading: [
      "Read your result against the range printed on your own report, in the same units. MedlinePlus is clear that you can’t compare your results with reference ranges found elsewhere.",
      "Look at how far outside the range a result is, and whether related results are also outside. Then look for any comment from the lab.",
      "Some tests have different ranges for different groups — children and adults, for example — and the lab chooses the range that fits the person tested.",
      "Your doctor reads results alongside your history, symptoms, medicines and earlier results, which is why the same number can mean different things for different people.",
    ],
    notMean: [
      "That a flagged result means you are ill. Healthy people sometimes fall outside a range.",
      "That a result inside the range means everything is fine. Some people with health problems have results in range.",
      "That two labs’ results can be compared directly. Check the units and ranges first.",
    ],
    whereSeen: ["Every lab report, usually in a column next to your result.", "Patient portals, sometimes as a bar or a shaded band."],
    questions: [
      {
        who: "Ask your doctor",
        items: [
          "Which of my results outside the range matter for me?",
          "Do any results need repeating?",
          "How do these compare with my earlier results?",
        ],
      },
    ],
    clariti:
      "Attach a lab report and Clariti explains what each test measures and where your result sits against the range printed on that report, quoting the lines it reads, and suggests questions for your doctor. It does not tell you what your results mean for your health. If you add an earlier report, Clariti can show what changed between the two.",
    ctaPrompt: "Got results with flags you don’t understand? Attach the report or paste the text, and Clariti will explain each line.",
    faqs: [
      {
        question: "Why are reference ranges different between labs?",
        answer: "Labs use different equipment and testing methods, so each sets ranges for its own tests. Use the range on your own report.",
      },
      {
        question: "Is a result slightly outside the range bad?",
        answer: "Not necessarily. Ranges are based on healthy people and some healthy people fall outside them. Your doctor interprets results in context.",
      },
      {
        question: "Is a reference range the same as a target?",
        answer: "No. A range describes results in healthy people. Some tests, such as cholesterol or HbA1c, also have targets that depend on your own health — your doctor sets those.",
      },
    ],
    sources: [SRC.labResults, SRC.nhsBlood],
    related: ["lab-results-explained", "cbc-results-explained", "comprehensive-metabolic-panel-explained"],
  },
  {
    slug: "cbc-results-explained",
    category: "labs",
    metaTitle: "CBC blood test results explained (full blood count)",
    metaDescription:
      "What each line on a complete blood count (CBC, or full blood count) measures — red cells, hemoglobin, MCV, white cells, platelets.",
    kicker: "CBC / FULL BLOOD COUNT",
    h1: "CBC blood test results explained",
    answer:
      "A complete blood count (CBC) — called a full blood count (FBC) in the UK — measures your red blood cells, white blood cells and platelets, plus hemoglobin, hematocrit and the average size of your red cells (MCV). It is one of the most common blood tests and is often part of a routine check-up.",
    why: [
      "A CBC report can run to 20 lines of abbreviations — RBC, Hgb, Hct, MCV, MCH, MCHC, RDW, PLT, WBC and a differential — with flags scattered through it.",
      "Many of these lines are related. Several describe red cells in different ways, so one underlying change can flag several lines at once.",
    ],
    reading: [
      "Red cells: RBC is the number of red blood cells, which carry oxygen. Hemoglobin (Hb or Hgb) is the iron-rich protein inside them that carries the oxygen. Hematocrit (Hct) is the proportion of your blood made up of red cells.",
      "Red cell indices: MCV is the average size of red cells; MCH and MCHC describe how much hemoglobin they hold. RDW, where reported, describes how much red cell size varies.",
      "White cells: WBC is the total number of white blood cells, which fight infection. A “CBC with differential” also counts each of the five main types.",
      "Platelets (PLT): cells that help blood clot.",
      "MedlinePlus notes that results outside the range don’t always mean a condition that needs treatment — diet, activity, medicines, menstrual periods and not drinking enough water can all affect them.",
    ],
    notMean: [
      "That a flag on one line is a diagnosis. Your doctor looks at the lines together and with your history.",
      "That a normal CBC rules everything out. It is one tool among many.",
      "That UK and US reports are directly comparable. Units can differ (g/L versus g/dL for hemoglobin, for example).",
    ],
    whereSeen: ["Routine blood test reports, often at the top of the results.", "Hospital and GP results in a patient portal or the NHS App."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["Which of these results matter for me?", "Are any flagged results related to each other?", "Do I need a repeat test?"],
      },
    ],
    clariti:
      "Attach a CBC report and Clariti explains what each line measures in plain words and where your number sits against the range printed on your report, quoting the lines it reads. It suggests questions for your doctor and doesn’t diagnose.",
    ctaPrompt: "Got a blood count full of abbreviations? Attach the report or paste the text, and Clariti will explain each line.",
    faqs: [
      {
        question: "Is a CBC the same as a full blood count?",
        answer: "Yes. Complete blood count (CBC) is the usual US name and full blood count (FBC) the usual UK name for the same group of tests.",
      },
      {
        question: "Do I need to fast for a CBC?",
        answer: "Usually not, MedlinePlus says — unless other tests are being done on the same sample. Follow the instructions you were given.",
      },
      {
        question: "What is a CBC with differential?",
        answer: "A CBC that also counts each of the five main types of white blood cell, rather than just the total.",
      },
    ],
    sources: [SRC.cbc, SRC.ltoFbc, SRC.nhsBlood],
    related: ["high-or-low-mcv", "what-does-reference-range-mean", "lab-results-explained"],
  },
  {
    slug: "high-or-low-mcv",
    category: "labs",
    metaTitle: "What does high or low MCV mean on a blood test?",
    metaDescription:
      "MCV is the average size of your red blood cells. What a high or low MCV is generally linked with, and why it is read with your other results.",
    kicker: "MCV",
    h1: "What does high or low MCV mean on a blood test?",
    answer:
      "MCV (mean corpuscular volume) is the average size of your red blood cells. A low MCV means the cells are smaller than usual and a high MCV means they are larger; doctors use it alongside hemoglobin and other results to work out the type and cause of anemia, if there is one.",
    why: [
      "MCV is flagged on its own line, often with no explanation, and searching it brings up lists of conditions. But MCV mostly makes sense in combination: it is a clue to the type of red cell change, not a finding in itself.",
      "It is reported in femtolitres (fL), a unit most people have never seen, which makes the number feel more technical than it is.",
    ],
    reading: [
      "MedlinePlus gives 79 to 95 femtolitres as a common normal range for MCV, but notes ranges vary slightly between labs — use the range on your report.",
      "In general terms, MedlinePlus describes low MCV (smaller cells) as linked with microcytic anemia, which may be due to low iron levels, lead poisoning or thalassemia. High MCV (larger cells) is linked with macrocytic anemia, which may be due to low folate or vitamin B12 levels or chemotherapy, and with liver disease.",
      "Read MCV next to hemoglobin: whether hemoglobin is low too, and whether other red cell indices (MCH, MCHC) are also outside their ranges. That combination is what your doctor looks at.",
    ],
    notMean: [
      "That you have any of the conditions linked with it. Those are things a doctor may look into, not conclusions.",
      "That an MCV just outside the range is significant on its own. Your doctor reads it with your other results.",
      "That you should start iron or vitamin supplements because of it. Ask your doctor first.",
    ],
    whereSeen: ["Complete blood count (CBC) or full blood count (FBC) reports, in the red cell indices.", "Sometimes listed as “mean cell volume”."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["Is my MCV result important alongside my other results?", "Do I need any further tests?", "Could any of my medicines affect this?"],
      },
    ],
    clariti:
      "Attach the blood count and Clariti explains what MCV and the related red cell lines measure, and where your numbers sit against your lab’s ranges, quoting the report. It suggests questions for your doctor and doesn’t tell you the cause.",
    ctaPrompt: "MCV flagged on your results? Attach the report or paste the text, and Clariti will explain it alongside the other lines.",
    faqs: [
      {
        question: "What does MCV stand for?",
        answer: "Mean corpuscular volume — the average size of your red blood cells. UK reports sometimes call it mean cell volume.",
      },
      {
        question: "What is a normal MCV?",
        answer: "MedlinePlus gives 79 to 95 femtolitres as a common range, but labs vary. Use the range printed on your own report.",
      },
      {
        question: "Can MCV be high or low without anemia?",
        answer: "Yes. MCV describes cell size, and your doctor reads it together with hemoglobin and your other results.",
      },
    ],
    sources: [SRC.rbcIndices, SRC.ltoIndices, SRC.cbc],
    related: ["cbc-results-explained", "what-does-reference-range-mean", "lab-results-explained"],
  },
  {
    slug: "lipid-panel-results-explained",
    category: "labs",
    metaTitle: "Lipid panel (cholesterol test) results explained",
    metaDescription:
      "What total cholesterol, LDL, HDL, non-HDL and triglycerides mean on a lipid panel, and why US and UK reports use different units.",
    kicker: "LIPID PANEL",
    h1: "Lipid panel results explained: total cholesterol, LDL, HDL and triglycerides",
    answer:
      "A lipid panel (cholesterol test or lipid profile) measures the fats in your blood: total cholesterol, HDL (“good”) cholesterol, LDL (“bad”) cholesterol and triglycerides, often with non-HDL cholesterol and a cholesterol:HDL ratio. Doctors use it, with other factors, to estimate your risk of heart and circulation problems.",
    why: [
      "The same test is reported in different units: US labs usually use milligrams per decilitre (mg/dL), and UK labs millimoles per litre (mmol/L). A healthy number in one looks alarming in the other.",
      "Some lines are measured and some are calculated. LDL is often a calculated estimate, and non-HDL is simply total cholesterol minus HDL.",
    ],
    reading: [
      "Total cholesterol: all the cholesterol in your blood.",
      "HDL cholesterol: often called “good” cholesterol, because it is carried to the liver for removal. Higher is generally better.",
      "LDL cholesterol: often called “bad” cholesterol; too much is linked with the build-up of plaque in the arteries.",
      "Non-HDL cholesterol: total cholesterol minus HDL — all the “bad” types together.",
      "Triglycerides: another type of fat in the blood.",
      "As a guide for healthy adults, the NHS gives total cholesterol below 5 mmol/L, non-HDL below 4 mmol/L, and HDL above 1.0 mmol/L for men or 1.2 mmol/L for women. It adds that a good target for you depends on your age, health conditions and risk — your doctor will use your results with those factors.",
    ],
    notMean: [
      "That one high number means you will have a heart attack. Doctors look at cholesterol with blood pressure, age and other factors.",
      "That numbers in mg/dL and mmol/L can be compared directly. Check the units first.",
      "That you always need to fast. The NHS says it doesn’t make much difference to these levels whether you have eaten, though your doctor may still ask you to fast.",
    ],
    whereSeen: ["Lipid panel, lipid profile or cholesterol test reports.", "NHS Health Check results and GP records."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["What target level is right for me?", "How do these results fit with my overall risk?", "When should I be tested again?"],
      },
    ],
    clariti:
      "Attach a lipid panel and Clariti explains each line and its units in plain words and where each result sits against the ranges printed on your report, quoting the report. It doesn’t estimate your risk — your doctor does.",
    ctaPrompt: "Got cholesterol results you can’t read? Attach the report or paste the text, and Clariti will explain each line.",
    faqs: [
      {
        question: "What is non-HDL cholesterol?",
        answer: "Total cholesterol minus HDL cholesterol. It counts all the types of cholesterol other than HDL.",
      },
      {
        question: "Do I need to fast before a cholesterol test?",
        answer: "MedlinePlus says you may need to fast for 9 to 12 hours; the NHS says eating beforehand doesn’t make much difference to the levels. Follow your own instructions.",
      },
      {
        question: "Why are UK cholesterol numbers so much smaller?",
        answer: "UK labs report in mmol/L and US labs in mg/dL. The units are different, not the cholesterol.",
      },
    ],
    sources: [SRC.nhsCholesterol, SRC.cholesterol, SRC.ltoLipid],
    related: ["hba1c-result-explained", "what-does-reference-range-mean", "lab-results-explained"],
  },
  {
    slug: "hba1c-result-explained",
    category: "labs",
    metaTitle: "HbA1c result explained: % and mmol/mol",
    metaDescription:
      "HbA1c shows your average blood sugar over 2–3 months. How it is reported in % and mmol/mol, the ranges used, and what can affect it.",
    kicker: "HBA1C",
    h1: "HbA1c result explained",
    answer:
      "HbA1c (A1C) is a blood test that reflects your average blood sugar over the past two to three months, by measuring how much of the hemoglobin in your red blood cells has glucose attached. It is used to screen for and diagnose type 2 diabetes and prediabetes, and to monitor diabetes.",
    why: [
      "It is reported two ways. US labs use a percentage; UK labs use millimoles per mole (mmol/mol). The same result looks completely different — 6.5% and 48 mmol/mol are the diagnostic threshold in each unit.",
      "It also behaves differently from a finger-prick glucose reading. A glucose test shows your level at that moment; HbA1c shows an average, because glucose stays attached to hemoglobin for the life of the red cell — about three months.",
    ],
    reading: [
      "In percentages, MedlinePlus lists the ranges commonly used to diagnose diabetes or prediabetes: normal below 5.7%, prediabetes 5.7% to 6.4%, and diabetes 6.5% or higher.",
      "In mmol/mol, Lab Tests Online UK gives the WHO guideline: below 42 not diabetes, 42 to 47 prediabetes, and 48 or over indicative of diabetes — with repeat testing to confirm if there are no symptoms.",
      "Doctors often use more than one test to diagnose diabetes. If you already have diabetes, your target is set with your care team and may differ from these figures.",
      "Some things can make HbA1c less accurate, including anemia, some hemoglobin variants, heavy bleeding, recent transfusion and pregnancy.",
    ],
    notMean: [
      "That one result confirms a diagnosis. A repeat test or a different test is often used.",
      "That the diagnostic ranges are your personal target if you have diabetes. Your care team sets that.",
      "That it reflects what you ate yesterday. It is a two-to-three-month average.",
    ],
    whereSeen: ["Diabetes screening and monitoring results.", "NHS Health Check and routine blood test reports, often as “HbA1c” or “glycated hemoglobin”."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["What does my HbA1c mean for me?", "Do I need a repeat test or another type of test?", "Could anything have affected the result?"],
      },
    ],
    clariti:
      "Attach the report and Clariti explains what HbA1c measures, which units your lab used and where your result sits against the range printed on your report, quoting it. It doesn’t diagnose. If you add an earlier HbA1c report, Clariti can show what changed between them.",
    ctaPrompt: "Got an HbA1c result you’d like explained? Attach the report or paste the text, and Clariti will explain what it shows.",
    faqs: [
      {
        question: "What is the difference between HbA1c in % and mmol/mol?",
        answer: "They are two units for the same test. US labs usually report a percentage and UK labs mmol/mol. 6.5% corresponds to 48 mmol/mol.",
      },
      {
        question: "Do I need to fast for an HbA1c test?",
        answer: "Lab Tests Online UK says no preparation is needed. Follow any instructions you were given, especially if other tests are being done.",
      },
      {
        question: "What can make an HbA1c result inaccurate?",
        answer: "Conditions that affect red blood cells, such as anemia or hemoglobin variants, heavy bleeding, recent transfusion and pregnancy, among others.",
      },
    ],
    sources: [SRC.a1c, SRC.ltoA1c],
    related: ["lipid-panel-results-explained", "what-does-reference-range-mean", "comprehensive-metabolic-panel-explained"],
  },
  {
    slug: "egfr-result-explained",
    category: "labs",
    metaTitle: "eGFR result explained: what the number means",
    metaDescription:
      "eGFR estimates how well your kidneys filter blood, calculated from creatinine. How it is reported, the stages used, and what can affect it.",
    kicker: "EGFR",
    h1: "eGFR result explained",
    answer:
      "eGFR (estimated glomerular filtration rate) is a calculated estimate of how much blood your kidneys filter each minute, worked out from the creatinine in your blood along with your age and sex. It is reported in mL/min/1.73m², and a higher number means the kidneys are filtering more.",
    why: [
      "It looks like a measurement, but it is an estimate from a formula. Things that change creatinine without changing the kidneys — muscle mass, a meal of meat, creatine supplements — can move it.",
      "Results are also described in stages, and a number in a lower band can sound like a diagnosis even though a single result can’t show whether a change is lasting.",
    ],
    reading: [
      "The NHS says healthy kidneys should be able to filter more than 90 ml/min. Lab Tests Online UK sets out the bands used: 90 or above is generally normal; 60 to 89 is mildly reduced and may still be normal for your age; 45 to 59 and 30 to 44 are stages 3a and 3b of chronic kidney disease; 15 to 29 is stage 4; below 15 is kidney failure.",
      "Doctors read eGFR with a urine test — the albumin:creatinine ratio (ACR) — and with earlier results. A lower number on its own isn’t always kidney disease, and kidney disease isn’t diagnosed from a single reading.",
      "eGFR is less accurate in some people, including during pregnancy and in people with very high or low muscle mass. A cystatin C-based estimate is sometimes used instead.",
    ],
    notMean: [
      "That one low result means kidney disease. Doctors look for a lasting change and other signs.",
      "That a result of 60 to 89 is a problem by itself. It can be normal for your age when there are no other signs.",
      "That eGFR is a percentage of kidney function. It is a filtration rate in mL/min/1.73m².",
    ],
    whereSeen: ["Kidney function results, renal panels and U&Es (urea and electrolytes), alongside creatinine.", "Metabolic panels (BMP or CMP) in the US."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["How does this eGFR compare with my earlier results?", "Do I need a urine test or a repeat blood test?", "Could anything I take or eat have affected it?"],
      },
    ],
    clariti:
      "Attach the report and Clariti explains eGFR, creatinine and the other kidney lines in plain words, and where your numbers sit against the ranges printed on your report, quoting it. If you add an earlier report, it can show what changed. It doesn’t diagnose kidney disease.",
    ctaPrompt: "Got an eGFR result you’d like explained? Attach the report or paste the text, and Clariti will explain each kidney line.",
    faqs: [
      {
        question: "What is a normal eGFR?",
        answer: "An eGFR of 90 or above is generally considered normal. 60 to 89 can be normal for your age if there are no other signs of kidney damage. Your doctor reads it in context.",
      },
      {
        question: "Should I avoid anything before an eGFR test?",
        answer: "Lab Tests Online UK notes NICE advice not to eat meat or fish in the 12 hours before, as it can raise creatinine. Follow the instructions you were given.",
      },
      {
        question: "Why is eGFR estimated rather than measured?",
        answer: "Measuring filtration directly is complex. eGFR is calculated from a routine blood test, which is practical for everyday care.",
      },
    ],
    sources: [SRC.nhsKidney, SRC.ltoEgfr, SRC.gfr],
    related: ["comprehensive-metabolic-panel-explained", "what-does-reference-range-mean", "lab-results-explained"],
  },
  {
    slug: "comprehensive-metabolic-panel-explained",
    category: "labs",
    metaTitle: "Comprehensive metabolic panel (CMP) results explained",
    metaDescription:
      "What the 14 tests in a CMP measure — glucose, electrolytes, kidney and liver tests, proteins — and how a BMP differs.",
    kicker: "CMP / METABOLIC PANEL",
    h1: "Comprehensive metabolic panel (CMP) results explained",
    answer:
      "A comprehensive metabolic panel (CMP) is a routine blood test that measures 14 substances: glucose, calcium, four electrolytes (sodium, potassium, bicarbonate, chloride), two kidney waste products (BUN and creatinine), proteins (albumin and total protein), and liver tests (ALP, ALT, AST and bilirubin).",
    why: [
      "Fourteen lines of abbreviations arrive at once, covering several different organs, with a flag or two that may be unrelated to anything you came in for.",
      "UK reports usually split the same tests into groups — “U&Es” for kidneys and electrolytes and “LFTs” or liver blood tests for the liver — so people comparing UK and US reports can’t find the same names.",
    ],
    reading: [
      "Glucose: your blood sugar at the time of the test.",
      "Calcium: a mineral needed by nerves, muscles and the heart.",
      "Electrolytes — sodium, potassium, bicarbonate (CO2) and chloride: minerals that control fluid balance and the acid–base balance of the blood.",
      "Kidney tests — BUN (blood urea nitrogen) and creatinine: waste products the kidneys filter out. An eGFR is often calculated from creatinine.",
      "Proteins — albumin and total protein: albumin is the main protein in blood and is made in the liver.",
      "Liver tests — ALP, ALT and AST (enzymes mainly made in the liver) and bilirubin (a waste product from the breakdown of old red cells).",
      "A basic metabolic panel (BMP) includes 8 of these 14 — it leaves out the proteins, bilirubin and liver enzymes.",
    ],
    notMean: [
      "That one flagged line points to a specific disease. Your doctor compares all the results and your history.",
      "That a glucose result means the same whether or not you had eaten. Check whether you were asked to fast.",
      "That names on a UK report and a US report always line up. The groupings differ.",
    ],
    whereSeen: ["Routine check-up results, often as “CMP”, “chem 14” or “metabolic panel”.", "In the UK, as U&Es (renal panel) and liver blood tests."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["Which of these results matter for me?", "Was I meant to fast, and does that affect any result?", "Do any results need repeating?"],
      },
    ],
    clariti:
      "Attach a metabolic panel and Clariti explains each of the lines in plain words, grouped by what they measure, and where each sits against the ranges printed on your report, quoting it. It suggests questions for your doctor and doesn’t diagnose.",
    ctaPrompt: "Got a metabolic panel you can’t follow? Attach the report or paste the text, and Clariti will explain each line.",
    faqs: [
      {
        question: "What is the difference between a CMP and a BMP?",
        answer: "A BMP includes 8 of the 14 tests in a CMP. It does not include total protein, albumin, bilirubin or the liver enzymes ALP, ALT and AST.",
      },
      {
        question: "Do I need to fast before a CMP?",
        answer: "You may need to fast for several hours, MedlinePlus says. Follow the instructions you were given.",
      },
      {
        question: "What is the UK equivalent of a CMP?",
        answer: "UK labs usually report the same tests in groups, such as urea and electrolytes (a renal panel) and liver blood tests, plus glucose and calcium.",
      },
    ],
    sources: [SRC.cmp, SRC.ltoRenal, SRC.ltoLiver],
    related: ["egfr-result-explained", "what-does-reference-range-mean", "cbc-results-explained"],
  },
  {
    slug: "tsh-result-explained",
    category: "labs",
    metaTitle: "TSH and thyroid test results explained",
    metaDescription:
      "TSH is the hormone that tells your thyroid how hard to work. Why high TSH and low TSH point in opposite directions, and how T4 fits in.",
    kicker: "TSH / THYROID",
    h1: "TSH and thyroid test results explained",
    answer:
      "TSH (thyroid-stimulating hormone) is made by the pituitary gland to tell your thyroid how much hormone to produce. Because it works like a thermostat, a high TSH usually goes with an underactive thyroid and a low TSH with an overactive one — which is the opposite of what most people expect.",
    why: [
      "People read “high” as “overactive”. With TSH it tends to be the other way round: when thyroid hormone levels are low, the pituitary makes more TSH to push the thyroid harder; when they are high, it makes little or none.",
      "Thyroid results also come as a set — TSH, free T4 and sometimes free T3 — and the pattern across them is what doctors read.",
    ],
    reading: [
      "Start with TSH, then look at free T4 (FT4). Some labs test TSH first and add FT4 automatically if TSH is abnormal.",
      "Lab Tests Online UK sets out the usual patterns: high TSH with low T4 suggests hypothyroidism; high TSH with normal T4 suggests mild (subclinical) hypothyroidism; low TSH with high T4 or T3 suggests hyperthyroidism. For people taking thyroid replacement, a low TSH may suggest the dose is too high.",
      "TSH can be outside its range when the thyroid is healthy. MedlinePlus notes that some serious illnesses, pregnancy and age over 80 can all affect TSH.",
    ],
    notMean: [
      "That high TSH means an overactive thyroid. It usually points the other way.",
      "That a TSH result tells you the cause. Other tests, such as thyroid antibodies, look for that.",
      "That you should change a thyroid medicine dose because of a result. Talk to your doctor first.",
    ],
    whereSeen: ["Thyroid function test (TFT) results.", "Routine blood tests and monitoring for people taking levothyroxine."],
    questions: [
      {
        who: "Ask your doctor",
        items: ["What do my TSH and T4 results show together?", "Do I need any more thyroid tests?", "Could an illness or a medicine have affected this?"],
      },
    ],
    clariti:
      "Attach thyroid results and Clariti explains what TSH, T4 and T3 measure and where each of your results sits against the ranges printed on your report, quoting it. It doesn’t diagnose, and it doesn’t adjust medicine doses.",
    ctaPrompt: "Got thyroid results you’d like explained? Attach the report or paste the text, and Clariti will walk through each line.",
    faqs: [
      {
        question: "Does high TSH mean an overactive thyroid?",
        answer: "Usually the opposite. A high TSH generally goes with an underactive thyroid, because the pituitary is pushing a slow thyroid harder.",
      },
      {
        question: "What is free T4?",
        answer: "The free, active form of thyroxine, the main hormone the thyroid makes. Most UK labs measure the free form.",
      },
      {
        question: "Can TSH be abnormal with a healthy thyroid?",
        answer: "Yes. MedlinePlus notes that serious illness, pregnancy and being over 80 can all affect TSH.",
      },
    ],
    sources: [SRC.tsh, SRC.ltoThyroid],
    related: ["what-does-reference-range-mean", "cbc-results-explained", "lab-results-explained"],
  },

  // ——— Hospital paperwork ———
  {
    slug: "discharge-summary-abbreviations",
    category: "hospital",
    metaTitle: "Discharge summary abbreviations: TDS, BD, PRN and more",
    metaDescription:
      "What common abbreviations on a hospital discharge summary and medicines list mean — TDS, BD, PRN, PO, NBM, 1/52, PMH, TTO and others.",
    kicker: "ABBREVIATIONS",
    h1: "Discharge summary abbreviations: what TDS, BD, PRN and the rest mean",
    answer:
      "Discharge summaries are written for other clinicians, so they use shorthand: OD means once a day, BD twice a day, TDS three times a day, QDS four times a day, PRN as needed, PO by mouth, and 1/52 one week. The list below covers the abbreviations people most often ask about.",
    why: [
      "Many abbreviations come from Latin (bis die, ter die sumendum, pro re nata), and UK and US hospitals use different ones for the same thing — UK BD and TDS, US BID and TID.",
      "The same letters can mean different things in different contexts, and these documents are often the only written record of what changed with your medicines.",
    ],
    reading: [
      "How often: OD or QD — once a day; BD or BID — twice a day; TDS or TID — three times a day; QDS or QID — four times a day; PRN — as needed; nocte — at night; mane — in the morning; stat — straight away (usually given in hospital).",
      "How it is taken: PO — by mouth; IV — into a vein; SC or SubQ — under the skin; IM — into a muscle; PR — rectally; inh — inhaled; top — on the skin.",
      "Time: 1/7 — one day; 1/52 — one week; 1/12 — one month. So “review in 6/52” means in six weeks.",
      "Notes: PMH — past medical history; Hx — history; Dx — diagnosis; Rx — treatment or prescription; c/o — complaining of; NAD — no abnormality detected; NBM — nil by mouth; TTO or TTA — medicines to take home; f/u — follow-up.",
      "Scans are often shortened too — CXR for chest X-ray, CT, MRI, US or USS for ultrasound. For the wording inside a radiology report itself, see Radily’s phrase guides.",
    ],
    notMean: [
      "That an abbreviation’s meaning is always the same. If one is unclear on your own summary, ask the ward, your GP or a pharmacist.",
      "That PRN means “take as much as you like”. A PRN instruction usually still has a maximum — check the label or ask the pharmacist.",
      "That the summary replaces the instructions on your medicine labels. Follow the labels and ask if they differ.",
    ],
    whereSeen: ["Hospital discharge summaries and letters to your GP.", "Medicines lists, prescription labels and clinic letters."],
    questions: [
      {
        who: "Ask the ward or your pharmacist",
        items: ["What does this abbreviation mean on my summary?", "Which medicines are new, changed or stopped?", "Is there a maximum for my as-needed medicine?"],
      },
    ],
    clariti:
      "Attach or paste a discharge summary and Clariti expands every abbreviation in plain language and explains each section — medicines, follow-up, warning signs — quoting the lines it reads. It suggests questions for your doctor or pharmacist and doesn’t change any instruction.",
    ctaPrompt: "Got a discharge summary full of shorthand? Attach it or paste the text, and Clariti will spell it all out.",
    faqs: [
      {
        question: "What does TDS mean on a prescription?",
        answer: "Three times a day. The US equivalent is TID.",
      },
      {
        question: "What does PRN mean?",
        answer: "As needed — from the Latin pro re nata. There is usually still a limit on how much and how often, shown on the label.",
      },
      {
        question: "What does 1/52 mean on a hospital letter?",
        answer: "One week. The number after the slash is the unit: /7 days, /52 weeks, /12 months.",
      },
    ],
    sources: [SRC.discharge],
    related: ["discharge-summary-explained", "lab-results-explained", "cbc-results-explained"],
  },
];

export function getTopic(slug: string) {
  return TOPICS.find((topic) => topic.slug === slug);
}
