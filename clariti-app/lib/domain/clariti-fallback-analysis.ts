import type { ClaritiAnalysis, ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";

type AnalyzeInput = {
  kind: ClaritiAnalysisKind;
  question: string;
  documentText: string;
  fileName?: string;
};

export function inferClaritiKind(input: AnalyzeInput): ClaritiAnalysisKind {
  const combined = `${input.fileName ?? ""}\n${input.question}\n${input.documentText}`.toLowerCase();
  const scores: Record<ClaritiAnalysisKind, number> = {
    medical_bill: 0,
    insurance_eob: 0,
    radiology_report: 0,
  };

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

  const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] as [ClaritiAnalysisKind, number];
  if (strongest[1] >= 3 && strongest[0] !== input.kind) return strongest[0];
  return input.kind;
}

export function buildFallbackAnalysis(input: AnalyzeInput): ClaritiAnalysis {
  if (input.kind === "radiology_report") {
    const impression = extractSectionLines(input.documentText, "Impression", ["Recommendation", "Patient question"]).slice(0, 4);
    const findings = extractSectionLines(input.documentText, "Findings", ["Impression"]).slice(0, 5);
    const exam = extractLabel(input.documentText, ["Exam", "Study", "Procedure"]) ?? "Radiology report";
    const primaryImpression = impression[0] ?? "Review the Impression section from the uploaded report.";
    const reassuringLine = impression.find((line) => /no significant|no acute|negative|normal/i.test(line)) ?? findings.find((line) => /no significant|no acute|normal/i.test(line));

    return {
      kind: "radiology_report",
      title: "Radiology report explanation",
      summary: primaryImpression,
      plainEnglish:
        `This is an explanation of the report wording, not a diagnosis. The report describes ${primaryImpression.toLowerCase()} ${reassuringLine ? `It also says: "${reassuringLine}".` : "Ask the ordering clinician how these findings connect to symptoms and the care plan."}`,
      sourceAnchors: [...impression.map((line) => `Impression: ${line}`), ...findings.slice(0, 2).map((line) => `Findings: ${line}`)].slice(0, 5),
      keyPoints: [
        { label: "Main impression", detail: primaryImpression, sourceAnchor: "Impression" },
        { label: "Reassuring wording", detail: reassuringLine ?? "No explicit reassuring phrase was extracted; review the full report with your clinician.", sourceAnchor: reassuringLine ? "Impression / Findings" : "Full report" },
        { label: "Follow-up", detail: extractSectionLines(input.documentText, "Recommendation", ["Patient question"])[0] ?? "Ask the ordering clinician how the report connects to symptoms.", sourceAnchor: "Recommendation" },
      ],
      metrics: [
        { label: "Report type", value: exam, caveat: "From the report header." },
        { label: "Concern level", value: "Needs clinician context", caveat: "Clariti does not triage severity unless urgent language is explicit." },
      ],
      flags: [{ label: "Clinician review", detail: "Radiology reports need clinical context from the ordering clinician.", severity: "check" }],
      questions: [
        "Which finding best explains my symptoms?",
        "Is any follow-up imaging or appointment recommended in this report?",
        "Are there urgent signs I should watch for?",
      ],
      nextActions: ["Save clinician questions", "Bring the report to your follow-up visit", "Ask Clariti to talk through the exact terms"],
      safetyNote: "Clariti explains report wording and does not diagnose or replace a clinician.",
      videoScenes: [
        { title: "What this report is", script: `This report is for ${exam}. We focus on the exact Impression and Findings text.`, visual: "Report header and highlighted Impression section", sourceAnchor: "Report header" },
        { title: "Main impression", script: primaryImpression, visual: "Plain-English summary beside the source impression", sourceAnchor: "Impression" },
        { title: "Anatomy terms", script: findings[0] ?? "Review the Findings section for the body area and level described.", visual: "Simple anatomy labels from the Findings text", sourceAnchor: "Findings" },
        { title: "Reassuring and follow-up language", script: reassuringLine ?? "Separate reassuring wording from questions that need clinician context.", visual: "Two-column checklist with source-backed notes", sourceAnchor: "Findings / Recommendation" },
        { title: "Questions to ask", script: "The safest next step is to ask your clinician how the report connects to your symptoms and care plan.", visual: "Question list for clinician visit", sourceAnchor: "Clinical context" },
      ],
    };
  }

  if (input.kind === "insurance_eob") {
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
      title: "Insurance EOB explanation",
      summary: `This EOB shows ${billed ?? "the provider-billed amount"} billed, ${allowed ?? "an allowed amount"} allowed, ${planPaid ?? "a plan payment"} paid by insurance, and ${responsibility ?? "a possible patient responsibility"} assigned to the patient.`,
      plainEnglish:
        `This is an insurance processing summary, not necessarily a request for payment. ${notBill ? `The document says: "${notBill}". ` : ""}Compare the patient responsibility with any provider bill before paying.`,
      sourceAnchors: [
        billed ? `Amount billed by provider: ${billed}` : "Amount billed by provider",
        allowed ? `Allowed amount: ${allowed}` : "Allowed amount",
        planPaid ? `Amount paid by plan: ${planPaid}` : "Amount paid by plan",
        responsibility ? `Patient responsibility: ${responsibility}` : "Patient responsibility",
        claimNumber ? `Claim number: ${claimNumber}` : "",
      ].filter(Boolean),
      keyPoints: [
        { label: "Provider billed", detail: billed ? `${billed} was submitted by ${provider ?? "the provider"}.` : "Review the provider-billed amount on the EOB.", sourceAnchor: "Amount billed by provider" },
        { label: "Insurance paid", detail: planPaid ? `${planPaid} is listed as the amount paid by the plan.` : "Review the plan-paid amount on the EOB.", sourceAnchor: "Amount paid by plan" },
        { label: "Patient responsibility", detail: responsibility ? `${responsibility} is assigned as patient responsibility. Confirm it against an actual provider bill before paying.` : "The EOB may assign an amount to you, but confirm against an actual bill.", sourceAnchor: "Patient responsibility" },
      ],
      metrics: [
        { label: "Provider billed", value: billed ?? "Check EOB", caveat: "Starting charge before adjustment." },
        { label: "Plan paid", value: planPaid ?? "Check EOB", caveat: "Insurance payment listed." },
        { label: "Patient responsibility", value: responsibility ?? "Check EOB", caveat: "Confirm with provider bill." },
      ],
      flags: [{ label: "Not a bill", detail: "Do not pay from the EOB alone unless the insurer/provider confirms payment is due.", severity: "info" }],
      questions: [
        "Has the provider sent an actual bill that matches this patient responsibility?",
        deductible || coinsurance ? `Was ${deductible ? `${deductible} deductible` : ""}${deductible && coinsurance ? " and " : ""}${coinsurance ? `${coinsurance} coinsurance` : ""} applied correctly?` : "Was deductible, copay, or coinsurance applied?",
        claimNumber ? `Can the insurer review claim ${claimNumber}?` : "Can the insurer review this claim number?",
      ],
      nextActions: ["Compare the EOB with the provider bill", "Call the insurer with the claim number", "Ask the provider to confirm the current balance"],
      safetyNote: "Clariti does not make final coverage or payment determinations.",
    };
  }

  const totalCharges = extractMoneyAfter(input.documentText, ["Total charges", "Total billed"]);
  const amountDue = extractMoneyAfter(input.documentText, ["Current amount due", "Amount due"]);
  const insurancePayment = extractMoneyAfter(input.documentText, ["Insurance payment received", "Insurance paid"]);
  const facilityFee = extractMoneyAfter(input.documentText, ["Facility fee"]);
  const provider = extractLabel(input.documentText, ["Provider"]);
  const lineItems = extractSectionLines(input.documentText, "Line items", ["Notes", "Patient question"]).slice(0, 5);

  return {
    kind: "medical_bill",
    title: "Medical bill breakdown",
    summary: `This bill lists ${totalCharges ?? "total charges"} in charges and ${amountDue ?? "an amount due"} as the current balance${provider ? ` from ${provider}` : ""}.`,
    plainEnglish:
      `The document appears to be a provider bill. ${insurancePayment ? `It shows insurance payment received of ${insurancePayment}. ` : ""}Before paying, compare the amount due with the EOB and ask about unclear or unusual line items.`,
    sourceAnchors: [
      totalCharges ? `Total charges: ${totalCharges}` : "Total charges",
      amountDue ? `Current amount due: ${amountDue}` : "Amount due",
      insurancePayment ? `Insurance payment received: ${insurancePayment}` : "",
      facilityFee ? `Facility fee: ${facilityFee}` : "",
    ].filter(Boolean),
    keyPoints: [
      { label: "Total billed", detail: totalCharges ? `${totalCharges} is listed as total charges.` : "Review the total charge line on the bill.", sourceAnchor: "Total charges" },
      { label: "Amount due", detail: amountDue ? `${amountDue} is listed as the current amount due; confirm against insurance records before paying.` : "Confirm the amount due against the EOB.", sourceAnchor: "Current amount due" },
      { label: "Charges to check", detail: lineItems.find((line) => /unlisted|facility|admin/i.test(line)) ?? "Ask about unclear fees, facility fees, or duplicate line items.", sourceAnchor: "Line items" },
    ],
    metrics: [
      { label: "Total charges", value: totalCharges ?? "Check bill", caveat: "Before insurance/payment comparison." },
      { label: "Amount due", value: amountDue ?? "Check bill", caveat: "Confirm against EOB." },
      { label: "Insurance paid", value: insurancePayment ?? "Not found", caveat: "Use the EOB for final confirmation." },
    ],
    flags: [{ label: "Confirm before paying", detail: facilityFee ? `Ask billing to explain the ${facilityFee} facility fee and any unclear charges before paying.` : "Compare this bill with the EOB and ask about unclear line items.", severity: "check" }],
    questions: ["Has insurance processed this claim?", "Are any charges duplicated?", "Can the provider explain each unclear line item?"],
    nextActions: ["Compare with your EOB", "Call billing about unclear fees", "Ask for an itemized statement"],
    safetyNote: "Clariti explains billing documents and does not provide legal or coverage determinations.",
  };
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
    const match = text.match(new RegExp(`^${escaped}\\s*:?\\s*(.+)$`, "im"));
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractSectionLines(text: string, heading: string, stopHeadings: string[]) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => line.toLowerCase().replace(/:$/, "") === heading.toLowerCase());
  if (start === -1) return [];

  const stops = new Set(stopHeadings.map((item) => item.toLowerCase()));
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (stops.has(line.toLowerCase().replace(/:$/, ""))) break;
    collected.push(line.replace(/^\d+\.\s*/, ""));
  }
  return collected;
}

function findLine(text: string, pattern: RegExp) {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => pattern.test(line)) ?? null;
}

function normalizeMoney(value: string) {
  if (value.startsWith("$") || value.startsWith("-$")) return value;
  if (value.startsWith("-")) return `-$${value.slice(1)}`;
  return `$${value}`;
}
