import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getRecentClaritiAnalyses, hasCompareIntent, type ClaritiHistoryEntry } from "@/lib/domain/clariti-history";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1),
  analysis: claritiAnalysisSchema,
  followUpDraft: z.object({
    action: z.string().optional(),
    email: z.string().optional(),
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

  let compareEntries: ClaritiHistoryEntry[] = [];
  if (hasCompareIntent(content)) {
    compareEntries = await getRecentClaritiAnalyses(supabase, user.id, {
      kinds: [analysis.kind],
      excludeSessionId: sessionId,
      limit: 3,
    });
    if (compareEntries.length > 0) {
      const plusResponse = await requirePlusAccess(supabase, user.id, "compare");
      if (plusResponse) return plusResponse;
    }
  }

  const assistantContent = await generateGroundedFollowUp(content, analysis, recoveredDraft, compareEntries);
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
  const hasSchedulingIntent = /follow-up|follow up|check[- ]?in|email me|schedule|appointment|reminder|preferred day|preferred time|what day and time|what time works/i.test(threadText);
  if (!explicitDraft && !hasSchedulingIntent) return undefined;

  return {
    action: explicitDraft?.action ?? analysis.nextActions[0] ?? "review this document with the right professional",
    email: explicitDraft?.email ?? extractEmailAddress(threadText) ?? undefined,
    timingText: explicitDraft?.timingText ?? (hasSchedulingTime(threadText) ? threadText : undefined),
  };
}

function buildCompareContext(compareEntries: ClaritiHistoryEntry[]) {
  if (compareEntries.length === 0) return "No earlier saved documents of the same kind were found to compare against.";
  return compareEntries
    .map((entry, index) => {
      const metrics = entry.metrics.slice(0, 6).map((metric) => `${metric.label}: ${metric.value}`).join("; ");
      const points = entry.keyPoints.slice(0, 4).map((point) => `${point.label} - ${point.detail}`).join(" | ");
      const savedOn = new Date(entry.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
      return `Earlier document ${index + 1} (saved ${savedOn}), "${entry.title}": ${entry.summary} Metrics: ${metrics || "none saved"}. Key points: ${points || "none saved"}.`;
    })
    .join("\n");
}

async function generateGroundedFollowUp(
  question: string,
  analysis: z.infer<typeof claritiAnalysisSchema>,
  followUpDraft?: FollowUpDraft,
  compareEntries: ClaritiHistoryEntry[] = [],
) {
  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) return buildGroundedFollowUp(question, analysis, followUpDraft, compareEntries);

  const draftContext = followUpDraft
    ? [
      followUpDraft.action ? `Follow-up purpose already in progress: ${followUpDraft.action}.` : "",
      followUpDraft.email ? `Known email already captured: ${followUpDraft.email}. Do not ask for the email again.` : "",
      followUpDraft.timingText ? `Known timing context already captured: ${followUpDraft.timingText}. Do not ask for timing again unless it is ambiguous.` : "",
    ].filter(Boolean).join(" ")
    : "No follow-up scheduling draft is active.";

  try {
    const result = await generateText({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      temperature: 0.2,
      maxOutputTokens: 260,
      system:
        "You are Clariti, a warm helper who explains confusing health paperwork in everyday language. Answer conversationally, but only from the saved analysis and, if provided, the saved earlier documents. " +
        "Sound human and simple — not technical. Prefer short words. If you must use a medical or billing term, explain it in plain English. " +
        "Do not diagnose, prescribe, make final coverage/payment decisions, or invent document findings, numbers, or dates that are not in the saved data. " +
        "Keep replies concise: usually 1-4 short sentences, longer only for lists the user asked for, and under 130 words. " +
        "Phone calls are disabled. If the user asks for a follow-up or check-in, schedule an email check-in only. Ask only for missing fields: preferred day/time (and email only if not already known). Never invent or suggest a default date/time. " +
        "If the user provides timing, acknowledge briefly that the email check-in can be scheduled. " +
        "Clarify that Clariti will email to ask whether anything changed or if they need further analysis. " +
        "If the user asks for a clinician/doctor question list, create a short prioritized list grounded in saved source anchors. " +
        "COMPARE REQUESTS: if earlier saved documents are supplied below, compare the current saved analysis against them using only their stored metrics/key points. " +
        "Name what changed (numbers, status, findings) in plain words, note anything that looks better, worse, or unclear, and always end with a line telling the user to confirm the change with their clinician or billing office — never diagnose why a value changed. " +
        "If no earlier documents are supplied but the user asked to compare, say Clariti could not find an earlier saved document of that kind to compare against. " +
        "CREATIVE BUT GROUNDED HELPERS you can produce when asked, always sourced from the saved analysis/comparison and never invented: " +
        "(1) a short prioritized visit question list, (2) a calm, factual draft message the user could send to their insurer or billing office, " +
        "(3) a plain-language glossary of 3-6 terms that appear in the saved analysis, (4) a short numbered timeline of what to do next in order, " +
        "(5) a note flagging any contradiction between the current and an earlier saved document (e.g. two different amounts owed) so the user can ask about it. " +
        "Include one short Source phrase when useful. " +
        "Write plain text only: no markdown, emoji, bold markers, or headings. Numbered lists are allowed only when the user asked for a list, timeline, or questions.",
      prompt:
        `User message: ${question}\n\n` +
        `Follow-up draft state: ${draftContext}\n\n` +
        `Saved analysis JSON:\n${JSON.stringify(analysis).slice(0, 9000)}\n\n` +
        `Earlier saved documents for comparison (only used if the user asked to compare):\n${buildCompareContext(compareEntries)}\n\n` +
        "Write the next Clariti reply. Be specific to this user message. Do not add scheduling details the user did not provide.",
    });
    return cleanAssistantReply(result.text) || buildGroundedFollowUp(question, analysis, followUpDraft, compareEntries);
  } catch {
    return buildGroundedFollowUp(question, analysis, followUpDraft, compareEntries);
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

function buildGroundedFollowUp(
  question: string,
  analysis: z.infer<typeof claritiAnalysisSchema>,
  followUpDraft?: FollowUpDraft,
  compareEntries: ClaritiHistoryEntry[] = [],
) {
  const lower = question.toLowerCase();
  const source = analysis.sourceAnchors[0] ?? "the saved document analysis";
  const amountPoint = analysis.metrics.find((metric) => /\$|£|amount|paid|due|responsibility|billed/i.test(`${metric.label} ${metric.value}`));
  const matchingPoint = analysis.keyPoints.find((point) => lower.includes(point.label.toLowerCase().split(" ")[0])) ?? analysis.keyPoints[0];
  const mainPoint = formatPoint(matchingPoint);
  const email = extractEmailAddress(question) ?? followUpDraft?.email;
  const timingText = `${followUpDraft?.timingText ?? ""} ${question}`.trim();
  const hasTime = hasSchedulingTime(timingText);

  if (hasCompareIntent(question)) {
    if (compareEntries.length === 0) {
      return `I could not find an earlier saved ${analysis.kind.replaceAll("_", " ")} document to compare this against. Save another one and ask again.`;
    }
    return buildFallbackComparison(analysis, compareEntries);
  }

  if (/schedule|follow-up|follow up|check[- ]?in|email me|reminder|set.*time/.test(lower)) {
    const action = analysis.nextActions[0] ?? "review this document with the relevant clinician or provider";
    if (hasTime) return `Got it. I can schedule an email check-in for that time about: ${action}. Clariti will ask if anything changed or if you need further analysis.`;
    return `Yes. I can set an email check-in for ${action}. What day and time should Clariti email you? Source: ${matchingPoint.sourceAnchor}.`;
  }

  if (email && !hasTime) {
    return "Got the email. What day and time should Clariti use for the check-in?";
  }

  if (email && hasTime) {
    return "Got it. I have the email and timing, so I can save the check-in now.";
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

function buildFallbackComparison(analysis: z.infer<typeof claritiAnalysisSchema>, compareEntries: ClaritiHistoryEntry[]) {
  const earlier = compareEntries[0];
  const savedOn = new Date(earlier.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const lines = [`Comparing this to your saved "${earlier.title}" from ${savedOn}:`];

  const matchedMetrics = analysis.metrics
    .map((metric) => ({ metric, prior: earlier.metrics.find((entry) => entry.label.toLowerCase() === metric.label.toLowerCase()) }))
    .filter((pair): pair is { metric: typeof pair.metric; prior: NonNullable<typeof pair.prior> } => Boolean(pair.prior));

  if (matchedMetrics.length > 0) {
    for (const { metric, prior } of matchedMetrics.slice(0, 4)) {
      lines.push(prior.value === metric.value
        ? `${metric.label} is unchanged: still ${metric.value}.`
        : `${metric.label} changed from ${prior.value} to ${metric.value}.`);
    }
  } else {
    lines.push(`Earlier summary: ${earlier.summary}`, `Latest summary: ${analysis.summary}`);
  }

  lines.push("Ask your clinician or billing office to confirm what this change means before acting on it.");
  return lines.join(" ");
}

function formatPoint(point: { label: string; detail: string }) {
  const detail = point.detail.replace(/\s+/g, " ").replace(/\.+$/, ".");
  return `${point.label} - ${detail}`;
}

function extractEmailAddress(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0].trim().toLowerCase() ?? null;
}

function hasSchedulingTime(value: string) {
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midday|appointment|before|after|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,3}\s*(?:minutes?|mins?)\s+before|[01]?\d(?::[0-5]\d)?\s*(?:am|pm)|[01]?\d:[0-5]\d|2[0-3]:[0-5]\d)\b/i.test(value);
}
