import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1),
  analysis: claritiAnalysisSchema,
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "Supabase auth is required to save messages." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const { analysis, content, sessionId } = parsed.data;
  const assistantContent = await generateGroundedFollowUp(content, analysis);
  const supabase = await getSupabaseSessionClient();

  const { data, error } = await supabase
    .from("clariti_messages")
    .insert([
      { session_id: sessionId, role: "user", content },
      { session_id: sessionId, role: "assistant", content: assistantContent },
    ])
    .select("id, role, content, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data, assistant: assistantContent });
}

async function generateGroundedFollowUp(question: string, analysis: z.infer<typeof claritiAnalysisSchema>) {
  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) return buildGroundedFollowUp(question, analysis);

  try {
    const result = await generateText({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      temperature: 0.2,
      maxOutputTokens: 360,
      system:
        "You are Clariti, a careful consumer health document copilot. Answer conversationally, but only from the saved analysis. " +
        "Do not diagnose, prescribe, make final coverage/payment decisions, or invent document findings. " +
        "If the user asks for a phone follow-up, ask for the best phone number and preferred time before scheduling. " +
        "If the user provides a phone number and timing, acknowledge that the app can capture it for scheduling. " +
        "Always include a short source phrase and keep the answer under 140 words.",
      prompt:
        `User message: ${question}\n\n` +
        `Saved analysis JSON:\n${JSON.stringify(analysis).slice(0, 9000)}\n\n` +
        "Write the next Clariti reply. Be specific to this user message. Include Source: with the relevant source anchor.",
    });
    return result.text.trim() || buildGroundedFollowUp(question, analysis);
  } catch {
    return buildGroundedFollowUp(question, analysis);
  }
}

function buildGroundedFollowUp(question: string, analysis: z.infer<typeof claritiAnalysisSchema>) {
  const lower = question.toLowerCase();
  const source = analysis.sourceAnchors[0] ?? "the saved document analysis";
  const amountPoint = analysis.metrics.find((metric) => /\$|£|amount|paid|due|responsibility|billed/i.test(`${metric.label} ${metric.value}`));
  const matchingPoint = analysis.keyPoints.find((point) => lower.includes(point.label.toLowerCase().split(" ")[0])) ?? analysis.keyPoints[0];
  const mainPoint = formatPoint(matchingPoint);

  if (/schedule|follow-up|follow up|call back|phone follow|reminder|set.*time/.test(lower)) {
    const action = analysis.nextActions[0] ?? "review this document with the relevant clinician or provider";
    const questions = analysis.questions.slice(0, 2).join(" ");
    return `Yes. I can help set this up as a focused phone follow-up, but I need the best phone number to call and a preferred time before scheduling. Purpose: ${action}. Reason: the saved analysis highlights ${mainPoint} Source: ${matchingPoint.sourceAnchor}. Suggested default: tomorrow morning, unless symptoms are worsening or the document mentions urgent instructions. Reply with the phone number and timing, for example: "+44 7123 456789 tomorrow morning", and tell me whether this call should prepare clinician questions, review next steps, or remind you to contact the provider. Useful prompts: ${questions} ${analysis.safetyNote}`;
  }

  if (/cancer|tumou?r|malignan|mass|lesion/.test(lower)) {
    const mentionedConcern = analysis.keyPoints
      .concat(analysis.flags.map((flag) => ({ label: flag.label, detail: flag.detail, sourceAnchor: flag.label })))
      .find((point) => /cancer|tumou?r|malignan|mass|lesion/i.test(`${point.label} ${point.detail}`));

    if (mentionedConcern) {
      return `Clariti cannot diagnose cancer from this document, but it can point to the exact wording it saved: ${formatPoint(mentionedConcern)} Source: ${mentionedConcern.sourceAnchor}. Please ask your clinician what that wording means for you. ${analysis.safetyNote}`;
    }

    return `Clariti cannot tell from this report whether you have cancer. The saved analysis does not include a cancer, tumour, malignancy, mass, or lesion finding; it highlights: ${mainPoint} Source: ${matchingPoint.sourceAnchor}. Ask your clinician to confirm what the report rules in and rules out, especially if symptoms are worsening or new.`;
  }

  if (/ignore|safe to ignore|nothing to do|leave it|wait and see/.test(lower)) {
    const nextStep = analysis.nextActions[0] ?? "review the report with the clinician who ordered it";
    const questions = analysis.questions.slice(0, 2).map((item) => item.replace(/\.+$/, "?")).join(" ");
    return `Do not treat this as something to ignore. The grounded takeaway is: ${mainPoint} Source: ${matchingPoint.sourceAnchor}. A safer next step is to ${nextStep.toLowerCase()}. Useful questions: ${questions} ${analysis.safetyNote}`;
  }

  if (/owe|pay|amount|cost|charge|bill|covered|insurance/.test(lower) && amountPoint) {
    return `Based on the saved analysis, ${amountPoint.label.toLowerCase()} is listed as ${amountPoint.value}. ${amountPoint.caveat ?? "Confirm this against the original document."} Source: ${source}. Clariti cannot make a final coverage or payment decision, so the safest next step is to confirm this with the insurer or provider.`;
  }

  if (/next|ask|question|call|follow/.test(lower)) {
    return `The safest next step from this analysis is: ${analysis.nextActions[0]}. Useful questions to ask include: ${analysis.questions.slice(0, 2).join(" ")} Source: ${source}.`;
  }

  return `From the saved analysis: ${mainPoint} Source: ${matchingPoint.sourceAnchor}. ${analysis.safetyNote}`;
}

function formatPoint(point: { label: string; detail: string }) {
  const detail = point.detail.replace(/\s+/g, " ").replace(/\.+$/, ".");
  return `${point.label} - ${detail}`;
}
