import type { ClaritiAnalysis, ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";

type AnalyzeInput = {
  kind: ClaritiAnalysisKind;
  question: string;
  documentText: string;
  fileName?: string;
};

export function inferClaritiKind(input: AnalyzeInput): ClaritiAnalysisKind {
  const combined = `${input.fileName ?? ""}\n${input.question}\n${input.documentText}`.toLowerCase();
  const scores = Object.fromEntries(
    (
      [
        "medical_bill",
        "insurance_eob",
        "radiology_report",
        "lab_results",
        "discharge_summary",
        "medication_context",
        "pathology_report",
        "referral_letter",
        "visit_notes",
        "prior_authorization",
        "unknown",
      ] as ClaritiAnalysisKind[]
    ).map((kind) => [kind, 0]),
  ) as Record<ClaritiAnalysisKind, number>;

  const addScore = (kind: ClaritiAnalysisKind, patterns: Array<[RegExp, number]>) => {
    for (const [pattern, value] of patterns) {
      if (pattern.test(combined)) scores[kind] += value;
    }
  };

  addScore("insurance_eob", [
    [/\bexplanation of benefits\b|\beob\b/, 4],
    [/\ballowed amount\b|\bamount paid by plan\b|\bplan paid\b/, 3],
    [/\bpatient responsibility\b|\bclaim number\b/, 3],
    [/\binsurer\b|\binsurance processed\b|\bnot a bill\b/, 2],
  ]);
  addScore("radiology_report", [
    [/\bradiology\b|\bmri\b|\bct\b|\bx-?ray\b|\bultrasound\b/, 4],
    [/\bimpression\b|\bfindings\b|\bexam\b|\bstudy\b/, 2],
    [/\bdisc\b|\bdegeneration\b|\bstenosis\b|\bfracture\b|\blesion\b/, 2],
  ]);
  addScore("medical_bill", [
    [/\bmedical bill\b|\binvoice\b|\bstatement\b/, 4],
    [/\bamount due\b|\bcurrent balance\b|\btotal charges\b|\btotal billed\b/, 3],
    [/\bfacility fee\b|\bline items\b|\bprovider bill\b/, 2],
  ]);
  addScore("lab_results", [
    [/\blab results?\b|\blaboratory\b|\bblood work\b|\bblood test\b/, 4],
    [/\breference range\b|\bout of range\b|\bwithin normal\b|\bhigh\b.*\blow\b/, 3],
    [/\bcbc\b|\bmetabolic panel\b|\ba1c\b|\bhemoglobin\b|\bcholesterol\b|\bglucose\b/, 3],
    [/\bcollection date\b|\bspecimen\b|\banalysis date\b/, 2],
  ]);
  addScore("discharge_summary", [
    [/\bdischarge summary\b|\bdischarge instructions\b|\baftercare\b/, 5],
    [/\badmission date\b|\bdischarge date\b|\bhospital course\b/, 3],
    [/\bfollow-?up appointment\b|\breturn precautions\b|\bwhen to seek care\b/, 2],
  ]);
  addScore("medication_context", [
    [/\bmedication list\b|\bcurrent medications\b|\bprescription\b|\bpharmacy\b/, 4],
    [/\bdosage\b|\btake \d|\bonce daily\b|\btwice daily\b|\brefill\b/, 3],
    [/\brx\b|\bmg\b|\btablet\b|\bcapsule\b|\binhaler\b/, 2],
  ]);
  addScore("pathology_report", [
    [/\bpathology\b|\bbiopsy\b|\bhistolog\b|\bcytolog\b/, 5],
    [/\bspecimen\b|\bdiagnosis\b|\bmalignant\b|\bbenign\b|\bmargin\b/, 3],
    [/\btissue\b|\bfine needle\b|\bexcision\b/, 2],
  ]);
  addScore("referral_letter", [
    [/\breferral\b|\breferred to\b|\bspecialist\b/, 4],
    [/\bplease see\b|\bconsult\b|\bfor evaluation\b/, 2],
    [/\breason for referral\b|\breferred by\b/, 3],
  ]);
  addScore("visit_notes", [
    [/\bafter-?visit summary\b|\bprogress note\b|\bclinic note\b|\bencounter\b/, 4],
    [/\bassessment and plan\b|\bchief complaint\b|\bvisit date\b/, 3],
    [/\bsubjective\b|\bobjective\b|\bplan:\b/, 2],
  ]);
  addScore("prior_authorization", [
    [/\bprior auth(?:orization)?\b|\bpre-?authorization\b|\bauthorization determination\b/, 5],
    [/\bapproved\b|\bdenied\b|\bmore information needed\b|\bappeal\b/, 2],
    [/\bcoverage determination\b|\bauth number\b/, 3],
  ]);

  const strongest = Object.entries(scores)
    .filter(([kind]) => kind !== "unknown")
    .sort((a, b) => b[1] - a[1])[0] as [ClaritiAnalysisKind, number];

  if (strongest[1] >= 3 && strongest[0] !== input.kind) return strongest[0];
  if (strongest[1] >= 3) return strongest[0];
  if (input.kind === "unknown" && strongest[1] >= 2) return strongest[0];
  return input.kind;
}

export function buildFallbackAnalysis(input: AnalyzeInput): ClaritiAnalysis {
  switch (input.kind) {
    case "radiology_report":
      return buildRadiologyFallback(input);
    case "insurance_eob":
      return buildEobFallback(input);
    case "lab_results":
      return buildLabFallback(input);
    case "discharge_summary":
      return buildDischargeFallback(input);
    case "medication_context":
      return buildMedicationFallback(input);
    case "pathology_report":
      return buildPathologyFallback(input);
    case "referral_letter":
      return buildReferralFallback(input);
    case "visit_notes":
      return buildVisitNotesFallback(input);
    case "prior_authorization":
      return buildPriorAuthFallback(input);
    case "unknown":
      return buildGenericFallback(input);
    case "medical_bill":
    default:
      return buildBillFallback(input);
  }
}

function buildRadiologyFallback(input: AnalyzeInput): ClaritiAnalysis {
  const impressionLines = extractSectionLines(input.documentText, "Impression", ["Conclusion", "Recommendation", "Patient question"]);
  const conclusionLines = extractSectionLines(input.documentText, "Conclusion", ["Recommendation", "Patient question", "Electronically Signed", "Signed"]);
  const impression = [...impressionLines, ...conclusionLines].slice(0, 5);
  const impressionSource = impressionLines.length ? "Impression" : "Conclusion";
  const findings = extractSectionLines(input.documentText, "Findings", ["Impression", "Conclusion"]).slice(0, 7);
  const exam = extractLabel(input.documentText, ["Exam", "Study", "Procedure"]) ?? "Radiology report";
  const primaryImpression = impression[0] ?? "Review the main conclusion section from the uploaded report.";
  const reassuringLine = impression.find((line) => /no significant|no acute|negative|normal/i.test(line))
    ?? findings.find((line) => /no significant|no acute|normal/i.test(line));

  return {
    kind: "radiology_report",
    title: "Your scan report, simply explained",
    summary: primaryImpression,
    plainEnglish:
      `This page explains what the report says — it is not a diagnosis. In everyday words, the report points to: ${primaryImpression.toLowerCase()} ${reassuringLine ? `It also notes: "${reassuringLine}".` : "Ask your doctor how this lines up with how you feel."}`,
    sourceAnchors: [...impression.map((line) => `${impressionSource}: ${line}`), ...findings.slice(0, 2).map((line) => `Findings: ${line}`)].slice(0, 5),
    keyPoints: [
      { label: "Main takeaway", detail: primaryImpression, sourceAnchor: impressionSource },
      { label: "Calmer wording", detail: reassuringLine ?? "No clearly reassuring phrase stood out — review the full report with your clinician.", sourceAnchor: reassuringLine ? `${impressionSource} / Findings` : "Full report" },
      { label: "What to ask next", detail: extractSectionLines(input.documentText, "Recommendation", ["Patient question"])[0] ?? "Ask the ordering clinician how the report connects to your symptoms.", sourceAnchor: "Recommendation" },
    ],
    metrics: [
      { label: "Scan type", value: exam, caveat: "From the report header." },
      { label: "What Clariti can say", value: "Needs your clinician", caveat: "Only your care team can say what this means for you." },
    ],
    flags: [{ label: "Talk with your clinician", detail: "Scan reports need real clinical context — Clariti only helps with the wording.", severity: "check" }],
    questions: [
      "Which finding best matches how I feel?",
      "Does this report suggest any follow-up scan or visit?",
      "Are there warning signs I should watch for?",
    ],
    nextActions: ["Save questions for your clinician", "Bring the report to your follow-up visit", "Ask Clariti to walk through any confusing terms"],
    safetyNote: "Clariti explains the wording. It does not diagnose or replace your clinician.",
    videoScenes: [
      { title: "What this report is", script: `This report is for ${exam}. We focus on the exact ${impressionSource} and Findings text.`, visual: `Report header and highlighted ${impressionSource} section`, sourceAnchor: "Report header" },
      { title: "Main takeaway", script: primaryImpression, visual: `Plain-English summary beside the source ${impressionSource.toLowerCase()}`, sourceAnchor: impressionSource },
      { title: "Body area words", script: findings[0] ?? "Review the Findings section for the body area described.", visual: "Simple anatomy labels from the Findings text", sourceAnchor: "Findings" },
      { title: "Calm vs follow-up language", script: reassuringLine ?? "Separate calming wording from questions that need your clinician.", visual: "Two-column checklist with source-backed notes", sourceAnchor: "Findings / Recommendation" },
      { title: "Questions to ask", script: "The safest next step is to ask your clinician how the report connects to your symptoms and care plan.", visual: "Question list for clinician visit", sourceAnchor: "Clinical context" },
    ],
  };
}

function buildEobFallback(input: AnalyzeInput): ClaritiAnalysis {
  const billed = extractMoneyAfter(input.documentText, ["Amount billed by provider", "Amount billed"]);
  const allowed = extractMoneyAfter(input.documentText, ["Allowed amount"]);
  const planPaid = extractMoneyAfter(input.documentText, ["Amount paid by plan", "Plan paid"]);
  const deductible = extractMoneyAfter(input.documentText, ["Amount applied to deductible", "Deductible"]);
  const coinsurance = extractMoneyAfter(input.documentText, ["Coinsurance"]);
  const responsibility = extractMoneyAfter(input.documentText, ["Patient responsibility"]);
  const claimNumber = extractLabel(input.documentText, ["Claim number"]);
  const provider = extractLabel(input.documentText, ["Provider"]);
  const notBill = findLine(input.documentText, /not a bill/i);

  return {
    kind: "insurance_eob",
    title: "Your insurance EOB, simply explained",
    summary: `This EOB shows ${billed ?? "a billed amount"}, ${allowed ?? "an allowed amount"}, ${planPaid ?? "a plan payment"}, and ${responsibility ?? "a possible amount for you"}.`,
    plainEnglish:
      `This is how insurance processed the claim — not always a request for payment. ${notBill ? `The paper even says: "${notBill}". ` : ""}Compare any amount listed for you with a real provider bill before you pay.`,
    sourceAnchors: [
      billed ? `Amount billed by provider: ${billed}` : "Amount billed by provider",
      allowed ? `Allowed amount: ${allowed}` : "Allowed amount",
      planPaid ? `Amount paid by plan: ${planPaid}` : "Amount paid by plan",
      responsibility ? `Patient responsibility: ${responsibility}` : "Patient responsibility",
      claimNumber ? `Claim number: ${claimNumber}` : "",
    ].filter(Boolean),
    keyPoints: [
      { label: "What the provider billed", detail: billed ? `${billed} was submitted by ${provider ?? "the provider"}.` : "Check the billed amount on the EOB.", sourceAnchor: "Amount billed by provider" },
      { label: "What insurance paid", detail: planPaid ? `${planPaid} is listed as paid by the plan.` : "Check the plan-paid amount on the EOB.", sourceAnchor: "Amount paid by plan" },
      { label: "What may be left for you", detail: responsibility ? `${responsibility} is listed as your possible share. Confirm it against an actual bill before paying.` : "Your share may be listed here — confirm against a real bill.", sourceAnchor: "Patient responsibility" },
    ],
    metrics: [
      { label: "Provider billed", value: billed ?? "Check EOB", caveat: "Starting charge before adjustments." },
      { label: "Plan paid", value: planPaid ?? "Check EOB", caveat: "What insurance shows as paid." },
      { label: "Your possible share", value: responsibility ?? "Check EOB", caveat: "Confirm with the provider bill." },
    ],
    flags: [{ label: "Not always a bill", detail: "Do not pay from the EOB alone unless the insurer or provider confirms payment is due.", severity: "info" }],
    questions: [
      "Has the provider sent a real bill that matches this amount?",
      deductible || coinsurance ? `Was ${deductible ? `${deductible} deductible` : ""}${deductible && coinsurance ? " and " : ""}${coinsurance ? `${coinsurance} coinsurance` : ""} applied correctly?` : "Was deductible, copay, or coinsurance applied correctly?",
      claimNumber ? `Can you review claim ${claimNumber}?` : "Can you review this claim number?",
    ],
    nextActions: ["Compare the EOB with the provider bill", "Call the insurer with the claim number", "Ask the provider to confirm the current balance"],
    safetyNote: "Clariti explains the paperwork. It does not decide coverage or what you must pay.",
    videoScenes: [
      { title: "What this EOB is", script: `This EOB explains how insurance processed ${claimNumber ? `claim ${claimNumber}` : "this claim"}. It may not be a bill.`, visual: "EOB document with claim number and not-a-bill note highlighted", sourceAnchor: claimNumber ? `Claim number: ${claimNumber}` : "EOB header" },
      { title: "Where the money went", script: `The provider billed ${billed ?? "an amount shown here"}, the allowed amount is ${allowed ?? "listed separately"}, and the plan paid ${planPaid ?? "the plan-paid amount shown"}.`, visual: "Three-step flow from billed to allowed to plan paid", sourceAnchor: allowed ? `Allowed amount: ${allowed}` : "Allowed amount" },
      { title: "Your possible share", script: `The EOB lists ${responsibility ?? "a patient responsibility amount"} as possible patient responsibility. Confirm this against the provider bill before paying.`, visual: "Patient responsibility card with confirmation checklist", sourceAnchor: responsibility ? `Patient responsibility: ${responsibility}` : "Patient responsibility" },
      { title: "Compare before paying", script: notBill ?? "Do not pay from the EOB alone; compare it with the provider statement.", visual: "Side-by-side EOB and provider bill comparison", sourceAnchor: notBill ?? "Not a bill" },
      { title: "Questions to ask", script: "Ask the insurer or provider to sort out any mismatch before you pay.", visual: "Question list for insurer or provider", sourceAnchor: "Next steps" },
    ],
  };
}

function buildBillFallback(input: AnalyzeInput): ClaritiAnalysis {
  const totalCharges = extractMoneyAfter(input.documentText, ["Total charges", "Total billed"]);
  const amountDue = extractMoneyAfter(input.documentText, ["Current amount due", "Amount due"]);
  const insurancePayment = extractMoneyAfter(input.documentText, ["Insurance payment received", "Insurance paid"]);
  const facilityFee = extractMoneyAfter(input.documentText, ["Facility fee"]);
  const provider = extractLabel(input.documentText, ["Provider"]);
  const lineItems = extractSectionLines(input.documentText, "Line items", ["Notes", "Patient question"]).slice(0, 5);

  return {
    kind: "medical_bill",
    title: "Your medical bill, simply explained",
    summary: `This bill lists ${totalCharges ?? "total charges"} in charges and ${amountDue ?? "an amount due"} as the current balance${provider ? ` from ${provider}` : ""}.`,
    plainEnglish:
      `This looks like a bill from a provider. ${insurancePayment ? `It shows insurance already paid ${insurancePayment}. ` : ""}Before you pay, compare the amount due with your insurance paperwork and ask about any fees you do not recognize.`,
    sourceAnchors: [
      totalCharges ? `Total charges: ${totalCharges}` : "Total charges",
      amountDue ? `Current amount due: ${amountDue}` : "Amount due",
      insurancePayment ? `Insurance payment received: ${insurancePayment}` : "",
      facilityFee ? `Facility fee: ${facilityFee}` : "",
    ].filter(Boolean),
    keyPoints: [
      { label: "Total billed", detail: totalCharges ? `${totalCharges} is listed as total charges.` : "Check the total charge line on the bill.", sourceAnchor: "Total charges" },
      { label: "Amount they say you owe", detail: amountDue ? `${amountDue} is listed as due — confirm against insurance records before paying.` : "Confirm the amount due against your EOB.", sourceAnchor: "Current amount due" },
      { label: "Charges to double-check", detail: lineItems.find((line) => /unlisted|facility|admin/i.test(line)) ?? "Ask about unclear fees, facility fees, or duplicate line items.", sourceAnchor: "Line items" },
    ],
    metrics: [
      { label: "Total charges", value: totalCharges ?? "Check bill", caveat: "Before insurance comparison." },
      { label: "Amount due", value: amountDue ?? "Check bill", caveat: "Confirm against your EOB." },
      { label: "Insurance paid", value: insurancePayment ?? "Not found", caveat: "Use the EOB for confirmation." },
    ],
    flags: [{ label: "Confirm before paying", detail: facilityFee ? `Ask billing to explain the ${facilityFee} facility fee and any unclear charges before paying.` : "Compare this bill with the EOB and ask about unclear line items.", severity: "check" }],
    questions: ["Has insurance finished processing this claim?", "Are any charges duplicated?", "Can you explain each unclear line item?"],
    nextActions: ["Compare with your EOB", "Call billing about unclear fees", "Ask for an itemized statement"],
    safetyNote: "Clariti explains the bill. It does not decide what you legally owe.",
    videoScenes: [
      { title: "What this bill is", script: `This bill lists ${totalCharges ?? "the provider's charges"} and ${amountDue ?? "the current amount due"}${provider ? ` from ${provider}` : ""}.`, visual: "Provider bill with total charges and amount due highlighted", sourceAnchor: totalCharges ? `Total charges: ${totalCharges}` : "Bill header" },
      { title: "Charge breakdown", script: "The key amounts to review are total charges, any insurance payment, and the current amount due.", visual: "Stacked charge breakdown with total, paid, and due rows", sourceAnchor: amountDue ? `Current amount due: ${amountDue}` : "Amount due" },
      { title: "Insurance comparison", script: insurancePayment ? `The bill shows insurance payment received of ${insurancePayment}. Compare this with your EOB.` : "Check whether insurance has processed the claim and compare this bill with the EOB.", visual: "Bill-to-EOB comparison diagram", sourceAnchor: insurancePayment ? `Insurance payment received: ${insurancePayment}` : "Insurance processing" },
      { title: "Charge to verify", script: facilityFee ? `Ask billing to explain the ${facilityFee} facility fee.` : "Ask billing to explain unclear fees, duplicate charges, or line items you do not recognize.", visual: "Highlighted line item with verify badge", sourceAnchor: facilityFee ? `Facility fee: ${facilityFee}` : "Line items" },
      { title: "Before paying", script: "Confirm the balance with billing or your insurer before paying.", visual: "Short checklist: EOB, itemized bill, confirmed balance", sourceAnchor: "Next steps" },
    ],
  };
}

function buildLabFallback(input: AnalyzeInput): ClaritiAnalysis {
  const panel = extractLabel(input.documentText, ["Panel", "Test", "Order"]) ?? "Lab results";
  const highLines = input.documentText.split(/\r?\n/).map(cleanExtractedLine).filter((line) => /\bhigh\b|\babove\b|\bH\b|\belevated\b/i.test(line)).slice(0, 4);
  const lowLines = input.documentText.split(/\r?\n/).map(cleanExtractedLine).filter((line) => /\blow\b|\bbelow\b|\bL\b/i.test(line)).slice(0, 3);
  const mainFlag = highLines[0] ?? lowLines[0] ?? "Review each marker against its reference range with your clinician.";

  return {
    kind: "lab_results",
    title: "Your lab results, simply explained",
    summary: `These ${panel.toLowerCase()} results include markers to review with your clinician${highLines.length || lowLines.length ? ", including some that look outside the listed range" : ""}.`,
    plainEnglish:
      `This page turns lab numbers into everyday language. ${highLines.length || lowLines.length ? "Some values appear outside the printed range — that does not automatically mean something is wrong, but it is worth asking about." : "Many values may sit inside the listed range; still ask your clinician what matters for you."}`,
    sourceAnchors: [panel, ...highLines.slice(0, 2), ...lowLines.slice(0, 1)].filter(Boolean).slice(0, 5),
    keyPoints: [
      { label: "What this panel is", detail: panel, sourceAnchor: "Panel / Test" },
      { label: "Values to ask about", detail: mainFlag, sourceAnchor: "Results" },
      { label: "What Clariti cannot decide", detail: "Only your clinician can say what these numbers mean for your health.", sourceAnchor: "Clinical context" },
    ],
    metrics: [
      { label: "Panel", value: panel, caveat: "From the lab header when available." },
      { label: "Out-of-range cues", value: String(highLines.length + lowLines.length || "Check report"), caveat: "Based on wording like high/low in the text." },
      { label: "Next step", value: "Ask clinician", caveat: "Bring questions to your visit." },
    ],
    flags: [{ label: "Ask about flagged values", detail: "Anything marked high, low, or outside range deserves a clinician conversation.", severity: highLines.length || lowLines.length ? "check" : "info" }],
    questions: [
      "Which results matter most for my symptoms?",
      "Do any of these need a repeat test?",
      "What should I change — if anything — before my next check?",
    ],
    nextActions: ["Circle the flagged markers", "Bring this report to your clinician", "Ask Clariti to explain any confusing marker name"],
    safetyNote: "Clariti explains the lab wording. It does not diagnose or replace your clinician.",
    videoScenes: genericScenes(input.kind, panel, mainFlag, "Ask which results matter most for you."),
  };
}

function buildDischargeFallback(input: AnalyzeInput): ClaritiAnalysis {
  const reason = extractLabel(input.documentText, ["Admission diagnosis", "Discharge diagnosis", "Reason for admission", "Diagnosis"])
    ?? extractSectionLines(input.documentText, "Hospital course", ["Medications", "Follow-up"])[0]
    ?? "Review why you were admitted and what changed before going home.";
  const followUp = extractSectionLines(input.documentText, "Follow-up", ["Medications", "Warning", "When to seek"]).slice(0, 3);
  const warnings = extractSectionLines(input.documentText, "Warning signs", ["Follow-up", "Medications"]).slice(0, 3);
  const meds = extractSectionLines(input.documentText, "Medications", ["Follow-up", "Warning"]).slice(0, 4);

  return {
    kind: "discharge_summary",
    title: "Your discharge plan, simply explained",
    summary: reason,
    plainEnglish:
      `This paperwork covers why you were in hospital and what to do at home. ${followUp[0] ? `A follow-up note says: "${followUp[0]}".` : "Look carefully at medicines, warning signs, and follow-up visits."}`,
    sourceAnchors: [reason, ...followUp.slice(0, 2), ...warnings.slice(0, 1)].filter(Boolean).slice(0, 5),
    keyPoints: [
      { label: "Why you were there", detail: reason, sourceAnchor: "Diagnosis / course" },
      { label: "Medicines to notice", detail: meds[0] ?? "Check the medication section for anything new, stopped, or changed.", sourceAnchor: "Medications" },
      { label: "Follow-up", detail: followUp[0] ?? "Look for appointment dates and who to call.", sourceAnchor: "Follow-up" },
    ],
    metrics: [
      { label: "Focus", value: "Home plan", caveat: "From discharge instructions." },
      { label: "Warning cues", value: warnings.length ? String(warnings.length) : "Check paper", caveat: "Seek urgent care if listed signs appear." },
      { label: "Meds listed", value: meds.length ? String(meds.length) : "Check paper", caveat: "Confirm with pharmacy if unsure." },
    ],
    flags: [{ label: "Watch warning signs", detail: warnings[0] ?? "If the paper lists emergency warning signs, take them seriously.", severity: "urgent" }],
    questions: [
      "Which follow-up appointments are most important?",
      "Which medicines changed, and how should I take them?",
      "What warning signs mean I should seek urgent care?",
    ],
    nextActions: ["Put follow-up dates on your calendar", "Review new medicines with a pharmacist", "Save the warning-sign list somewhere easy to find"],
    safetyNote: "Clariti explains the discharge wording. Follow urgent warning signs if they appear.",
    videoScenes: genericScenes(input.kind, reason, followUp[0] ?? "Check the follow-up section.", "Ask which warning signs matter most."),
  };
}

function buildMedicationFallback(input: AnalyzeInput): ClaritiAnalysis {
  const medLines = input.documentText
    .split(/\r?\n/)
    .map(cleanExtractedLine)
    .filter((line) => /\bmg\b|\btablet\b|\bdaily\b|\bcapsule\b|\binhaler\b|\btake\b/i.test(line))
    .slice(0, 6);
  const firstMed = medLines[0] ?? "Review each medicine name, dose, and timing on the list.";

  return {
    kind: "medication_context",
    title: "Your medicines, simply explained",
    summary: medLines.length ? `This list includes ${medLines.length} medicine line${medLines.length === 1 ? "" : "s"} to review carefully.` : "This looks like a medication or prescription list to review carefully.",
    plainEnglish:
      `This page helps you understand what is listed — not how to change anything on your own. Start with names, doses, and timing, then ask a pharmacist or clinician about anything unclear.`,
    sourceAnchors: medLines.slice(0, 5).length ? medLines.slice(0, 5) : ["Medication list"],
    keyPoints: [
      { label: "First medicine to review", detail: firstMed, sourceAnchor: "Medication list" },
      { label: "What to check for each one", detail: "Name, dose, when to take it, and whether it is new or changed.", sourceAnchor: "Instructions" },
      { label: "Safety note", detail: "Do not start, stop, or change a dose based on this explanation alone.", sourceAnchor: "Clinical context" },
    ],
    metrics: [
      { label: "Lines found", value: String(medLines.length || "Check list"), caveat: "From dosage-like lines in the text." },
      { label: "Best next step", value: "Ask pharmacist", caveat: "Bring the list with you." },
    ],
    flags: [{ label: "Do not self-adjust", detail: "Clariti explains the list wording. Dose changes need a clinician or pharmacist.", severity: "check" }],
    questions: [
      "How and when should I take each medicine?",
      "Are any of these new, stopped, or changed?",
      "What side effects should I watch for?",
    ],
    nextActions: ["Highlight anything you do not recognize", "Ask a pharmacist to review the full list", "Bring questions to your next visit"],
    safetyNote: "Clariti explains medication wording. It does not prescribe or change doses.",
    videoScenes: genericScenes(input.kind, firstMed, "Check dose and timing for each medicine.", "Ask how and when to take each one."),
  };
}

function buildPathologyFallback(input: AnalyzeInput): ClaritiAnalysis {
  const diagnosis = extractLabel(input.documentText, ["Diagnosis", "Final diagnosis", "Impression"])
    ?? extractSectionLines(input.documentText, "Diagnosis", ["Comment", "Note", "Signed"])[0]
    ?? "Review the main diagnosis section with your clinician.";
  const specimen = extractLabel(input.documentText, ["Specimen", "Tissue", "Site"]) ?? "Pathology sample";

  return {
    kind: "pathology_report",
    title: "Your pathology report, simply explained",
    summary: diagnosis,
    plainEnglish:
      `This report describes what was seen in a sample — it is not the whole care plan by itself. In plain words, the key line points to: ${diagnosis.toLowerCase()} Ask your clinician what that means for next steps.`,
    sourceAnchors: [diagnosis, specimen].filter(Boolean),
    keyPoints: [
      { label: "Main finding", detail: diagnosis, sourceAnchor: "Diagnosis" },
      { label: "What was sampled", detail: specimen, sourceAnchor: "Specimen" },
      { label: "What this does not decide alone", detail: "Your clinician connects this result with the rest of your care.", sourceAnchor: "Clinical context" },
    ],
    metrics: [
      { label: "Specimen", value: specimen, caveat: "From the report header when available." },
      { label: "What Clariti can say", value: "Needs clinician", caveat: "Ask what this means for you." },
    ],
    flags: [{ label: "Talk through results", detail: "Pathology wording can sound scary or vague. Bring questions to your clinician.", severity: "check" }],
    questions: [
      "What does this finding mean for my next step?",
      "Is any more testing needed?",
      "How soon should we talk about a plan?",
    ],
    nextActions: ["Save questions for your clinician", "Bring the report to your follow-up", "Ask Clariti to unpack any confusing terms"],
    safetyNote: "Clariti explains the pathology wording. It does not diagnose on its own.",
    videoScenes: genericScenes(input.kind, diagnosis, specimen, "Ask what this finding means for next steps."),
  };
}

function buildReferralFallback(input: AnalyzeInput): ClaritiAnalysis {
  const reason = extractLabel(input.documentText, ["Reason for referral", "Referral reason", "Regarding"])
    ?? findLine(input.documentText, /referr/i)
    ?? "Review why you were referred and what the specialist is being asked to do.";
  const specialist = extractLabel(input.documentText, ["Referred to", "Specialist", "To"]) ?? "Specialist";

  return {
    kind: "referral_letter",
    title: "Your referral, simply explained",
    summary: reason,
    plainEnglish:
      `This letter asks a specialist to take a closer look. ${specialist !== "Specialist" ? `It appears directed to ${specialist}. ` : ""}Use it to understand why you were sent and what to ask at the visit.`,
    sourceAnchors: [reason, specialist].filter(Boolean),
    keyPoints: [
      { label: "Why you were referred", detail: reason, sourceAnchor: "Reason for referral" },
      { label: "Who you are seeing", detail: specialist, sourceAnchor: "Referred to" },
      { label: "How to prepare", detail: "Bring this letter, recent results, and questions about what the specialist should focus on.", sourceAnchor: "Referral letter" },
    ],
    metrics: [
      { label: "Referral to", value: specialist, caveat: "From the letter when available." },
      { label: "Focus", value: "Specialist visit", caveat: "Confirm appointment details separately." },
    ],
    flags: [{ label: "Bring the letter", detail: "Specialists often need the exact referral wording and recent records.", severity: "info" }],
    questions: [
      "What should the specialist focus on first?",
      "What records or results should I bring?",
      "Is there anything I should do while I wait?",
    ],
    nextActions: ["Confirm the specialist appointment", "Gather recent results and this letter", "Write down your top questions"],
    safetyNote: "Clariti explains the referral wording. It does not replace your clinicians.",
    videoScenes: genericScenes(input.kind, reason, specialist, "Ask what to bring and what to focus on."),
  };
}

function buildVisitNotesFallback(input: AnalyzeInput): ClaritiAnalysis {
  const complaint = extractLabel(input.documentText, ["Chief complaint", "Reason for visit", "CC"])
    ?? "Review what was discussed and what the plan is.";
  const plan = extractSectionLines(input.documentText, "Plan", ["Follow-up", "Medications", "Signed"]).slice(0, 4);
  const assessment = extractSectionLines(input.documentText, "Assessment", ["Plan", "Follow-up"]).slice(0, 3);

  return {
    kind: "visit_notes",
    title: "Your visit notes, simply explained",
    summary: complaint,
    plainEnglish:
      `These notes capture what happened at the visit. ${plan[0] ? `The plan section mentions: "${plan[0]}".` : "Look for the plan, any new tests or medicines, and follow-up timing."}`,
    sourceAnchors: [complaint, ...plan.slice(0, 2), ...assessment.slice(0, 1)].filter(Boolean).slice(0, 5),
    keyPoints: [
      { label: "Why you were seen", detail: complaint, sourceAnchor: "Chief complaint" },
      { label: "What the plan says", detail: plan[0] ?? assessment[0] ?? "Check the Assessment and Plan sections.", sourceAnchor: "Plan" },
      { label: "Your next move", detail: "Confirm any tests, medicines, or follow-up dates that were mentioned.", sourceAnchor: "Follow-up" },
    ],
    metrics: [
      { label: "Visit focus", value: truncate(complaint, 28), caveat: "From the note header when available." },
      { label: "Plan items", value: String(plan.length || "Check note"), caveat: "From the Plan section." },
    ],
    flags: [{ label: "Confirm the plan", detail: "If something in the notes does not match what you remember, ask the clinic to clarify.", severity: "info" }],
    questions: [
      "What follow-up or tests were planned?",
      "Did any medicines change?",
      "What should I watch for before the next visit?",
    ],
    nextActions: ["Highlight the plan section", "Track any ordered tests", "Ask Clariti to unpack unclear medical words"],
    safetyNote: "Clariti explains the visit notes. It does not replace your clinician.",
    videoScenes: genericScenes(input.kind, complaint, plan[0] ?? "Check the plan section.", "Ask what follow-up was planned."),
  };
}

function buildPriorAuthFallback(input: AnalyzeInput): ClaritiAnalysis {
  const decision = findLine(input.documentText, /\b(approved|denied|pended|more information needed|partially approved)\b/i)
    ?? extractLabel(input.documentText, ["Determination", "Decision", "Status"])
    ?? "Review whether the request was approved, denied, or needs more information.";
  const service = extractLabel(input.documentText, ["Service", "Requested service", "Procedure", "Medication"]) ?? "Requested service";
  const authNumber = extractLabel(input.documentText, ["Authorization number", "Auth number", "Reference number"]);

  return {
    kind: "prior_authorization",
    title: "Your prior authorization, simply explained",
    summary: decision,
    plainEnglish:
      `This letter is about whether insurance will cover something before it happens. ${authNumber ? `A reference number listed is ${authNumber}. ` : ""}Read the decision carefully, then check deadlines or appeal steps if needed.`,
    sourceAnchors: [decision, service, authNumber].filter(Boolean) as string[],
    keyPoints: [
      { label: "The decision", detail: decision, sourceAnchor: "Determination" },
      { label: "What was requested", detail: service, sourceAnchor: "Service" },
      { label: "What to do next", detail: /denied|more information|pended/i.test(decision) ? "Look for appeal steps or missing information deadlines." : "Confirm the approval details with your provider before the service.", sourceAnchor: "Next steps" },
    ],
    metrics: [
      { label: "Status", value: truncate(decision, 24), caveat: "From the determination wording." },
      { label: "Reference", value: authNumber ?? "Check letter", caveat: "Use this when you call." },
    ],
    flags: [{ label: "Watch deadlines", detail: "Denials and info requests often have short response windows.", severity: "check" }],
    questions: [
      "What exactly was approved or denied?",
      "If denied, what is the appeal deadline?",
      "Does my provider need to send more information?",
    ],
    nextActions: ["Call the insurer with the reference number", "Share the letter with your provider", "Calendar any appeal or response deadline"],
    safetyNote: "Clariti explains the prior auth letter. Confirm coverage with the insurer or provider.",
    videoScenes: genericScenes(input.kind, decision, service, "Ask what to do next on this authorization."),
  };
}

function buildGenericFallback(input: AnalyzeInput): ClaritiAnalysis {
  const meta = getClaritiKindMeta("unknown");
  const firstLines = input.documentText.split(/\r?\n/).map(cleanExtractedLine).filter(Boolean).slice(0, 5);
  const headline = firstLines[0] ?? "This health document needs a careful read-through.";

  return {
    kind: "unknown",
    title: "Your health document, simply explained",
    summary: headline,
    plainEnglish:
      "Clariti will treat this as general health paperwork and pull out the main points in everyday language. If we can tell what kind of document it is later, the explanation can get more specific.",
    sourceAnchors: firstLines.slice(0, 4).length ? firstLines.slice(0, 4) : ["Document text"],
    keyPoints: [
      { label: "What stands out first", detail: headline, sourceAnchor: "Opening lines" },
      { label: "What to check next", detail: firstLines[1] ?? "Look for dates, amounts, findings, or instructions that affect what you do next.", sourceAnchor: "Document body" },
      { label: "Who to ask", detail: "Bring unclear parts to the clinic, insurer, billing team, or pharmacist who sent it.", sourceAnchor: "Next steps" },
    ],
    metrics: [
      { label: "Document type", value: meta.shortTitle, caveat: "Could not confidently classify yet." },
      { label: "Focus", value: "Main points", caveat: "Grounded in the uploaded text." },
    ],
    flags: [{ label: "Still confirm with a human", detail: "When the document type is unclear, double-check important next steps with the sender.", severity: "info" }],
    questions: [
      "What is the most important thing I should clarify?",
      "Is there a deadline or follow-up in this paperwork?",
      "Who is the right person to call about this?",
    ],
    nextActions: ["Highlight confusing sections", "Ask Clariti follow-up questions", "Contact the office that issued the document"],
    safetyNote: meta.safetyShort,
    videoScenes: genericScenes("unknown", headline, firstLines[1] ?? "Review the key sections carefully.", "Ask what matters most in this paperwork."),
  };
}

function genericScenes(kind: ClaritiAnalysisKind, main: string, second: string, question: string) {
  const meta = getClaritiKindMeta(kind);
  return [
    { title: "What this is", script: `This looks like a ${meta.documentNoun}. We stay close to the exact wording.`, visual: "Document overview with key section highlighted", sourceAnchor: "Document header" },
    { title: "Main takeaway", script: main, visual: "Plain-English summary card", sourceAnchor: "Main section" },
    { title: "Important detail", script: second, visual: "Secondary detail callout", sourceAnchor: "Details" },
    { title: "What to be careful about", script: meta.safetyShort, visual: "Careful-item checklist", sourceAnchor: "Safety note" },
    { title: "Questions to ask", script: question, visual: "Question list for next conversation", sourceAnchor: "Next steps" },
  ];
}

function truncate(value: string, max: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function extractMoneyAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*:?\\s*([-+]?\\$?\\d[\\d,]*(?:\\.\\d{2})?)`, "i"));
    if (match?.[1]) return normalizeMoney(match[1]);
  }
  return null;
}

function extractLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`^\\s*(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*:?\\s*(.+)$`, "im"));
    if (match?.[1]) return cleanExtractedLine(match[1]);
  }
  return null;
}

function extractSectionLines(text: string, heading: string, stopHeadings: string[]) {
  const lines = text.split(/\r?\n/).map(cleanExtractedLine).filter(Boolean);
  const target = normalizeHeading(heading);
  const start = lines.findIndex((line) => normalizeHeading(line) === target || normalizeHeading(line).startsWith(`${target} `));
  if (start === -1) return [];

  const stops = new Set(stopHeadings.map(normalizeHeading));
  const collected: string[] = [];
  const firstLineRemainder = stripHeadingPrefix(lines[start], heading);
  if (firstLineRemainder) collected.push(firstLineRemainder);

  for (const line of lines.slice(start + 1)) {
    const normalized = normalizeHeading(line);
    if (stops.has(normalized) || [...stops].some((stop) => normalized.startsWith(`${stop} `))) break;
    collected.push(line.replace(/^\d+\.\s*/, ""));
  }
  return collected.map(cleanExtractedLine).filter((line) => line && !/^\*\*?page\s+\d+/i.test(line));
}

function findLine(text: string, pattern: RegExp) {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => pattern.test(line)) ?? null;
}

function normalizeMoney(value: string) {
  if (value.startsWith("$") || value.startsWith("-$")) return value;
  if (value.startsWith("-")) return `-$${value.slice(1)}`;
  return `$${value}`;
}

function cleanExtractedLine(line: string) {
  return line
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeading(line: string) {
  return cleanExtractedLine(line)
    .replace(/:.*$/, "")
    .replace(/[^\w\s/-]/g, "")
    .trim()
    .toLowerCase();
}

function stripHeadingPrefix(line: string, heading: string) {
  const cleaned = cleanExtractedLine(line);
  const pattern = new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*(.*)$`, "i");
  const match = cleaned.match(pattern);
  return match?.[1]?.trim() ?? "";
}
