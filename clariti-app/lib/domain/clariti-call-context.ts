import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";

type BuildClaritiCallContextInput = {
  analysis: ClaritiAnalysis;
  sessionId: string;
  userId?: string;
  userName?: string;
  goal?: string;
};

export function buildClaritiCallContext({
  analysis,
  goal,
  sessionId,
  userId,
  userName,
}: BuildClaritiCallContextInput) {
  const callGoal = goal ?? `Help the user understand this ${analysis.kind.replaceAll("_", " ")} and decide what to ask next.`;
  const context = [
    `Clariti session: ${sessionId}`,
    userId ? `User id: ${userId}` : "",
    `Document type: ${analysis.kind}`,
    `Document title: ${analysis.title}`,
    `Summary: ${analysis.summary}`,
    `Plain English: ${analysis.plainEnglish}`,
    `Source anchors:\n${analysis.sourceAnchors.map((anchor) => `- ${anchor}`).join("\n")}`,
    `Key points:\n${analysis.keyPoints.map((point) => `- ${point.label}: ${point.detail} (source: ${point.sourceAnchor})`).join("\n")}`,
    analysis.metrics.length > 0 ? `Metrics:\n${analysis.metrics.map((metric) => `- ${metric.label}: ${metric.value}${metric.caveat ? ` (${metric.caveat})` : ""}`).join("\n")}` : "",
    analysis.flags.length > 0 ? `Careful items:\n${analysis.flags.map((flag) => `- ${flag.label}: ${flag.detail}`).join("\n")}` : "",
    `Suggested questions:\n${analysis.questions.map((question) => `- ${question}`).join("\n")}`,
    `Safety boundary: ${analysis.safetyNote}`,
  ].filter(Boolean).join("\n\n");

  return {
    dynamicVariables: {
      user_name: userName ?? "there",
      user_id: userId ?? "",
      session_id: sessionId,
      plan_id: sessionId,
      thread_title: analysis.title,
      document_kind: analysis.kind,
      document_title: analysis.title,
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
        "You are Clariti, the Clariti document follow-up assistant. Always introduce yourself as Clariti. Keep the call concise, warm, and grounded only in this Clariti document analysis. Ask how the user is doing, clarify the document wording, and help them choose a safe next question or provider/insurer follow-up. Do not diagnose, prescribe, or make final billing, coverage, or payment decisions.",
    },
    systemPrompt:
      "You are Clariti, a careful consumer health document copilot on a short phone call. " +
      "Always identify yourself as Clariti and never use any other product or assistant name. " +
      "Use only report_context/thread_context and call_goal/checkin_goal. Be concise and friendly. " +
      "Do not diagnose, prescribe, provide treatment instructions, decide insurance coverage, or say the user definitely owes money. " +
      "When uncertain, turn it into a question for the clinician, insurer, or billing team. " +
      "If the user mentions urgent symptoms or possible emergency, tell them to seek urgent or emergency care.",
  };
}
