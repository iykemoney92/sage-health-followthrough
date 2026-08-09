import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropicGenerationFields, buildAgentContext } from "@/lib/agent/persona-config";
import {
  inferJourneyDraft,
  isPlanCategory,
  isUsefulDisplayText,
  JOURNEY_NAMING_GUIDANCE,
  normalizeJourneyTitle,
  type PlanCategory,
} from "@/lib/domain/journey-naming";
import { NURA_CORE_IDENTITY, NURA_SAFETY_BOUNDARIES, NURA_TONE } from "@/lib/domain/nura-persona";
import { primaryCheckinChannel } from "@/lib/domain/checkin-channel";
import {
  DEFAULT_TIME_ZONE,
  describeNowForTimeZone,
  normalizeTimeZone,
  wallTimeInTimeZoneToUtcIso,
} from "@/lib/timezone";

export type CheckInRecurrence = "none" | "daily" | "weekdays" | "weekly";

export type NextCheckIn = {
  when: string;
  prompt: string;
  channel: "voice" | "whatsapp" | "in_app";
  recurrence?: CheckInRecurrence;
};

export type NewPlanDraft = {
  title: string;
  category: PlanCategory;
  why_this_exists: string;
  current_focus: string;
  next_step: string;
};

export type NuraDecision = {
  reply: string;
  action: "existing_plan" | "new_plan" | "none";
  plan_id: string | null;
  new_plan: NewPlanDraft | null;
  next_check_in: NextCheckIn | null;
};

export type PlanSummary = { id: string; title: string; current_focus: string | null; category?: string | null };
export type PlanContext = { plan_id: string; title: string; summary: string; kind: string };
export type MissedCheckIn = { plan_title: string; prompt: string; scheduled_for: string; reason: string };
export type MessageAttachment = { name: string; type: string; kind: "image" | "audio" | "document" | "file"; text?: string; base64?: string };
export type HistoryTurn = { role: "user" | "assistant"; content: string };

const PHONE_PATTERN = /(\+?\d[\d\s\-().]{6,}\d)/;

export function extractPhoneNumber(text: string): string | null {
  const match = text.match(PHONE_PATTERN);
  if (!match) return null;
  const digits = match[1].replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

const FALLBACK_REPLY =
  "I'm here with you — tell me a bit more about how you're doing, and we can take it from there.";

function conversationalFallbackReply(content: string): string {
  const text = content.trim().toLowerCase();
  if (/is that (it|all)|that'?s it\??|nothing else|are we done/.test(text)) {
    return "Not if you don't want it to be — I'm happy to keep talking. What feels worth going into?";
  }
  if (/open to discuss|talk (more|further)|can we (talk|chat)|want to talk|listen/.test(text)) {
    return "Yes — I'm here for the conversation, not just to file things away. What's on your mind?";
  }
  if (/don'?t (feel|have).{0,24}pain|no pain|pain.?free|feeling (ok|fine|better)/.test(text)) {
    return "That's really good to hear. How has the rest of you been feeling alongside that?";
  }
  if (text.length < 40 && /\?$/.test(text)) {
    return "Of course — I'm here. Tell me a little more and I'll stay with you on it.";
  }
  return FALLBACK_REPLY;
}

function fallbackNewPlan(content = ""): NuraDecision {
  const draft = inferJourneyDraft(content);
  const when = new Date();
  when.setDate(when.getDate() + 2);
  when.setHours(10, 0, 0, 0);
  return {
    reply: conversationalFallbackReply(content),
    action: "new_plan",
    plan_id: null,
    new_plan: draft,
    next_check_in: {
      when: when.toISOString(),
      prompt: `How have things been with ${draft.title}?`,
      channel: "in_app",
      recurrence: "none",
    },
  };
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 45000) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[resolveDecision] timed out after ${ms}ms — using conversational fallback`);
        resolve(fallback);
      }, ms),
    ),
  ]);
}

function attachmentContext(attachments: MessageAttachment[]) {
  if (attachments.length === 0) return "";
  return attachments
    .map((file) => `- ${file.kind}: ${file.name} (${file.type})${file.text ? `\n  Extracted/shared text: ${file.text.slice(0, 1200)}` : ""}`)
    .join("\n");
}

function ragContext(contexts: PlanContext[]) {
  if (contexts.length === 0) return "";
  return contexts.map((context) => `- Care plan ${context.plan_id} / ${context.title} / ${context.kind}: ${context.summary}`).join("\n");
}

function missedCheckInContext(missed: MissedCheckIn[]) {
  if (missed.length === 0) return "";
  return missed.map((m) => `- ${m.plan_title}: was going to ask "${m.prompt}", scheduled for ${m.scheduled_for}, but didn't reach the user (${m.reason}).`).join("\n");
}

