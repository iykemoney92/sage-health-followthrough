import Anthropic from "@anthropic-ai/sdk";
import type { PlanForJourney } from "@/lib/domain/plan-journey";
import {
  journeyCreateCheckInSchema,
  journeyCreatePlanFieldsSchema,
  type JourneyCreateCheckIn,
  type JourneyCreatePlanFields,
} from "@/lib/schemas/nura";

export type { JourneyCreateCheckIn, JourneyCreatePlanFields };

export type JourneyCreatePayload = JourneyCreatePlanFields & {
  nextCheckIn?: JourneyCreateCheckIn | null;
};

/** Soft fallback when Claude cannot reason a time — not a product default. */
export function fallbackNextCheckIn(
  channel: "whatsapp" | "in_app" | "voice",
  prompt: string,
  daysAhead = 2,
): JourneyCreateCheckIn {
  const when = new Date();
  when.setDate(when.getDate() + daysAhead);
  // Mild evening window; varies slightly so it doesn't look like a fixed product rule.
  when.setHours(18 + (daysAhead % 2), 15 + ((daysAhead * 7) % 30), 0, 0);
  return {
    when: when.toISOString(),
    prompt,
    channel,
  };
}

export function parseJourneyCreatePlanFields(
  raw: unknown,
  fallback: JourneyCreatePlanFields,
): JourneyCreatePlanFields {
  const parsed = journeyCreatePlanFieldsSchema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

export function parseJourneyCreateCheckIn(
  raw: unknown,
  allowedChannels: Array<"whatsapp" | "in_app" | "voice">,
  fallback: JourneyCreateCheckIn,
): JourneyCreateCheckIn {
  const parsed = journeyCreateCheckInSchema.safeParse(raw);
  if (!parsed.success) return fallback;
  const channel = allowedChannels.includes(parsed.data.channel)
    ? parsed.data.channel
    : (allowedChannels[0] ?? fallback.channel);
  const when = new Date(parsed.data.when);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    return { ...fallback, channel, prompt: parsed.data.prompt || fallback.prompt };
  }
  return { ...parsed.data, channel, when: when.toISOString() };
}

/**
 * Ask Claude for the next proactive check-in after a completed one,
 * constrained to the user's allowed channels.
 */
export async function draftNextCheckInAfterCompletion(input: {
  plan: Pick<PlanForJourney, "title" | "current_focus" | "next_step">;
  mood: string;
  note: string;
  allowedChannels: Array<"whatsapp" | "in_app" | "voice">;
  preferredChannel: "whatsapp" | "in_app" | "voice";
}): Promise<JourneyCreateCheckIn> {
  const fallback = fallbackNextCheckIn(
    input.preferredChannel,
    `How have things been with ${input.plan.title} since your last check-in?`,
    3,
  );
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const nowIso = new Date().toISOString();
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 220,
      system:
        "You help Nura, a warm AI health companion, schedule the NEXT proactive check-in after a user completes one. " +
        "Reason a sensible cadence from the Care plan and what they just reported — not a fixed 'in 3 days' rule. " +
        "Respond with ONLY a JSON object, no markdown: " +
        '{"when": ISO8601 datetime, "prompt": string, "channel": "whatsapp"|"in_app"|"voice"}. ' +
        `Channel must be one of: ${input.allowedChannels.join(", ")}. Prefer "${input.preferredChannel}" (calls over WhatsApp when both are allowed) unless the user's report clearly points elsewhere. ` +
        `Current time is ${nowIso}. when must be in the future. Never diagnose or prescribe.`,
      messages: [
        {
          role: "user",
          content:
            `Care plan: "${input.plan.title}". Focus: "${input.plan.current_focus}". Next step line: "${input.plan.next_step}". ` +
            `They just reported feeling "${input.mood}"` +
            (input.note ? ` and added: "${input.note}"` : "") +
            ". Propose the next check-in.",
        },
      ],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    return parseJourneyCreateCheckIn(JSON.parse(cleaned), input.allowedChannels, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Ask Claude for the first check-in when creating a Care plan from onboarding intake.
 */
export async function draftFirstCheckInFromIntake(input: {
  plan: JourneyCreatePlanFields;
  intake: string;
  allowedChannels: Array<"whatsapp" | "in_app" | "voice">;
  preferredChannel: "whatsapp" | "in_app" | "voice";
}): Promise<JourneyCreateCheckIn> {
  const fallback = fallbackNextCheckIn(
    input.preferredChannel,
    `How are things going with ${input.plan.title} — anything Nura should update?`,
    2,
  );
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const nowIso = new Date().toISOString();
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 220,
      system:
        "You help Nura schedule the FIRST proactive check-in for a brand-new Care plan built from onboarding. " +
        "Choose timing from what they shared (e.g. meds timing, sleep pattern, clinic follow-up window) — not a fixed tomorrow evening. " +
        "Respond with ONLY a JSON object, no markdown: " +
        '{"when": ISO8601 datetime, "prompt": string, "channel": "whatsapp"|"in_app"|"voice"}. ' +
        `Channel must be one of: ${input.allowedChannels.join(", ")}. Prefer "${input.preferredChannel}" (calls over WhatsApp when both are allowed). ` +
        `Current time is ${nowIso}. when must be in the future. Never diagnose or prescribe.`,
      messages: [
        {
          role: "user",
          content:
            `Care plan title: "${input.plan.title}". Why: "${input.plan.whyThisExists}". Focus: "${input.plan.currentFocus}". ` +
            `Next step: "${input.plan.nextStep}". Intake:\n${input.intake.trim() || "(attachments / light intake)"}`,
        },
      ],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    return parseJourneyCreateCheckIn(JSON.parse(cleaned), input.allowedChannels, fallback);
  } catch {
    return fallback;
  }
}

export function formatCheckInWhenForCopy(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "soon";
  }
}
