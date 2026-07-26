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
  followUpDraft: z.object({
    action: z.string().optional(),
    phoneNumber: z.string().optional(),
    timingText: z.string().optional(),
  }).optional(),
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

  const supabase = await getSupabaseSessionClient();
  const { analysis, content, followUpDraft, sessionId } = parsed.data;
  const recoveredDraft = await recoverFollowUpDraftFromSavedThread({
    analysis,
    content,
    explicitDraft: followUpDraft,
    sessionId,
    supabase,
  });
  const assistantContent = await generateGroundedFollowUp(content, analysis, recoveredDraft);
  const userMessageCreatedAt = new Date();
  const assistantMessageCreatedAt = new Date(userMessageCreatedAt.getTime() + 1);

  const { data, error } = await supabase
    .from("clariti_messages")
    .insert([
      { session_id: sessionId, role: "user", content, created_at: userMessageCreatedAt.toISOString() },
      { session_id: sessionId, role: "assistant", content: assistantContent, created_at: assistantMessageCreatedAt.toISOString() },
    ])
    .select("id, role, content, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data, assistant: assistantContent });
}

type FollowUpDraft = z.infer<typeof requestSchema>["followUpDraft"];

async function recoverFollowUpDraftFromSavedThread({
  analysis,
  content,
  explicitDraft,
  sessionId,
  supabase,
}: {
  analysis: z.infer<typeof claritiAnalysisSchema>;
  content: string;
  explicitDraft?: FollowUpDraft;
  sessionId: string;
  supabase: Awaited<ReturnType<typeof getSupabaseSessionClient>>;
}): Promise<FollowUpDraft> {
  const { data } = await supabase
    .from("clariti_messages")
    .select("content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(16);

  const threadText = [
    content,
    ...(data ?? []).map((message) => String(message.content ?? "")),
  ].join("\n");
  const hasSchedulingIntent = /follow-up|follow up|call me|call back|phone call|schedule|appointment|reminder|preferred day|preferred time|what day and time|what time works/i.test(threadText);
  if (!explicitDraft && !hasSchedulingIntent) return undefined;

  return {
    action: explicitDraft?.action ?? analysis.nextActions[0] ?? "review this document with the right professional",
    phoneNumber: explicitDraft?.phoneNumber ?? extractPhoneNumber(threadText) ?? undefined,
    timingText: explicitDraft?.timingText ?? (hasSchedulingTime(threadText) ? threadText : undefined),
  };
}

async function generateGroundedFollowUp(question: string, analysis: z.infer<typeof claritiAnalysisSchema>, followUpDraft?: FollowUpDraft) {
  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) return buildGroundedFollowUp(question, analysis, followUpDraft);

  const draftContext = followUpDraft
    ? [
      followUpDraft.action ? `Follow-up purpose already in progress: ${followUpDraft.action}.` : "",
      followUpDraft.phoneNumber ? `Known phone number already captured: ${followUpDraft.phoneNumber}. Do not ask for the phone number again.` : "",
      followUpDraft.timingText ? `Known timing context already captured: ${followUpDraft.timingText}. Do not ask for timing again unless it is ambiguous.` : "",
    ].filter(Boolean).join(" ")
    : "No follow-up scheduling draft is active.";

  try {
    const result = await generateText({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      temperature: 0.2,
      maxOutputTokens: 180,
      system:
        "You are Clariti, a careful consumer health document copilot. Answer conversationally, but only from the saved analysis. " +
        "Do not diagnose, prescribe, make final coverage/payment decisions, or invent document findings. " +
        "Keep replies concise: usually 1-3 short sentences and under 55 words. " +
        "If the user asks for a phone follow-up, ask only for missing fields: phone number and preferred day/time. Never invent or suggest a default date/time. " +
        "If the user provides a phone number but no time, ask for the preferred day/time only. " +
        "If the user provides both phone number and timing, acknowledge briefly that it can be scheduled. " +
        "If the user asks for a clinician/doctor question list, create a short prioritized list grounded in saved source anchors. " +
        "Include one short Source phrase when useful. " +
        "Write plain text only: no markdown, emoji, bold markers, or headings. Numbered question lists are allowed only when the user asks for questions.",
      prompt:
        `User message: ${question}\n\n` +
        `Follow-up draft state: ${draftContext}\n\n` +
        `Saved analysis JSON:\n${JSON.stringify(analysis).slice(0, 9000)}\n\n` +
        "Write the next Clariti reply. Be specific to this user message. Do not add scheduling details the user did not provide.",
    });
    return cleanAssistantReply(result.text) || buildGroundedFollowUp(question, analysis, followUpDraft);
  } catch {
    return buildGroundedFollowUp(question, analysis, followUpDraft);
  }
}

