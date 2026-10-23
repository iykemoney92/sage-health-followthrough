/**
 * The public guides under /guides — one per document type people search for.
 *
 * Each one answers the search ("how do I read an EOB?") on the page, with an
 * invented worked example, before it asks for anything. The examples are made up
 * and labelled so; no line on them belongs to a real person, provider or plan.
 * The wording stays educational: what the paperwork says and what to ask, never
 * what someone's result means for them or what they should do medically.
 */

export type GuideExampleRow = {
  label: string;
  value: string;
  reading: string;
};

export type Guide = {
  slug: string;
  /** The <title> and the search result line. */
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  h1: string;
  intro: string[];
  partsHeading: string;
  parts: { term: string; meaning: string }[];
  example: {
    heading: string;
    caption: string;
    rows: GuideExampleRow[];
    takeaway: string;
  };
  checks: string[];
  questions: { who: string; items: string[] }[];
  getHelp: string;
  faqs: { question: string; answer: string }[];
  ctaPrompt: string;
  related: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "how-to-read-an-eob",
    metaTitle: "How to read an explanation of benefits (EOB)",
    metaDescription:
      "What each line on an insurance EOB means — billed, allowed, plan paid, what you may owe — with a worked example and what to check before you pay the bill.",
    kicker: "INSURANCE EOB",
    h1: "How to read an explanation of benefits (EOB)",
    intro: [
      "An explanation of benefits (EOB) is the statement your health insurer sends after it processes a claim. It shows what your provider charged, what your plan allowed, what the plan paid, and what may be left for you to pay.",
      "An EOB is not a bill. The bill comes from the doctor, hospital or lab — usually a few weeks later — and the amount on it should match the “you may owe” figure on the EOB. Reading the two side by side is the simplest way to catch a billing mistake.",
    ],
    partsHeading: "The parts of an EOB",
    parts: [
      { term: "Claim number", meaning: "The insurer’s reference for this visit. Quote it whenever you call about the claim." },
      { term: "Service date and provider", meaning: "When you were seen and who billed for it. Check both are right." },
      { term: "Amount billed (provider charges)", meaning: "The provider’s full list price. Few people with insurance pay this." },
      { term: "Allowed amount", meaning: "The price your plan has agreed for that service with an in-network provider. Everything else is based on this number, not the billed amount." },
      { term: "Discount or adjustment", meaning: "The difference between billed and allowed. An in-network provider generally writes this off rather than charging you for it." },
      { term: "Plan paid", meaning: "What the insurer paid the provider." },
      { term: "Deductible, copay and coinsurance", meaning: "Your share. The deductible is what you pay before the plan starts sharing costs; a copay is a flat fee; coinsurance is a percentage of the allowed amount." },
      { term: "You may owe (patient responsibility)", meaning: "What the provider can bill you for this claim. Compare it with the bill when it arrives." },
      { term: "Remark or reason codes", meaning: "Short codes explaining a denial or adjustment, decoded somewhere on the EOB — often on the back or the last page." },
    ],
    example: {
      heading: "A worked example",
      caption: "An invented EOB line for an in-network MRI. Not anyone’s real claim.",
      rows: [
        { label: "Amount billed", value: "$2,400.00", reading: "The imaging centre’s list price." },
        { label: "Allowed amount", value: "$900.00", reading: "The plan’s agreed price. The other $1,500 is written off." },
        { label: "Applied to deductible", value: "$500.00", reading: "You pay this part first because the deductible was not yet met." },
        { label: "Coinsurance (20%)", value: "$80.00", reading: "20% of the remaining $400." },
        { label: "Plan paid", value: "$320.00", reading: "80% of the remaining $400." },
        { label: "You may owe", value: "$580.00", reading: "$500 deductible + $80 coinsurance. This is what the bill should say." },
      ],
      takeaway:
        "If the imaging centre later sends a bill for $2,400 — or for anything other than $580 — the EOB is your evidence to ask why.",
    },
    checks: [
      "Your name, the patient’s name and the service dates are right.",
      "Every service listed is one you actually had.",
      "The provider is shown as in-network if you chose an in-network provider.",
      "Any denial has a reason code, and you understand what it says.",
      "The “you may owe” figure matches the bill from the provider.",
    ],
    questions: [
      {
        who: "Ask your insurer",
        items: [
          "Why was this service denied, and how do I appeal?",
          "How much of my deductible and out-of-pocket maximum is left?",
          "Was this provider processed as in-network?",
        ],
      },
      {
        who: "Ask the provider’s billing office",
        items: [
          "Has my insurer’s payment been applied to this bill?",
          "Why does the bill differ from the amount on my EOB?",
          "Can I have an itemized bill?",
        ],
      },
    ],
    getHelp:
      "If a claim is denied or the bill does not match the EOB, call your insurer first with the claim number. Most plans have a written appeal process with a deadline printed on the EOB.",
    faqs: [
      {
        question: "Is an EOB a bill?",
        answer: "No. An EOB comes from your insurer and explains how a claim was processed. The bill comes from the provider. Wait for the bill, and check it against the EOB before paying.",
      },
      {
        question: "Why is the allowed amount so much lower than the billed amount?",
        answer: "In-network providers agree prices with insurers in advance. The billed amount is the provider’s list price; the allowed amount is the agreed price, and your share is worked out from it.",
      },
      {
        question: "What does “patient responsibility” mean on an EOB?",
        answer: "It is the part of the allowed amount the plan did not pay — deductible, copay, coinsurance, or a non-covered service — which the provider can bill you for.",
      },
    ],
    ctaPrompt: "Have an EOB you can’t make sense of? Attach it or take a photo, and Clariti will walk through each line.",
    related: ["understand-your-medical-bill", "lab-results-explained"],
  },
  {
    slug: "understand-your-medical-bill",
    metaTitle: "How to understand a medical bill (and spot errors)",
    metaDescription:
      "What the charges, codes and adjustments on a medical bill mean, a worked example, and a checklist of errors to look for before you pay.",
    kicker: "MEDICAL BILL",
    h1: "How to understand a medical bill — and spot errors before you pay",
    intro: [
      "A medical bill from a hospital, clinic or lab lists what was charged, what insurance has paid or adjusted, and what the provider is asking you to pay. Bills are often a summary; the detail sits on an itemized bill you can ask for.",
      "Billing mistakes are common — duplicate charges, services you did not receive, or a bill sent before insurance was applied. A few minutes checking it against your insurer’s explanation of benefits (EOB) is worth it before you pay.",
    ],
    partsHeading: "The parts of a medical bill",
    parts: [
      { term: "Account or statement number", meaning: "The provider’s reference. Quote it when you call the billing office." },
      { term: "Date of service", meaning: "When the care happened. One bill can cover several dates." },
      { term: "Description and codes", meaning: "Each service, often with a CPT or HCPCS code (what was done) and sometimes an ICD-10 code (why). The codes are what the insurer was billed for." },
      { term: "Charges", meaning: "The provider’s list price for each line." },
      { term: "Insurance payments", meaning: "What your insurer has paid so far." },
      { term: "Adjustments", meaning: "Amounts written off — usually the in-network discount agreed with your insurer." },
      { term: "Patient balance / amount due", meaning: "What the provider is asking you to pay now, and by when." },
    ],
    example: {
      heading: "A worked example",
      caption: "An invented emergency-room bill summary. Not anyone’s real bill.",
      rows: [
        { label: "ER visit, level 4 (99284)", value: "$1,850.00", reading: "The emergency department’s charge for the visit itself. The level reflects how complex the visit was coded." },
        { label: "Lab: CBC (85025)", value: "$145.00", reading: "A complete blood count." },
        { label: "Lab: CBC (85025)", value: "$145.00", reading: "The same code on the same date twice — worth asking about." },
        { label: "Insurance payment", value: "−$1,120.00", reading: "What the insurer paid." },
        { label: "Contractual adjustment", value: "−$600.00", reading: "The in-network discount, written off." },
        { label: "Amount due", value: "$420.00", reading: "Compare with the EOB’s “you may owe” before paying." },
      ],
      takeaway:
        "The repeated CBC line may be a duplicate charge. Ask for an itemized bill and confirm whether the test was run twice.",
    },
    checks: [
      "Your name, insurance details and dates of service are correct.",
      "No line appears twice for the same date unless you really had it twice.",
      "Every service listed is one you received.",
      "Insurance has already been applied — the bill shows a payment or adjustment.",
      "The amount due matches the “you may owe” figure on your EOB.",
    ],
    questions: [
      {
        who: "Ask the billing office",
        items: [
          "Can you send me an itemized bill with the codes for each charge?",
          "Has this been billed to my insurance, and is anything still pending?",
          "Why does this charge appear twice?",
          "Do you offer a payment plan or financial assistance?",
        ],
      },
      {
        who: "Ask your insurer",
        items: [
          "Has this claim been processed, and what do I owe according to my EOB?",
          "Was this provider in-network?",
        ],
      },
    ],
    getHelp:
      "If you think a charge is wrong, ask for an itemized bill and, if needed, ask the provider to put the account on hold while you dispute it. Many hospitals have financial-assistance policies — ask for theirs.",
    faqs: [
      {
        question: "Should I pay a medical bill before I get the EOB?",
        answer: "It is usually worth waiting until your insurer has processed the claim and sent the EOB, then checking that the bill matches it.",
      },
      {
        question: "What is an itemized bill?",
        answer: "A line-by-line list of every service and supply, usually with billing codes. You can ask the provider’s billing office for one.",
      },
      {
        question: "What are CPT codes on a medical bill?",
        answer: "CPT codes are five-character codes describing what was done — a visit, a test, a procedure. They are what the provider billed your insurer for.",
      },
    ],
    ctaPrompt: "Got a bill that doesn’t add up? Attach it or take a photo, and Clariti will explain each charge and what to ask.",
    related: ["how-to-read-an-eob", "discharge-summary-explained"],
  },
  {
    slug: "lab-results-explained",
    metaTitle: "How to read your lab results",
    metaDescription:
      "What the columns on a blood test report mean — result, units, reference range, flags — with a worked example and questions to ask your doctor.",
    kicker: "LAB RESULTS",
    h1: "How to read your lab results",
    intro: [
      "Lab reports often arrive in your patient portal before anyone has explained them. Most follow the same layout: the test, your result, its units, a reference range, and a flag when a result falls outside that range.",
      "A flag is not a diagnosis. Reference ranges vary between labs, many people sit slightly outside a range for harmless reasons, and your doctor reads results alongside your history. Understanding the layout helps you ask the right questions.",
    ],
    partsHeading: "The parts of a lab report",
    parts: [
      { term: "Test name or panel", meaning: "What was measured. A panel (such as a CBC or metabolic panel) groups several tests." },
      { term: "Result", meaning: "Your value for that test." },
      { term: "Units", meaning: "How it was measured, such as g/dL or mmol/L. The same test can be reported in different units by different labs." },
      { term: "Reference range", meaning: "The range most healthy people fall within, for that lab and method. Use the range printed on your own report." },
      { term: "Flag (H, L, A)", meaning: "High, low or abnormal compared with the reference range." },
      { term: "Collection date", meaning: "When the sample was taken — useful when comparing results over time." },
    ],
    example: {
      heading: "A worked example",
      caption: "Invented results from a complete blood count. Not anyone’s real report.",
      rows: [
        { label: "Hemoglobin", value: "11.8 g/dL (12.0–15.5) L", reading: "Just below this lab’s range, so it is flagged low. Hemoglobin carries oxygen in red blood cells." },
        { label: "White blood cells", value: "6.4 ×10³/µL (4.0–11.0)", reading: "Within range, no flag." },
        { label: "Platelets", value: "250 ×10³/µL (150–400)", reading: "Within range, no flag." },
        { label: "MCV", value: "78 fL (80–100) L", reading: "Average red-cell size, slightly below range." },
      ],
      takeaway:
        "Two related results are flagged low. That is a reason to ask your doctor what they make of them together — not a conclusion on its own.",
    },
    checks: [
      "The report is yours — name and date of birth.",
      "Which results are flagged, and by how much.",
      "Whether the ranges and units match earlier reports before comparing numbers.",
      "Any comment from the lab, such as a note about the sample.",
    ],
    questions: [
      {
        who: "Ask your doctor",
        items: [
          "Which of these results matter for me, and why?",
          "Do the flagged results need a repeat test or any follow-up?",
          "How do these compare with my previous results?",
          "Could any of my medicines affect these numbers?",
        ],
      },
    ],
    getHelp:
      "If a result is marked critical or urgent, or you feel unwell, contact your doctor or care team straight away rather than waiting for a routine appointment.",
    faqs: [
      {
        question: "Does an abnormal flag mean something is wrong?",
        answer: "Not necessarily. Ranges are set so that some healthy people fall outside them. Your doctor interprets results in context.",
      },
      {
        question: "Why do reference ranges differ between labs?",
        answer: "Labs use different equipment and methods, so each sets ranges for its own tests. Always use the range printed on your report.",
      },
      {
        question: "Can Clariti tell me what my results mean for my health?",
        answer: "No. Clariti explains what the report says and suggests questions; it does not diagnose. Your doctor decides what the results mean for you.",
      },
    ],
    ctaPrompt: "Got a lab report you can’t decode? Attach it or paste the text, and Clariti will explain each line and what to ask.",
    related: ["discharge-summary-explained", "how-to-read-an-eob"],
  },
  {
    slug: "discharge-summary-explained",
    metaTitle: "How to understand your hospital discharge summary",
    metaDescription:
      "What each section of a hospital discharge summary means — diagnosis, procedures, medication changes, follow-up — with a worked example and questions to ask.",
    kicker: "DISCHARGE SUMMARY",
    h1: "How to understand your hospital discharge summary",
    intro: [
      "A discharge summary is the hospital’s record of your stay: why you were admitted, what was done, what changed with your medicines, and what should happen next. A copy usually goes to your regular doctor, and you can ask for one too.",
      "It is written for other clinicians, so it is full of abbreviations. The parts that matter most once you are home are the medication changes and the follow-up plan.",
    ],
    partsHeading: "The parts of a discharge summary",
    parts: [
      { term: "Reason for admission", meaning: "Why you came into hospital, sometimes as the “presenting complaint”." },
      { term: "Diagnosis", meaning: "What the team concluded. There may be a main diagnosis and others." },
      { term: "Procedures and investigations", meaning: "Scans, tests and operations during the stay." },
      { term: "Hospital course", meaning: "A short story of what happened, day by day or overall." },
      { term: "Medications on discharge", meaning: "What to take now — often marked as new, changed, stopped or unchanged." },
      { term: "Follow-up", meaning: "Appointments, tests or referrals to arrange, and who is responsible for each." },
      { term: "Advice and warning signs", meaning: "What to watch for at home and when to seek help." },
    ],
    example: {
      heading: "A worked example",
      caption: "An invented extract from a discharge summary. Not anyone’s real record.",
      rows: [
        { label: "Admitted with", value: "Community-acquired pneumonia", reading: "A chest infection caught outside hospital." },
        { label: "Investigations", value: "CXR: RLL consolidation", reading: "Chest X-ray showed an area of infection in the right lower lobe of the lung." },
        { label: "Medications — new", value: "Amoxicillin 500 mg TDS × 5 days", reading: "An antibiotic, three times a day for five more days." },
        { label: "Medications — stopped", value: "Ibuprofen", reading: "Stopped during the stay. Ask whether to restart it." },
        { label: "Follow-up", value: "GP review 1/52; repeat CXR 6/52", reading: "See your doctor in one week, and have another chest X-ray in six weeks." },
      ],
      takeaway:
        "The two things to act on are finishing the antibiotic course and booking both follow-ups. Check who is booking the repeat X-ray — you or the hospital.",
    },
    checks: [
      "Your medicines at home match the discharge medication list — new, changed and stopped.",
      "You know which follow-up appointments you need to book yourself.",
      "You understand the warning signs listed and who to call.",
      "Your regular doctor has received a copy.",
    ],
    questions: [
      {
        who: "Ask your doctor or the ward",
        items: [
          "Which medicines changed, and why?",
          "Should I restart anything that was stopped?",
          "Who is booking my follow-up tests and appointments?",
          "Which symptoms mean I should get help straight away?",
        ],
      },
      {
        who: "Ask your pharmacist",
        items: ["How and when should I take the new medicines, and with what?", "Do any of them interact with what I already take?"],
      },
    ],
    getHelp:
      "If you feel worse after discharge, or have any of the warning signs on the summary, contact your doctor or emergency services rather than waiting for a follow-up appointment.",
    faqs: [
      {
        question: "Can I get a copy of my discharge summary?",
        answer: "Usually yes. Ask the ward before you leave, check your patient portal, or ask your regular doctor’s practice.",
      },
      {
        question: "What do abbreviations like TDS, 1/52 and CXR mean?",
        answer: "TDS means three times a day, 1/52 means one week (6/52 is six weeks), and CXR means chest X-ray. Clariti expands abbreviations like these in plain language.",
      },
      {
        question: "Who is responsible for follow-up after discharge?",
        answer: "The summary should say. Some follow-up is booked by the hospital and some is left to you or your regular doctor — if it is not clear, ask.",
      },
    ],
    ctaPrompt: "Got a discharge summary full of abbreviations? Attach it or paste the text, and Clariti will explain each section and what to do next.",
    related: ["lab-results-explained", "understand-your-medical-bill"],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
