import { claudeClient } from "@/lib/ai/claude";
import type { CrisisKind } from "@/lib/domain/crisis-lines";
import { anthropicGenerationFields, buildAgentContext } from "@/lib/agent/persona-config";
import {
  inferJourneyDraft,
  isPlanCategory,
  JOURNEY_NAMING_GUIDANCE,
  normalizeJourneyTitle,
  type JourneyDraftFields,
} from "@/lib/domain/journey-naming";

/**
 * `safety` is set when the model sees suicidal thoughts, self-harm, stockpiling tablets
 * ("suicide") or a medical emergency ("emergency") in the text. Try-first shows crisis numbers
 * instead of a plan when it is set; the deterministic screen in crisis-lines.ts runs first.
 */
export type PlanDraft = JourneyDraftFields & { safety?: CrisisKind };

const SAFETY_RULE =
  "Safety first: if the text mentions suicide, wanting to die or not wanting to be here, self-harm, an overdose, or saving up or stockpiling tablets, add \"safety\": \"suicide\". " +
  "If it describes a medical emergency happening now (chest pain or pressure, signs of a stroke such as a drooping face, arm weakness or slurred speech, can't breathe, a fall with a head injury or can't get up, someone unconscious), add \"safety\": \"emergency\". " +
  "Never turn a crisis or an emergency into a routine plan or a later check-in. Otherwise leave \"safety\" out. ";

function parseSafety(value: unknown): CrisisKind | undefined {
  return value === "suicide" || value === "emergency" ? value : undefined;
}

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
    const client = claudeClient("draft-plan-from-intake");
    const agentContext = buildAgentContext({
      primaryCategory: inferred.category,
      surface: "text",
    });
    const message = await client.messages.create({
      ...anthropicGenerationFields({ ...agentContext.textParams, maxTokens: 300 }),
      system:
        "You turn free text and optional attached notes from a Nura user into the start of a Care plan. " +
        "Nura is an AI wellbeing companion: it checks in on the person (or someone they look out for) about how they're doing, their routines and habits, and what matters to them, and follows up over time with small, manageable steps. " +
        "Write the plan as a friend who checks in would, about everyday life: sleep, stress, energy, routines, people, the small step they want to keep. " +
        "Don't frame it as a clinic or medical follow-up, and never ask them to describe or track symptoms or concerns; if what they shared is vague, keep the plan about how they're doing day to day and what matters to them. " +
        "If attachments are mentioned, fold their themes into the Care plan without inventing details that weren't provided. " +
        (agentContext.systemExtras ? agentContext.systemExtras + " " : "") +
        JOURNEY_NAMING_GUIDANCE +
        " " +
        SAFETY_RULE +
        "Respond with ONLY a JSON object, no markdown fences, no extra text, matching exactly: " +
        '{"title": string, "category": string, "why_this_exists": string, "current_focus": string, "next_step": string, "safety"?: "suicide" | "emergency"}. ' +
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
    const safety = parseSafety(parsed.safety);
    if (safety) return { ...inferred, safety };
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
