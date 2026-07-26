import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";

type BuildClaritiCallContextInput = {
  analysis: ClaritiAnalysis;
  sessionId: string;
  userId?: string;
  userName?: string;
  goal?: string;
  originalDocumentText?: string | null;
};

export function buildClaritiCallContext({
  analysis,
  goal,
  originalDocumentText,
  sessionId,
  userId,
  userName,
}: BuildClaritiCallContextInput) {
  const documentLabel = documentKindLabel(analysis.kind);
  const callGoal = goal ?? `Help the user understand this ${documentLabel} and decide what to ask next.`;
  const originalExcerpt = buildSafeOriginalDocumentExcerpt(originalDocumentText);
  const context = [
    `Clariti session: ${sessionId}`,
    userId ? `User id: ${userId}` : "",
    `Document type: ${documentLabel}`,
    `Document kind code: ${analysis.kind}`,
    `Document title: ${analysis.title}`,
    `Summary: ${analysis.summary}`,
    `Plain English: ${analysis.plainEnglish}`,
    `Source anchors:\n${analysis.sourceAnchors.map((anchor) => `- ${anchor}`).join("\n")}`,
    `Key points:\n${analysis.keyPoints.map((point) => `- ${point.label}: ${point.detail} (source: ${point.sourceAnchor})`).join("\n")}`,
    analysis.metrics.length > 0 ? `Metrics:\n${analysis.metrics.map((metric) => `- ${metric.label}: ${metric.value}${metric.caveat ? ` (${metric.caveat})` : ""}`).join("\n")}` : "",
    analysis.flags.length > 0 ? `Careful items:\n${analysis.flags.map((flag) => `- ${flag.label}: ${flag.detail}`).join("\n")}` : "",
    `Suggested questions:\n${analysis.questions.map((question) => `- ${question}`).join("\n")}`,
    originalExcerpt ? `Original extracted document excerpt for grounding:\n${originalExcerpt}` : "Original extracted document excerpt: unavailable; rely on the saved Clariti analysis only.",
    `Safety boundary: ${analysis.safetyNote}`,
  ].filter(Boolean).join("\n\n");
  const systemPrompt = buildClaritiCallSystemPrompt({ analysis, callGoal, context, documentLabel });
  const firstMessage = buildClaritiFirstMessage({ documentLabel, title: analysis.title });

  return {
    dynamicVariables: {
      user_name: userName ?? "there",
      user_id: userId ?? "",
      session_id: sessionId,
      plan_id: sessionId,
      thread_title: analysis.title,
      document_kind: analysis.kind,
      document_type_label: documentLabel,
      document_title: analysis.title,
      original_document_excerpt: originalExcerpt,
      report_analysis: analysis.summary,
      report_context: context,
      thread_context: context,
      call_goal: callGoal,
      checkin_goal: callGoal,
      safety_boundary: analysis.safetyNote,
      agent_name: "Clariti",
      assistant_name: "Clariti",
      product_name: "Clariti",
      brand_name: "Clariti",
      clariti_agent_instructions:
        `You are Clariti, the Clariti ${documentLabel} follow-up assistant. Always introduce yourself as Clariti. Keep the call concise, warm, and grounded only in this saved Clariti context and original document excerpt. Do not switch document types or call a ${documentLabel} a different document type. Do not diagnose, prescribe, or make final billing, coverage, or payment decisions.`,
      clariti_first_message: firstMessage,
      clariti_system_prompt: systemPrompt,
    },
    conversationConfigOverride: {
      agent: {
        first_message: firstMessage,
        prompt: {
          prompt: systemPrompt,
        },
      },
    },
    systemPrompt,
    firstMessage,
  };
}

function buildClaritiCallSystemPrompt({
  analysis,
  callGoal,
  context,
  documentLabel,
}: {
  analysis: ClaritiAnalysis;
  callGoal: string;
  context: string;
  documentLabel: string;
}) {
  const roleLine = analysis.kind === "radiology_report"
    ? "This call is about a radiology report. Discuss report wording, anatomy terms, findings, impressions, and questions for the treating clinician. Do not describe it as a medical bill or insurance EOB."
    : analysis.kind === "medical_bill"
      ? "This call is about a medical bill or provider statement. Discuss charges, payments, unclear line items, and questions for billing or insurance. Do not describe it as a radiology findings report."
      : "This call is about an insurance Explanation of Benefits. Discuss billed, allowed, plan-paid, and possible patient responsibility amounts. Make clear an EOB is not always a bill.";

  return [
    "You are Clariti, a careful consumer health document copilot on a short phone call.",
    "Always introduce yourself as Clariti. Never say Nura or any other product name.",
    roleLine,
    `Exact document type: ${documentLabel}. Stay in this context for the whole call unless the user clearly asks about a different uploaded document.`,
    `Call goal: ${callGoal}`,
    "Use only the Clariti context below and the original extracted document excerpt. Treat it as retrieval context, not as general medical knowledge.",
    "If a fact is not in the context, say you do not see it in this document and turn it into a safe question for the clinician, insurer, provider, or billing team.",
    "Be concise and conversational. Prefer 1-2 short sentences, then ask one useful next question.",
    "Be proactive about follow-through: when the document suggests a clinician question, billing query, insurer check, or revisit point, offer to help set a focused follow-up call/reminder. Do not wait for the user to suggest it every time.",
    "Only suggest one follow-up at a time, tied to the document type and source context. Example patterns: radiology report -> clinician questions or symptom-context visit; medical bill -> billing office/provider question; insurance EOB -> insurer/provider reconciliation question.",
    "If the user accepts a follow-up, collect the purpose, phone number, and preferred day/time conversationally. If any of those details are already known in context, do not ask for them again.",
    "Do not diagnose, prescribe, recommend treatment, decide urgency, decide insurance coverage, or say the user definitely owes money.",
    "If the user mentions urgent or worsening symptoms, tell them to contact their clinician urgently or seek emergency care.",
    "If scheduling a call or follow-up, ask only for missing fields. Do not ask again for a phone number or time that is already in the conversation.",
    "Clariti context:",
    context,
  ].join("\n\n");
}

function buildClaritiFirstMessage({ documentLabel, title }: { documentLabel: string; title: string }) {
  return `Hi, this is Clariti. I’m calling about your ${documentLabel}, “${title}”. I’ll keep this grounded in the saved document analysis and help you decide what to ask next.`;
}

function documentKindLabel(kind: ClaritiAnalysis["kind"]) {
  if (kind === "radiology_report") return "radiology report";
  if (kind === "medical_bill") return "medical bill";
  if (kind === "insurance_eob") return "insurance EOB";
  return "health document";
}

function buildSafeOriginalDocumentExcerpt(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/\b(MRN|Patient ID|PID|DOB|Date of Birth)\s*[:#]?\s*[A-Za-z0-9/_-]+/gi, "$1: [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}
