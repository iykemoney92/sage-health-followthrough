import Anthropic from "@anthropic-ai/sdk";
import { anthropicGenerationFields, buildAgentContext } from "@/lib/agent/persona-config";
import {
  inferJourneyDraft,
  isPlanCategory,
  JOURNEY_NAMING_GUIDANCE,
  normalizeJourneyTitle,
  type JourneyDraftFields,
} from "@/lib/domain/journey-naming";

export type PlanDraft = JourneyDraftFields;

/**
 * Agent-authors a Care plan draft from free-text intake + optional attachment notes.
 * Used by onboarding and the in-app “start a Care plan” flow.
 */
export async function draftPlanFromIntake(
  intake: string,
  attachmentNotes: string[] = [],
): Promise<PlanDraft> {
  const inferred = inferJourneyDraft(intake, attachmentNotes);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return inferred;

  const attachmentBlock =
    attachmentNotes.length > 0
      ? "\n\nAttached materials Nura should organise with this:\n" +
        attachmentNotes.map((note) => `- ${note}`).join("\n")
      : "";

  try {
    const client = new Anthropic({ apiKey });
    const agentContext = buildAgentContext({
      primaryCategory: inferred.category,
      surface: "text",
    });
    const message = await client.messages.create({
      ...anthropicGenerationFields({ ...agentContext.textParams, maxTokens: 300 }),
      system:
        "You turn free text and optional attached notes/summaries/prescription info from a Nura user into the start of a health Care plan. " +
        "Nura organises messy life/health context into small, manageable care plans and follows up over time. " +
        "If attachments are mentioned, fold their themes into the Care plan without inventing clinical details that weren't provided. " +
        (agentContext.systemExtras ? agentContext.systemExtras + " " : "") +
        JOURNEY_NAMING_GUIDANCE +
        " " +
        "Respond with ONLY a JSON object, no markdown fences, no extra text, matching exactly: " +
        '{"title": string, "category": string, "why_this_exists": string, "current_focus": string, "next_step": string}. ' +
        "Never diagnose, prescribe, or give medical advice - just organise what the user shared.",
      messages: [
        {
          role: "user",
          content: `${intake.trim() || "The user shared attachments about their health follow-through."}${attachmentBlock}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return inferred;

    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed.title || !parsed.why_this_exists || !parsed.current_focus || !parsed.next_step) {
      return inferred;
    }
    return {
      title: normalizeJourneyTitle(String(parsed.title), inferred.title),
      category: isPlanCategory(parsed.category) ? parsed.category : inferred.category,
      why_this_exists: String(parsed.why_this_exists),
      current_focus: String(parsed.current_focus),
      next_step: String(parsed.next_step),
    };
  } catch {
    return inferred;
  }
}