function cleanAssistantReply(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^[\s>*-]+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[📞🕘✅]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildGroundedFollowUp(question: string, analysis: z.infer<typeof claritiAnalysisSchema>, followUpDraft?: FollowUpDraft) {
  const lower = question.toLowerCase();
  const source = analysis.sourceAnchors[0] ?? "the saved document analysis";
  const amountPoint = analysis.metrics.find((metric) => /\$|£|amount|paid|due|responsibility|billed/i.test(`${metric.label} ${metric.value}`));
  const matchingPoint = analysis.keyPoints.find((point) => lower.includes(point.label.toLowerCase().split(" ")[0])) ?? analysis.keyPoints[0];
  const mainPoint = formatPoint(matchingPoint);
  const phoneNumber = extractPhoneNumber(question) ?? followUpDraft?.phoneNumber;
  const timingText = `${followUpDraft?.timingText ?? ""} ${question}`.trim();
  const hasTime = hasSchedulingTime(timingText);

  if (/schedule|follow-up|follow up|call back|phone follow|reminder|set.*time/.test(lower)) {
    const action = analysis.nextActions[0] ?? "review this document with the relevant clinician or provider";
    if (phoneNumber && hasTime) return "Got it. I have the phone number and timing, so I can save the follow-up now.";
    if (phoneNumber) return `Got the phone number. What day and time should Clariti use for the follow-up? Source: ${matchingPoint.sourceAnchor}.`;
    if (hasTime) return `I have the timing. What phone number should Clariti call? Source: ${matchingPoint.sourceAnchor}.`;
    return `Yes. I can set up a focused phone follow-up for ${action}. Send the best phone number and preferred day/time. Source: ${matchingPoint.sourceAnchor}.`;
  }

  if (phoneNumber && !hasTime) {
    return "Got the phone number. What day and time should Clariti use for the follow-up?";
  }

  if (phoneNumber && hasTime) {
    return "Got it. I have the phone number and timing, so I can save the follow-up now.";
  }

  if (/cancer|tumou?r|malignan|mass|lesion/.test(lower)) {
    const mentionedConcern = analysis.keyPoints
      .concat(analysis.flags.map((flag) => ({ label: flag.label, detail: flag.detail, sourceAnchor: flag.label })))
      .find((point) => /cancer|tumou?r|malignan|mass|lesion/i.test(`${point.label} ${point.detail}`));

    if (mentionedConcern) {
      return `Clariti cannot diagnose cancer from this document. The saved wording says: ${formatPoint(mentionedConcern)} Source: ${mentionedConcern.sourceAnchor}. Ask your clinician what it means for you.`;
    }

    return `I do not see a saved cancer, tumour, mass, or lesion finding in this analysis. Main point: ${mainPoint} Source: ${matchingPoint.sourceAnchor}. Ask your clinician to confirm.`;
  }

  if (/ignore|safe to ignore|nothing to do|leave it|wait and see/.test(lower)) {
    const nextStep = analysis.nextActions[0] ?? "review the report with the clinician who ordered it";
    return `I would not ignore it. Main point: ${mainPoint} Source: ${matchingPoint.sourceAnchor}. Next step: ${nextStep.toLowerCase()}.`;
  }

  if (/owe|pay|amount|cost|charge|bill|covered|insurance/.test(lower) && amountPoint) {
    return `${amountPoint.label} is listed as ${amountPoint.value}. ${amountPoint.caveat ?? "Confirm against the original document."} Source: ${source}.`;
  }

  if (/next|ask|question|call|follow/.test(lower)) {
    const questions = analysis.questions.length
      ? analysis.questions
      : analysis.nextActions.map((action) => `What should I do about: ${action}?`);
    return [
      "Here is a focused question list for your clinician:",
      ...questions.slice(0, 5).map((question, index) => `${index + 1}. ${question.replace(/\?*$/, "?")} Reason: this connects the report wording to your symptoms, exam, and next steps.`),
      `Source: ${source}. ${analysis.safetyNote}`,
    ].join("\n");
  }

  return `From the saved analysis: ${mainPoint} Source: ${matchingPoint.sourceAnchor}.`;
}

function formatPoint(point: { label: string; detail: string }) {
  const detail = point.detail.replace(/\s+/g, " ").replace(/\.+$/, ".");
  return `${point.label} - ${detail}`;
}

function extractPhoneNumber(value: string) {
  const match = value.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
  return match?.[0].replace(/\s+/g, " ").trim() ?? null;
}

function hasSchedulingTime(value: string) {
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midday|appointment|before|after|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,3}\s*(?:minutes?|mins?)\s+before|[01]?\d(?::[0-5]\d)?\s*(?:am|pm)|[01]?\d:[0-5]\d|2[0-3]:[0-5]\d)\b/i.test(value);
}
