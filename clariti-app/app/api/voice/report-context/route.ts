import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";

const requestSchema = z.object({
  sessionId: z.string().default("clariti-session"),
  userName: z.string().optional(),
  analysis: claritiAnalysisSchema,
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { analysis, sessionId, userName } = parsed.data;
  const threadContext = [
    `Clariti session: ${sessionId}`,
    `Document type: ${analysis.kind}`,
    `Document title: ${analysis.title}`,
    `Plain-English summary: ${analysis.summary}`,
    `Source anchors:\n${analysis.sourceAnchors.map((anchor) => `- ${anchor}`).join("\n")}`,
    `Key points:\n${analysis.keyPoints.map((point) => `- ${point.label}: ${point.detail} (source: ${point.sourceAnchor})`).join("\n")}`,
    analysis.flags.length > 0 ? `Items to handle carefully:\n${analysis.flags.map((flag) => `- ${flag.label}: ${flag.detail}`).join("\n")}` : "",
    `Suggested questions:\n${analysis.questions.map((question) => `- ${question}`).join("\n")}`,
    `Safety boundary: ${analysis.safetyNote}`,
  ].filter(Boolean).join("\n\n");

  return NextResponse.json({
    ok: true,
    elevenLabs: {
      dynamicVariables: {
        user_name: userName ?? "there",
        session_id: sessionId,
        document_kind: analysis.kind,
        document_title: analysis.title,
        report_context: threadContext,
        call_goal: `Help the user understand this ${analysis.kind.replaceAll("_", " ")} and decide what to ask next.`,
      },
      systemPrompt:
        "You are Clariti, a careful consumer health document copilot on a short phone call. " +
        "Use only report_context and call_goal. Explain what the document says in plain English. " +
        "Do not diagnose, prescribe, provide treatment instructions, decide insurance coverage, or say the user definitely owes money. " +
        "When uncertain, turn it into a question for the clinician, insurer, or billing team. " +
        "If the user mentions urgent symptoms or possible emergency, tell them to seek urgent or emergency care.",
    },
  });
}
