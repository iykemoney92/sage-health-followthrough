import type { ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";

export type ClaritiUiFamily =
  | "money"
  | "clinical_report"
  | "lab"
  | "care_plan"
  | "medication"
  | "generic";

export type ClaritiDocumentKindMeta = {
  kind: ClaritiAnalysisKind;
  title: string;
  shortTitle: string;
  tag: string;
  eyebrow: string;
  canvasTitle: string;
  detailTab: string;
  detailHeading: string;
  pendingLabel: string;
  documentNoun: string;
  starterTitle: string;
  starterMeta: string;
  starterPrompt: string;
  uploadHint: string;
  videoEyebrow: string;
  videoTitle: string;
  videoChatPrompt: string;
  educationDisclaimer: string;
  safetyShort: string;
  defaultQuestion: string;
  artifactKind: "bill_breakdown" | "eob_explanation" | "radiology_explainer" | "glossary" | "follow_up_actions";
  uiFamily: ClaritiUiFamily;
  tone: "sage" | "blue" | "violet" | "amber" | "rose" | "slate";
  videoSceneGuide: string;
};

export const CLARITI_DOCUMENT_KINDS: ClaritiDocumentKindMeta[] = [
  {
    kind: "medical_bill",
    title: "Medical bill",
    shortTitle: "Bill",
    tag: "Bill",
    eyebrow: "YOUR BILL, MADE CLEAR",
    canvasTitle: "What this bill is saying",
    detailTab: "Charges",
    detailHeading: "Charge breakdown",
    pendingLabel: "bill wording",
    documentNoun: "medical bill",
    starterTitle: "Explain a medical bill",
    starterMeta: "Charges, odd fees, and what to ask next",
    starterPrompt: "Please explain this medical bill in simple everyday language. Break down the charges, flag anything confusing, and tell me what I should ask next.",
    uploadHint: "Upload your medical bill, invoice, or statement.",
    videoEyebrow: "Bill walkthrough",
    videoTitle: "Charges, payments, and what to check before paying",
    videoChatPrompt: "I can also make a short video that walks through this bill in plain language.",
    educationDisclaimer: "Confirm charges and what you owe with the provider or insurer.",
    safetyShort: "This explains the bill only. Confirm what you owe before paying.",
    defaultQuestion: "Can you explain what I owe and which charges I should check before paying?",
    artifactKind: "bill_breakdown",
    uiFamily: "money",
    tone: "sage",
    videoSceneGuide: "document orientation, charge breakdown, payments/adjustments, charges to verify, and next billing questions",
  },
  {
    kind: "insurance_eob",
    title: "Insurance EOB",
    shortTitle: "EOB",
    tag: "EOB",
    eyebrow: "YOUR CLAIM, MADE CLEAR",
    canvasTitle: "How insurance handled this claim",
    detailTab: "Claim",
    detailHeading: "Claim breakdown",
    pendingLabel: "claim wording",
    documentNoun: "insurance Explanation of Benefits",
    starterTitle: "Decode an insurance EOB",
    starterMeta: "What was billed, covered, and left to you",
    starterPrompt: "Please decode this insurance EOB in simple everyday language. Explain what was billed and covered, what I may owe, and what I should check with the insurer or provider.",
    uploadHint: "Upload your EOB or explanation-of-benefits document.",
    videoEyebrow: "Claim walkthrough",
    videoTitle: "Claim flow, your share, and what to verify",
    videoChatPrompt: "I can also make a short video that walks through this EOB in plain language.",
    educationDisclaimer: "Confirm coverage and payment with the insurer or provider.",
    safetyShort: "This explains the EOB only. An EOB is not always a bill.",
    defaultQuestion: "Can you check what the insurer says I owe against the provider bill?",
    artifactKind: "eob_explanation",
    uiFamily: "money",
    tone: "violet",
    videoSceneGuide: "EOB orientation, billed/allowed/paid flow, patient responsibility, bill comparison, and next insurer/provider questions",
  },
  {
    kind: "radiology_report",
    title: "Radiology report",
    shortTitle: "Scan",
    tag: "Scan",
    eyebrow: "YOUR SCAN, IN PLAIN ENGLISH",
    canvasTitle: "What the report is saying",
    detailTab: "Findings",
    detailHeading: "Report findings",
    pendingLabel: "report wording",
    documentNoun: "radiology report",
    starterTitle: "Understand a radiology report",
    starterMeta: "Findings, anatomy words, and questions for your doctor",
    starterPrompt: "Please explain this radiology report in simple everyday language. Clarify the findings and body areas mentioned, and suggest useful questions I can ask my clinician.",
    uploadHint: "Upload your radiology, MRI, CT, X-ray, or ultrasound report.",
    videoEyebrow: "Scan walkthrough",
    videoTitle: "Findings, body areas, and questions to ask",
    videoChatPrompt: "I can also make a short video that walks through this scan report in plain language.",
    educationDisclaimer: "It does not replace a clinician or medical diagnosis.",
    safetyShort: "This explains the report wording only. It is not a diagnosis.",
    defaultQuestion: "Which finding best explains my symptoms?",
    artifactKind: "radiology_explainer",
    uiFamily: "clinical_report",
    tone: "blue",
    videoSceneGuide: "report wording, anatomy illustration, main finding, what needs clinician context, and questions to ask",
  },
  {
    kind: "lab_results",
    title: "Lab results",
    shortTitle: "Labs",
    tag: "Labs",
    eyebrow: "YOUR LABS, MADE CLEAR",
    canvasTitle: "What these results are saying",
    detailTab: "Results",
    detailHeading: "Result breakdown",
    pendingLabel: "lab wording",
    documentNoun: "lab results",
    starterTitle: "Make sense of lab results",
    starterMeta: "Markers, ranges, and what to ask next",
    starterPrompt: "Please explain these lab results in simple everyday language. Highlight anything out of range, say what each important marker means in plain words, and tell me what I should ask my clinician.",
    uploadHint: "Upload blood work, panels, or other lab result pages.",
    videoEyebrow: "Lab walkthrough",
    videoTitle: "Markers, ranges, and questions to ask",
    videoChatPrompt: "I can also make a short video that walks through these lab results in plain language.",
    educationDisclaimer: "It does not replace a clinician or medical diagnosis.",
    safetyShort: "This explains the lab wording only. Ask your clinician what it means for you.",
    defaultQuestion: "Which results matter most for my symptoms or care plan?",
    artifactKind: "glossary",
    uiFamily: "lab",
    tone: "amber",
    videoSceneGuide: "what the lab panel is, main out-of-range markers, reassuring normal results, what needs clinician context, and questions to ask",
  },
  {
    kind: "discharge_summary",
    title: "Discharge summary",
    shortTitle: "Discharge",
    tag: "Discharge",
    eyebrow: "YOUR DISCHARGE PLAN, MADE CLEAR",
    canvasTitle: "What happened and what comes next",
    detailTab: "Plan",
    detailHeading: "Discharge details",
    pendingLabel: "discharge wording",
    documentNoun: "hospital discharge summary",
    starterTitle: "Explain a discharge summary",
    starterMeta: "Why you were there, meds, and follow-up",
    starterPrompt: "Please explain this hospital discharge summary in simple everyday language. Cover why I was admitted, what changed, medicines, warning signs, and follow-up steps.",
    uploadHint: "Upload your hospital discharge summary or aftercare instructions.",
    videoEyebrow: "Discharge walkthrough",
    videoTitle: "Stay summary, medicines, and follow-up",
    videoChatPrompt: "I can also make a short video that walks through this discharge plan in plain language.",
    educationDisclaimer: "It does not replace a clinician or medical diagnosis.",
    safetyShort: "This explains the discharge paperwork only. Follow urgent warning signs if listed.",
    defaultQuestion: "What follow-up appointments or warning signs should I watch for?",
    artifactKind: "follow_up_actions",
    uiFamily: "care_plan",
    tone: "rose",
    videoSceneGuide: "why the stay happened, main treatments, medicines to continue or change, warning signs, and follow-up steps",
  },
  {
    kind: "medication_context",
    title: "Medication list",
    shortTitle: "Meds",
    tag: "Meds",
    eyebrow: "YOUR MEDICINES, MADE CLEAR",
    canvasTitle: "What you are taking and why it matters",
    detailTab: "Meds",
    detailHeading: "Medication details",
    pendingLabel: "medication wording",
    documentNoun: "medication list or prescription",
    starterTitle: "Explain a medication list",
    starterMeta: "Names, doses, and questions for the pharmacist",
    starterPrompt: "Please explain this medication list or prescription in simple everyday language. Clarify names, doses, timing, and what I should ask a pharmacist or clinician.",
    uploadHint: "Upload a medication list, prescription, or pharmacy printout.",
    videoEyebrow: "Medicine walkthrough",
    videoTitle: "Names, doses, and what to double-check",
    videoChatPrompt: "I can also make a short video that walks through these medicines in plain language.",
    educationDisclaimer: "It does not replace a clinician, pharmacist, or prescribing advice.",
    safetyShort: "This explains the medication wording only. Do not change doses without professional advice.",
    defaultQuestion: "Can you confirm how and when I should take each medicine?",
    artifactKind: "glossary",
    uiFamily: "medication",
    tone: "sage",
    videoSceneGuide: "what the list is, key medicines and doses, timing or instructions, cautions from the document, and questions for a pharmacist or clinician",
  },
  {
    kind: "pathology_report",
    title: "Pathology report",
    shortTitle: "Pathology",
    tag: "Pathology",
    eyebrow: "YOUR PATHOLOGY REPORT, MADE CLEAR",
    canvasTitle: "What the sample report is saying",
    detailTab: "Findings",
    detailHeading: "Pathology findings",
    pendingLabel: "pathology wording",
    documentNoun: "pathology report",
    starterTitle: "Understand a pathology report",
    starterMeta: "Sample findings and questions for your doctor",
    starterPrompt: "Please explain this pathology or biopsy report in simple everyday language. Clarify the main findings and suggest careful questions I can ask my clinician.",
    uploadHint: "Upload a pathology, biopsy, or tissue report.",
    videoEyebrow: "Pathology walkthrough",
    videoTitle: "Sample findings and questions to ask",
    videoChatPrompt: "I can also make a short video that walks through this pathology report in plain language.",
    educationDisclaimer: "It does not replace a clinician or medical diagnosis.",
    safetyShort: "This explains the pathology wording only. It is not a diagnosis on its own.",
    defaultQuestion: "What does this finding mean for my next step in care?",
    artifactKind: "radiology_explainer",
    uiFamily: "clinical_report",
    tone: "blue",
    videoSceneGuide: "what was sampled, main finding in plain words, important report terms, what needs clinician context, and questions to ask",
  },
  {
    kind: "referral_letter",
    title: "Referral letter",
    shortTitle: "Referral",
    tag: "Referral",
    eyebrow: "YOUR REFERRAL, MADE CLEAR",
    canvasTitle: "Why you were referred and what to expect",
    detailTab: "Details",
    detailHeading: "Referral details",
    pendingLabel: "referral wording",
    documentNoun: "referral letter",
    starterTitle: "Explain a referral letter",
    starterMeta: "Why you were sent, and what to ask next",
    starterPrompt: "Please explain this referral letter in simple everyday language. Clarify why I was referred, what the specialist is being asked to do, and what I should prepare or ask.",
    uploadHint: "Upload a referral letter or specialist referral note.",
    videoEyebrow: "Referral walkthrough",
    videoTitle: "Reason for referral and next steps",
    videoChatPrompt: "I can also make a short video that walks through this referral in plain language.",
    educationDisclaimer: "It does not replace a clinician or medical diagnosis.",
    safetyShort: "This explains the referral wording only.",
    defaultQuestion: "What should I bring or ask at the specialist visit?",
    artifactKind: "follow_up_actions",
    uiFamily: "care_plan",
    tone: "slate",
    videoSceneGuide: "who referred whom, reason for referral, what the specialist is asked to review, preparation tips from the letter, and questions to ask",
  },
  {
    kind: "visit_notes",
    title: "Visit notes",
    shortTitle: "Visit",
    tag: "Visit",
    eyebrow: "YOUR VISIT NOTES, MADE CLEAR",
    canvasTitle: "What happened at the visit",
    detailTab: "Notes",
    detailHeading: "Visit details",
    pendingLabel: "visit wording",
    documentNoun: "visit notes",
    starterTitle: "Explain visit or clinic notes",
    starterMeta: "What was discussed, planned, and ordered",
    starterPrompt: "Please explain these clinic or after-visit notes in simple everyday language. Cover what was discussed, any plan or orders, and what I should do next.",
    uploadHint: "Upload after-visit summaries, clinic notes, or progress notes.",
    videoEyebrow: "Visit walkthrough",
    videoTitle: "What was discussed and what comes next",
    videoChatPrompt: "I can also make a short video that walks through these visit notes in plain language.",
    educationDisclaimer: "It does not replace a clinician or medical diagnosis.",
    safetyShort: "This explains the visit notes only.",
    defaultQuestion: "What follow-up or tests were planned from this visit?",
    artifactKind: "follow_up_actions",
    uiFamily: "care_plan",
    tone: "slate",
    videoSceneGuide: "visit reason, main discussion points, plan or orders, medicines or changes, and follow-up questions",
  },
  {
    kind: "prior_authorization",
    title: "Prior authorization",
    shortTitle: "Prior auth",
    tag: "Auth",
    eyebrow: "YOUR PRIOR AUTH, MADE CLEAR",
    canvasTitle: "What insurance approved or denied",
    detailTab: "Decision",
    detailHeading: "Authorization details",
    pendingLabel: "authorization wording",
    documentNoun: "prior authorization letter",
    starterTitle: "Decode a prior authorization",
    starterMeta: "Approved, denied, or more info needed",
    starterPrompt: "Please explain this prior authorization letter in simple everyday language. Say whether something was approved, denied, or needs more information, and what I should do next.",
    uploadHint: "Upload a prior authorization approval, denial, or request letter.",
    videoEyebrow: "Prior auth walkthrough",
    videoTitle: "Decision, reasons, and next steps",
    videoChatPrompt: "I can also make a short video that walks through this prior authorization in plain language.",
    educationDisclaimer: "Confirm coverage decisions with the insurer or provider.",
    safetyShort: "This explains the prior auth letter only. Confirm next steps with insurer or provider.",
    defaultQuestion: "What do I need to do to appeal or complete this authorization?",
    artifactKind: "eob_explanation",
    uiFamily: "money",
    tone: "violet",
    videoSceneGuide: "what was requested, the decision, reasons given, deadlines or appeal paths, and next questions",
  },
  {
    kind: "unknown",
    title: "Health document",
    shortTitle: "Document",
    tag: "Doc",
    eyebrow: "YOUR DOCUMENT, MADE CLEAR",
    canvasTitle: "What this document is saying",
    detailTab: "Details",
    detailHeading: "Document details",
    pendingLabel: "document wording",
    documentNoun: "health document",
    starterTitle: "Explain any health document",
    starterMeta: "Bills, labs, notes, letters — we will sort it",
    starterPrompt: "Please explain this health document in simple everyday language. Tell me what it is, what matters most, and what I should ask next.",
    uploadHint: "Upload any confusing health paperwork.",
    videoEyebrow: "Document walkthrough",
    videoTitle: "What it is, what matters, and what to ask",
    videoChatPrompt: "I can also make a short video that walks through this document in plain language.",
    educationDisclaimer: "Confirm important details with the right clinician, insurer, or provider.",
    safetyShort: "This explains the document wording only.",
    defaultQuestion: "What is the most important thing I should clarify next?",
    artifactKind: "glossary",
    uiFamily: "generic",
    tone: "slate",
    videoSceneGuide: "what the document appears to be, the main takeaway, important details, careful items, and questions to ask",
  },
];

const kindMap = Object.fromEntries(CLARITI_DOCUMENT_KINDS.map((item) => [item.kind, item])) as Record<
  ClaritiAnalysisKind,
  ClaritiDocumentKindMeta
>;

export function getClaritiKindMeta(kind: ClaritiAnalysisKind): ClaritiDocumentKindMeta {
  return kindMap[kind] ?? kindMap.unknown;
}

export function isClaritiAnalysisKind(value: unknown): value is ClaritiAnalysisKind {
  return typeof value === "string" && value in kindMap;
}

export function claritiKindTitles(): ClaritiAnalysisKind[] {
  return CLARITI_DOCUMENT_KINDS.map((item) => item.kind);
}

export function inferKindFromTitleText(text: string): ClaritiAnalysisKind {
  const source = text.toLowerCase();
  if (/radiology|mri|ct scan|x-?ray|ultrasound|imaging/.test(source)) return "radiology_report";
  if (/pathology|biopsy|histolog|cytolog/.test(source)) return "pathology_report";
  if (/lab result|blood work|blood test|cbc|metabolic panel|a1c|hemoglobin/.test(source)) return "lab_results";
  if (/discharge|aftercare|hospital summary/.test(source)) return "discharge_summary";
  if (/medication|prescription|pharmacy|rx list|drug list/.test(source)) return "medication_context";
  if (/referral|specialist consult/.test(source)) return "referral_letter";
  if (/prior auth|preauthorization|pre-authorization|authorization determination/.test(source)) return "prior_authorization";
  if (/visit note|progress note|after-visit|clinic note|encounter/.test(source)) return "visit_notes";
  if (/\beob\b|explanation of benefits|claim|insurance/.test(source)) return "insurance_eob";
  if (/bill|invoice|statement|amount due/.test(source)) return "medical_bill";
  return "unknown";
}