// Picks the best channel for a proactive check-in given what the user currently allows.
// Voice/call is preferred when allowed; WhatsApp and in-app are fallbacks. Do not default to
// WhatsApp just because the current conversation is on WhatsApp.
function pickDefaultChannel(allowed: NextCheckIn["channel"][]): NextCheckIn["channel"] {
  return primaryCheckinChannel(allowed);
}

function isValidNextCheckIn(value: unknown): value is NextCheckIn {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.when !== "string" || typeof candidate.prompt !== "string") return false;
  const when = new Date(candidate.when);
  if (Number.isNaN(when.getTime())) return false;
  if (candidate.recurrence !== undefined && !["none", "daily", "weekdays", "weekly"].includes(candidate.recurrence as string)) return false;
  return candidate.channel === "voice" || candidate.channel === "whatsapp" || candidate.channel === "in_app" || candidate.channel === undefined;
}

async function classifyWithClaude(
  content: string,
  plans: PlanSummary[],
  attachments: MessageAttachment[],
  contexts: PlanContext[],
  history: HistoryTurn[],
  phoneOnFile: string | null,
  missed: MissedCheckIn[] = [],
  attachmentBlocks: Anthropic.ContentBlockParam[] = [],
  sourceChannel: "whatsapp" | "in_app" = "in_app",
  allowedChannels: NextCheckIn["channel"][] = ["voice", "whatsapp", "in_app"],
  requestedPlan: PlanSummary | null = null,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<NuraDecision> {
  const hasPhoneOnFile = Boolean(phoneOnFile);
  // A channel can be allowed by preference but still unusable right now (voice with no phone
  // on file) - in_app always works, so it's kept as the one guaranteed fallback.
  const safeAllowedChannels = (hasPhoneOnFile ? allowedChannels : allowedChannels.filter((c) => c !== "voice"));
  const effectiveAllowedChannels = safeAllowedChannels.length > 0 ? safeAllowedChannels : (["in_app"] as NextCheckIn["channel"][]);
  const defaultCheckInChannel = pickDefaultChannel(effectiveAllowedChannels);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback: NuraDecision = plans.length > 0
    ? { reply: conversationalFallbackReply(content), action: "existing_plan", plan_id: plans[0].id, new_plan: null, next_check_in: null }
    : fallbackNewPlan(content);
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const tz = normalizeTimeZone(timeZone);
    const nowInfo = describeNowForTimeZone(tz);
    const inferredCategory = inferJourneyDraft(content).category;
    const agentContext = buildAgentContext({
      primaryCategory: inferredCategory,
      extraCategories: plans.map((plan) => plan.category),
      surface: "text",
    });
    const message = await client.messages.create({
      ...anthropicGenerationFields(agentContext.textParams),
      system:
        NURA_CORE_IDENTITY + " " +
        "What you do is closer to a caring conversation than a triage form - you listen, respond to what they actually said, ask thoughtful follow-up questions when useful, and only then help organise what they're dealing with into a 'Care plan' (also called a Plan) that you help them stay on top of over time. " +
        "\n\n" + NURA_TONE + " " +
        (agentContext.systemExtras ? "\n\n" + agentContext.systemExtras + "\n\n" : "\n\n") +
        "PRIORITY ORDER for every reply: (1) respond humanly to the latest message, (2) invite or continue conversation when they want it, (3) quietly keep Care plan/check-in context if it helps. Never reverse that order. " +
        "If they push back on feeling closed-off, rushed, or 'filed away', apologise briefly, reopen the conversation, and use action \"none\" or stay on the current Care plan without wrap-up language. " +
        "Be genuinely curious before you file something away. If a message is thin on detail, ask ONE warm, specific follow-up question instead of immediately deciding what Care plan it belongs to - e.g. someone mentioning work stress deserves something like 'how long has this been building?' or 'is it affecting your sleep?' before you organise it. It is completely fine to have a few exchanges like this - use action \"none\" and leave plan/new_plan/next_check_in null while you're still gathering context. Only commit to a Care plan once you understand the shape of what's actually going on. " +
        (requestedPlan
          ? `\n\nThe user is already inside the "${requestedPlan.title}" Care plan's own conversation view - this message belongs there, so set action to "existing_plan" and plan_id to "${requestedPlan.id}". Respond as a caring companion in an ongoing chat: react to what they said, ask a genuine follow-up when it fits, and do NOT default to "I've organised this / I'll check in" closers. Only mention the Care plan or a check-in when they ask about follow-up or something clearly changed. `
          : "\n\nOnce you do understand it, decide whether this belongs to one of the user's existing Care plans (by id), should start a brand new Care plan, or still needs no Care plan yet (small talk, or you're still asking questions). ") +
        "\n\n" + JOURNEY_NAMING_GUIDANCE + " " +
        "\n\nWhen you create a NEW Care plan (action = new_plan), that Care plan should almost always come with a follow-up — but do NOT silently lock in a time and channel. After responding as a person, ask (in the same reply, briefly) when would be a good time to check in, and whether they'd rather a phone call or a WhatsApp text — only offer modes from their allowed list below. While you're waiting for that answer, leave has_next_check_in false (create/attach the Care plan if ready, but don't schedule yet). Once they answer, honour their time and mode exactly and set next_check_in. If they already stated a time and/or mode in this thread, schedule immediately without re-asking. " +
        "\n\nWhen you attach to an EXISTING Care plan instead, only set a fresh next_check_in if something actually changed enough to warrant re-scheduling (new detail, explicit request, or the situation clearly shifted) - otherwise leave it null and let the existing schedule stand. Something the user explicitly asked about ('call me in 5 minutes', 'check in next Tuesday', 'move my check-in to Friday', 'reschedule to 3pm', 'check in on me from time to time') must always be honoured, overriding any existing schedule for that Care plan. If you're proposing a new follow-up time for an existing Care plan and they haven't said when or how, ask those two things first and leave has_next_check_in false until they answer. " +
        `\n\nTIMEZONE (critical): The user's timezone is ${tz}. Right now it is ${nowInfo.localLabel} there (UTC ${nowInfo.utcIso}). When the user says a clock time like "12:30pm", "tomorrow at 9", or "Thursday evening", interpret it in THEIR timezone (${tz}), NOT server UTC. Set next_check_in.when as ISO 8601 that includes their offset (e.g. 2026-08-07T12:30:00+01:00) or the correct equivalent instant — never treat their local wall clock as UTC/Z. Confirm times back to them in local terms (e.g. "12:30pm your time"). ` +
        "\n\nIMPORTANT - recurring vs one-off: next_check_in only ever represents a SINGLE point in time by itself, so if the user asks for an ONGOING or REPEATING pattern you MUST also set next_check_in.recurrence, not just pick one date. Phrases like 'check in on me daily', 'remind me every day to take my meds', 'check in each morning', 'check in on weekdays', or 'check in with me weekly' describe a repeating cadence - set recurrence to \"daily\", \"weekdays\", or \"weekly\" accordingly, and set next_check_in.when to the FIRST occurrence only (pick a sensible time of day for the purpose - e.g. morning for a medication reminder - unless the user specifies a time). The system will automatically lay down the full recurring series from that first occurrence; you never need to schedule each one yourself. For a normal single follow-up (the common case), leave recurrence as \"none\". Setting up a recurring reminder REPLACES any previous schedule for that Care plan, so say clearly in your reply what the new pattern is (e.g. 'I'll check in with you every morning at 9am about your medication') rather than only confirming a single date. " +
        "\n\nNura CAN place a real proactive phone check-in call (voice), or follow up on WhatsApp or in-app - never say you are unable to call or check in. " +
        `\n\nThe user has allowed Nura to proactively check in via: ${effectiveAllowedChannels.join(", ")}. next_check_in.channel must always be one of these - never propose a channel they haven't allowed, even if it would otherwise fit. If the user asks for a channel they haven't enabled (e.g. asks you to call when voice isn't in that list), gently say in your reply that you can't call them yet and they can turn calls on in Settings, then schedule the follow-up on the closest allowed channel instead. ` +
        `\n\nThis conversation is happening over ${sourceChannel === "whatsapp" ? "WhatsApp" : "the in-app chat"}. When you DO schedule a next_check_in and the user did not pick a mode, default its channel to "${defaultCheckInChannel}" (calls preferred when allowed). Do NOT default to WhatsApp just because this chat is on WhatsApp — only use WhatsApp when they ask for a text, voice isn't allowed, or call isn't possible. Honour an explicit preference (call / WhatsApp / in-app) within their allowed channels. ` +
        "\n\n" + (hasPhoneOnFile
          ? `The user's phone number on file is +${phoneOnFile}. When you confirm a voice check-in call, briefly state that exact number (e.g. "I'll call you on +${phoneOnFile}") so they can correct it if it's wrong - don't just silently assume it's still right without saying it.`
          : "The user does NOT have a phone number on file yet. If you're about to promise or schedule a phone check-in call, you must ask for their number in your reply first instead of just confirming a call - something like 'What's the best number to reach you on?' Do not set next_check_in with channel \"voice\" until a number has actually been given (in this message or an earlier one in the history). If they just gave a number in this message, thank them and it will be saved automatically. Until you have a number, prefer scheduling the follow-up on whatsapp or in_app instead of promising a call.") +
        "\n\nThe user can share documents, photos or voice notes as supporting context at any point - treat those as part of the conversation, not a separate step, and factor anything extracted from them into your understanding. " +
        "If the user shares clinician instructions, store and reflect them as user- or clinician-provided context, but ask the user to confirm before treating them as reminders. " +
        "\n\n" + NURA_SAFETY_BOUNDARIES + " " +
        (missed.length > 0
          ? "\n\nThe following scheduled check-ins were missed (Nura tried to reach the user and couldn't):\n" + missedCheckInContext(missed) +
            "\nIf this is early in the conversation or the topic comes up, gently mention it once - acknowledge you tried to reach them, and ask if they'd like to reschedule that specific check-in or just leave it. If they want to reschedule, treat it exactly like a normal follow-up request for that Care plan (existing_plan + next_check_in). If they say to drop it, acknowledge warmly and leave next_check_in null for that Care plan - don't bring it up again this conversation."
          : "") +
        "\n\nHere are the user's existing Care plans as JSON: " +
        JSON.stringify(plans) +
        (contexts.length > 0
          ? ". Recent Care plan-linked memory/RAG context:\n" + ragContext(contexts)
          : "") +
        (attachments.length > 0
          ? ". The user also shared these media/attachment contexts:\n" + attachmentContext(attachments)
          : "") +
        "\n\nThe conversation history below is provided for context - do not repeat questions the user already answered in it, and build on what you already know instead of starting over. " +
        "Never reuse a previous assistant reply almost word-for-word. If the last assistant message was a wrap-up and the user is still engaging, change gear into open conversation. " +
        "Lines are tagged with [Care plan Title] when they belong to a specific Care plan; untagged lines are general conversation not yet tied to one. Only continue or reference a tagged Care plan if it's the same one currently being discussed. Do not proactively bring up, offer to resume, or remind the user about a pending check-in, open question, or unfinished item from a DIFFERENT, unrelated Care plan just because it appears in the history - stay on the topic actually being discussed unless the user brings the other thing up themselves. " +
        "\n\nAlways call the decide tool exactly once with your decision - never reply in plain text.",
      tools: [
        {
          name: "decide",
          description: "Record Nura's decision about how to respond to the user's latest message: what to say, whether it belongs to a Care plan, and whether to schedule a follow-up.",
          input_schema: {
            type: "object",
            properties: {
              reply: {
                type: "string",
                description:
                  "1-5 warm, human sentences that respond to what the user just said. Prefer conversation over filing language. Invite more talk when they seem open to it. Never use a stock 'I've organised this into a Care plan' closer.",
              },
              action: {
                type: "string",
                enum: ["existing_plan", "new_plan", "none"],
                description: "\"none\" while still gathering context (small talk, or asking a follow-up question) - do not create or attach a Care plan yet.",
              },
              plan_id: {
                type: "string",
                description: "An id from the provided existing Care plans list. Required (non-empty) only when action is existing_plan; otherwise pass an empty string.",
              },
              new_plan: {
                type: "object",
                description: "Required when action is new_plan; otherwise pass all fields as empty strings.",
                properties: {
                  title: {
                    type: "string",
                    description: "3-6 specific words rooted in what the user shared. Never vague titles like Watch and Follow-Up.",
                  },
                  category: {
                    type: "string",
                    enum: [
                      "gp_follow_up",
                      "medication_follow_through",
                      "symptom_monitoring",
                      "mental_wellbeing",
                      "sleep_energy",
                      "recovery_aftercare",
                      "postpartum_aftercare",
                      "occupational_stress",
                      "therapy_follow_through",
                      "caregiver_support",
                      "general_health",
                    ],
                    description: "Best-fit Care plan category for icons, filtering, and persona knowledge packs.",
                  },
                  why_this_exists: { type: "string", description: "One sentence." },
                  current_focus: { type: "string", description: "One short sentence." },
                  next_step: { type: "string", description: "One short sentence describing the plan - what Nura will do and when." },
                },
                required: ["title", "category", "why_this_exists", "current_focus", "next_step"],
              },
              has_next_check_in: {
                type: "boolean",
                description: "True only when you're actually confident a follow-up makes sense right now. Not every message needs one.",
              },
              next_check_in: {
                type: "object",
                description: "Only meaningful when has_next_check_in is true; otherwise pass empty/placeholder values.",
                properties: {
                  when: { type: "string", description: "Real ISO 8601 datetime of the FIRST occurrence, computed relative to the current date/time given above." },
                  prompt: { type: "string", description: "What Nura should specifically ask about at that check-in." },
                  channel: { type: "string", enum: ["voice", "whatsapp", "in_app"] },
                  recurrence: {
                    type: "string",
                    enum: ["none", "daily", "weekdays", "weekly"],
                    description: "\"none\" for a normal single follow-up. Set to \"daily\", \"weekdays\", or \"weekly\" ONLY when the user explicitly asked for a repeating/ongoing check-in pattern (e.g. 'check in on me daily', 'remind me every day', 'check in each weekday', 'weekly check-ins').",
                  },
                },
                required: ["when", "prompt", "channel", "recurrence"],
              },
            },
            required: ["reply", "action", "plan_id", "new_plan", "has_next_check_in", "next_check_in"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "decide" },
      messages: [
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        {
          role: "user" as const,
          content: attachmentBlocks.length > 0 ? [{ type: "text" as const, text: content }, ...attachmentBlocks] : content,
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error("[classifyWithClaude] no tool_use block; stop_reason:", message.stop_reason, JSON.stringify(message.content));
      return fallback;
    }

    const raw = toolUse.input as {
      reply: string;
      action: NuraDecision["action"];
      plan_id: string;
      new_plan: {
        title: string;
        category?: string;
        why_this_exists: string;
        current_focus: string;
        next_step: string;
      };
      has_next_check_in: boolean;
      next_check_in: { when: string; prompt: string; channel: string; recurrence?: string };
    };

    if (!raw.reply || !raw.action) {
      console.error("[classifyWithClaude] missing reply/action; raw:", JSON.stringify(raw));
      return fallback;
    }

    if (raw.has_next_check_in && !isValidNextCheckIn(raw.next_check_in)) {
      console.error(
        "[classifyWithClaude] has_next_check_in=true but failed validation; stop_reason:",
        message.stop_reason,
        "raw.next_check_in:",
        JSON.stringify(raw.next_check_in),
      );
    }
    let nextCheckIn = raw.has_next_check_in && isValidNextCheckIn(raw.next_check_in)
      ? {
          ...raw.next_check_in,
          channel: (raw.next_check_in.channel || defaultCheckInChannel) as NextCheckIn["channel"],
          when: wallTimeInTimeZoneToUtcIso(raw.next_check_in.when, tz),
        }
      : null;

    // Defense in depth: the model is told the allowed set, but clamp server-side too in case
    // it ignores that (or the phone-availability check narrowed things after the call started).
    if (nextCheckIn && !effectiveAllowedChannels.includes(nextCheckIn.channel)) {
      nextCheckIn = { ...nextCheckIn, channel: pickDefaultChannel(effectiveAllowedChannels) };
    }

    let newPlan: NewPlanDraft | null = null;
    if (raw.action === "new_plan" && raw.new_plan?.title) {
      const inferred = inferJourneyDraft(content);
      const focusCandidate = (raw.new_plan.current_focus || "").trim();
      newPlan = {
        title: normalizeJourneyTitle(raw.new_plan.title, inferred.title),
        category: isPlanCategory(raw.new_plan.category) ? raw.new_plan.category : inferred.category,
        why_this_exists: raw.new_plan.why_this_exists || inferred.why_this_exists,
        current_focus: isUsefulDisplayText(focusCandidate, 8) ? focusCandidate : inferred.current_focus,
        next_step: raw.new_plan.next_step || inferred.next_step,
      };
    }

    // requestedPlan means the user is inside that Journey's own conversation view - pin the
    // attachment server-side too, regardless of what the model picked, so it can never drift
    // to a different Journey; everything else (reply, next_check_in) stays the model's real output.
    const parsed: NuraDecision = requestedPlan
      ? { reply: raw.reply, action: "existing_plan", plan_id: requestedPlan.id, new_plan: null, next_check_in: nextCheckIn }
      : {
          reply: raw.reply,
          action: raw.action,
          plan_id: raw.action === "existing_plan" && raw.plan_id ? raw.plan_id : null,
          new_plan: newPlan,
          next_check_in: nextCheckIn,
        };
    return parsed;
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[classifyWithClaude] failed:", detail, err);
    return fallback;
  }
}

export async function resolveDecision(
  content: string,
  plans: PlanSummary[],
  attachments: MessageAttachment[],
  contexts: PlanContext[],
  requestedPlan?: PlanSummary | null,
  history: HistoryTurn[] = [],
  phoneOnFile: string | null = null,
  missed: MissedCheckIn[] = [],
  attachmentBlocks: Anthropic.ContentBlockParam[] = [],
  sourceChannel: "whatsapp" | "in_app" = "in_app",
  allowedChannels: NextCheckIn["channel"][] = ["voice", "whatsapp", "in_app"],
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<NuraDecision> {
  const fallback: NuraDecision = requestedPlan
    ? { reply: conversationalFallbackReply(content), action: "existing_plan", plan_id: requestedPlan.id, new_plan: null, next_check_in: null }
    : plans.length > 0
      ? { reply: conversationalFallbackReply(content), action: "existing_plan", plan_id: plans[0].id, new_plan: null, next_check_in: null }
      : fallbackNewPlan(content);

  return withTimeout(
    classifyWithClaude(
      content,
      plans,
      attachments,
      contexts,
      history,
      phoneOnFile,
      missed,
      attachmentBlocks,
      sourceChannel,
      allowedChannels,
      requestedPlan ?? null,
      timeZone,
    ),
    fallback,
  );
}

export async function applyPlanDecision(
  supabase: SupabaseClient,
  ownerId: string,
  decision: NuraDecision,
  plans: PlanSummary[],
): Promise<{
  planId: string | null;
  planTitle: string | null;
  createdPlan: {
    id: string;
    title: string;
    why_this_exists: string;
    current_focus: string;
    next_step: string;
  } | null;
  error?: string;
}> {
  if (decision.action === "existing_plan" && decision.plan_id && plans.some((p) => p.id === decision.plan_id)) {
    return {
      planId: decision.plan_id,
      planTitle: plans.find((p) => p.id === decision.plan_id)?.title ?? null,
      createdPlan: null,
    };
  }

  if (decision.action === "new_plan" && decision.new_plan) {
    const { data: newPlan, error } = await supabase
      .from("nura_plans")
      .insert({
        owner_id: ownerId,
        title: decision.new_plan.title,
        category: decision.new_plan.category,
        status: "active",
        why_this_exists: decision.new_plan.why_this_exists,
        current_focus: decision.new_plan.current_focus,
        next_step: decision.new_plan.next_step,
      })
      .select("id, title")
      .single();

    const toCreated = (id: string, title: string) => ({
      id,
      title,
      why_this_exists: decision.new_plan!.why_this_exists,
      current_focus: decision.new_plan!.current_focus,
      next_step: decision.new_plan!.next_step,
    });

    if (error || !newPlan) {
      // Older rows / missing category enum still get a Journey without blocking chat.
      if (error && /category/i.test(error.message)) {
        const retry = await supabase
          .from("nura_plans")
          .insert({
            owner_id: ownerId,
            title: decision.new_plan.title,
            status: "active",
            why_this_exists: decision.new_plan.why_this_exists,
            current_focus: decision.new_plan.current_focus,
            next_step: decision.new_plan.next_step,
          })
          .select("id, title")
          .single();
        if (retry.error || !retry.data) {
          return { planId: null, planTitle: null, createdPlan: null, error: retry.error?.message ?? "plan creation failed" };
        }
        return {
          planId: retry.data.id as string,
          planTitle: retry.data.title as string,
          createdPlan: toCreated(retry.data.id as string, retry.data.title as string),
        };
      }
      return { planId: null, planTitle: null, createdPlan: null, error: error?.message ?? "plan creation failed" };
    }
    return {
      planId: newPlan.id as string,
      planTitle: newPlan.title as string,
      createdPlan: toCreated(newPlan.id as string, newPlan.title as string),
    };
  }

  return { planId: null, planTitle: null, createdPlan: null };
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function avoidSameDayCollision(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string,
  when: Date,
): Promise<Date> {
  // Only nudge multi-day-out scheduling - never touch explicit near-term asks
  // ("call me in 2 minutes") since those must be honoured exactly.
  if (when.getTime() - Date.now() < 24 * 60 * 60 * 1000) return when;

  const { data: otherUpcoming } = await supabase
    .from("nura_check_ins")
    .select("scheduled_for, plan_id")
    .eq("owner_id", ownerId)
    .neq("plan_id", planId)
    .is("completed_at", null)
    .gte("scheduled_for", new Date().toISOString());

  const bookedDates = new Set((otherUpcoming ?? []).map((c) => dateKey(new Date(c.scheduled_for as string))));

  const candidate = new Date(when);
  for (let attempt = 0; attempt < 4 && bookedDates.has(dateKey(candidate)); attempt++) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function generateRecurringOccurrences(start: Date, recurrence: "daily" | "weekdays" | "weekly"): Date[] {
  const occurrences: Date[] = [];
  const cursor = new Date(start);

  if (recurrence === "daily") {
    for (let i = 0; i < 30; i++) {
      occurrences.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (recurrence === "weekdays") {
    while (occurrences.length < 22) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) occurrences.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    for (let i = 0; i < 8; i++) {
      occurrences.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return occurrences;
}

export async function applyNextCheckIn(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string,
  nextCheckIn: NextCheckIn,
  timeZone: string = DEFAULT_TIME_ZONE,
) {
  const whenUtc = wallTimeInTimeZoneToUtcIso(nextCheckIn.when, timeZone);
  const normalized: NextCheckIn = { ...nextCheckIn, when: whenUtc };

  if (normalized.recurrence && normalized.recurrence !== "none") {
    // A recurring ask replaces whatever was previously scheduled for this Journey -
    // clear any open check-ins (single or from an earlier series) before laying the new one down.
    await supabase.from("nura_check_ins").delete().eq("owner_id", ownerId).eq("plan_id", planId).is("completed_at", null);

    const occurrences = generateRecurringOccurrences(new Date(normalized.when), normalized.recurrence);
    const rows = occurrences.map((date) => ({
      owner_id: ownerId,
      plan_id: planId,
      channel: normalized.channel,
      prompt: normalized.prompt,
      scheduled_for: date.toISOString(),
      recurrence: normalized.recurrence,
    }));

    if (rows.length > 0) {
      await supabase.from("nura_check_ins").insert(rows);
    }
    return;
  }

  const when = await avoidSameDayCollision(supabase, ownerId, planId, new Date(normalized.when));

  // Clear any previously open check-ins for this Journey - including leftover rows from an
  // earlier recurring series - so a one-off reschedule doesn't leave orphaned future occurrences.
  await supabase.from("nura_check_ins").delete().eq("owner_id", ownerId).eq("plan_id", planId).is("completed_at", null);

  await supabase.from("nura_check_ins").insert({
    owner_id: ownerId,
    plan_id: planId,
    channel: normalized.channel,
    prompt: normalized.prompt,
    scheduled_for: when.toISOString(),
    recurrence: null,
  });
}

export async function insertConversationTurn(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string | null,
  userContent: string,
  assistantReply: string,
  attachments: Array<{ name: string; kind: string }> = [],
) {
  const { error: userMsgError } = await supabase.from("nura_messages").insert({
    owner_id: ownerId,
    plan_id: planId,
    role: "user",
    content: userContent,
    attachments,
  });
  if (userMsgError) {
    // Older DBs without the attachments column still accept the core message.
    if (/attachments/i.test(userMsgError.message)) {
      const { error: fallbackError } = await supabase.from("nura_messages").insert({
        owner_id: ownerId,
        plan_id: planId,
        role: "user",
        content: userContent,
      });
      if (fallbackError) return { error: fallbackError.message };
    } else {
      return { error: userMsgError.message };
    }
  }

  const { error: replyMsgError } = await supabase.from("nura_messages").insert({
    owner_id: ownerId,
    plan_id: planId,
    role: "assistant",
    content: assistantReply,
    attachments: [],
  });
  if (replyMsgError) {
    if (/attachments/i.test(replyMsgError.message)) {
      const { error: fallbackError } = await supabase.from("nura_messages").insert({
        owner_id: ownerId,
        plan_id: planId,
        role: "assistant",
        content: assistantReply,
      });
      if (fallbackError) return { error: fallbackError.message };
    } else {
      return { error: replyMsgError.message };
    }
  }

  return { error: null };
}

// Turns a scheduled check-in's internal "what to ask about" prompt into a warm, natural
// opening message for an outbound WhatsApp text - the prompt itself is written as a directive
// to Nura (e.g. "ask how their sleep has been going"), not user-facing copy.
export async function composeCheckinOpener(
  firstName: string,
  planTitle: string,
  prompt: string,
  category?: string | null,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = `Hey ${firstName}, checking in - ${prompt}`;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const agentContext = buildAgentContext({ primaryCategory: category, surface: "text" });
    const message = await client.messages.create({
      ...anthropicGenerationFields({ ...agentContext.textParams, maxTokens: 200 }),
      system:
        NURA_CORE_IDENTITY + " You are proactively texting someone on WhatsApp to open a scheduled check-in. " +
        NURA_TONE + " " +
        (agentContext.systemExtras ? agentContext.systemExtras + " " : "") +
        "Write ONE short message (1-2 sentences) that naturally opens with what you want to check in about, based on the internal note you're given. Use the person's first name only if it feels natural, not in every message. Do not add a sign-off or ask multiple questions at once - just open the conversation.",
      messages: [
        {
          role: "user",
          content: `First name: ${firstName}\nCare plan: ${planTitle}\nInternal note on what to check in about: ${prompt}\n\nWrite the WhatsApp opener now.`,
        },
      ],
    });
    const block = message.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

// Used when a scheduled voice check-in call went unanswered/failed and Nura is falling back to
// a WhatsApp text instead - should own the fact the call didn't land, not pretend it didn't happen.
export async function composeMissedCallFollowup(firstName: string, planTitle: string, prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = `Hey ${firstName}, I tried calling you just now but couldn't reach you. I wanted to check in - ${prompt}. Want to chat here instead?`;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      system:
        NURA_CORE_IDENTITY + " You just tried to place a scheduled phone check-in call to this person and it went unanswered, so you're following up on WhatsApp instead. " +
        NURA_TONE + " " +
        "Write ONE short WhatsApp message (1-2 sentences) that: briefly and warmly acknowledges the call didn't connect (don't over-apologize or sound robotic about it), then opens the same check-in by text based on the internal note you're given. Use the person's first name only if it feels natural.",
      messages: [
        {
          role: "user",
          content: `First name: ${firstName}\nCare plan: ${planTitle}\nInternal note on what to check in about: ${prompt}\n\nWrite the WhatsApp follow-up now.`,
        },
      ],
    });
    const block = message.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

// Sent once, the moment a Journey's very last step closes - this is a genuine milestone for the
// user, not a system event, so it should read like Nura is actually glad for them, not filing a
// completion notice. Ends by inviting them to start something new or keep a lighter version going.
export async function composeJourneyCompletionMessage(
  firstName: string,
  planTitle: string,
  whyThisExisted: string,
  category?: string | null,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = `Hey ${firstName}, you've worked all the way through "${planTitle}" - that's genuinely great. Want to start something new, or keep a lighter version of this going?`;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const agentContext = buildAgentContext({ primaryCategory: category, surface: "text" });
    const message = await client.messages.create({
      ...anthropicGenerationFields({ ...agentContext.textParams, maxTokens: 200 }),
      system:
        NURA_CORE_IDENTITY + " The user just finished every step of one of their Care plans - a genuine milestone, not a routine check-in. " +
        NURA_TONE + " " +
        (agentContext.systemExtras ? agentContext.systemExtras + " " : "") +
        "Write ONE short, warm message (2-3 sentences) that: genuinely acknowledges what they finished (use the Care plan's name and why it existed to make it specific, not generic), then asks what they'd like next - start something new, keep a lighter version of this Care plan going, or just let it rest. Don't sound like a system closing a ticket.",
      messages: [
        {
          role: "user",
          content: `First name: ${firstName}\nCare plan: ${planTitle}\nWhy this Care plan existed: ${whyThisExisted}\n\nWrite the completion message now.`,
        },
      ],
    });
    const block = message.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}
