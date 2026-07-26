import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NextCheckIn = {
  when: string;
  prompt: string;
  channel: "voice" | "whatsapp" | "in_app";
};

export type NuraDecision = {
  reply: string;
  action: "existing_plan" | "new_plan" | "none";
  plan_id: string | null;
  new_plan: { title: string; why_this_exists: string; current_focus: string; next_step: string } | null;
  next_check_in: NextCheckIn | null;
};

export type PlanSummary = { id: string; title: string; current_focus: string | null };
export type PlanContext = { plan_id: string; title: string; summary: string; kind: string };
export type MissedCheckIn = { plan_title: string; prompt: string; scheduled_for: string; reason: string };
export type MessageAttachment = { name: string; type: string; kind: "image" | "audio" | "document" | "file"; text?: string };
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
  "Thanks for telling me. I’ve organised this into a Thread and I’ll check in gently so it doesn’t get lost.";

const FALLBACK_NEW_PLAN: NuraDecision = {
  reply: FALLBACK_REPLY,
  action: "new_plan",
  plan_id: null,
  new_plan: {
    title: "Stabilise My Week",
    why_this_exists: "You shared something that would benefit from gentle follow-through.",
    current_focus: "Keep the next step small and track what changes.",
    next_step: "Nura will check in soon.",
  },
  next_check_in: null,
};

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 12000) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
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
  return contexts.map((context) => `- Thread ${context.plan_id} / ${context.title} / ${context.kind}: ${context.summary}`).join("\n");
}

function missedCheckInContext(missed: MissedCheckIn[]) {
  if (missed.length === 0) return "";
  return missed.map((m) => `- ${m.plan_title}: was going to ask "${m.prompt}", scheduled for ${m.scheduled_for}, but didn't reach the user (${m.reason}).`).join("\n");
}

function isValidNextCheckIn(value: unknown): value is NextCheckIn {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.when !== "string" || typeof candidate.prompt !== "string") return false;
  const when = new Date(candidate.when);
  if (Number.isNaN(when.getTime())) return false;
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
): Promise<NuraDecision> {
  const hasPhoneOnFile = Boolean(phoneOnFile);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback: NuraDecision = plans.length > 0
    ? { reply: FALLBACK_REPLY, action: "existing_plan", plan_id: plans[0].id, new_plan: null, next_check_in: null }
    : FALLBACK_NEW_PLAN;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const nowIso = new Date().toISOString();
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "You are Nura, a warm AI health and wellbeing companion. You are not a doctor or therapist: you never diagnose, prescribe, or give medical advice. " +
        "What you do is closer to a caring intake conversation - you listen, ask thoughtful follow-up questions to actually understand what's going on, and help someone organise what they're dealing with into a 'Thread' (also called a Plan) that you help them stay on top of over time. " +
        "\n\nBe genuinely curious before you file something away. If a message is thin on detail, ask ONE warm, specific follow-up question instead of immediately deciding what Thread it belongs to - e.g. someone mentioning work stress deserves something like 'how long has this been building?' or 'is it affecting your sleep?' before you organise it. It is completely fine to have a few exchanges like this - use action \"none\" and leave plan/new_plan/next_check_in null while you're still gathering context. Only commit to a Thread once you understand the shape of what's actually going on. " +
        "\n\nOnce you do understand it, decide whether this belongs to one of the user's existing Threads (by id), should start a brand new Thread, or still needs no Thread yet (small talk, or you're still asking questions). " +
        "\n\nWhen you create a NEW Thread (action = new_plan), that Thread should almost always come with a proposed follow-up - a plan to help with something isn't really a plan without one. Decide the cadence yourself even if the user never asked for a check-in: a single stressful shift might warrant checking in a couple of days later; a new medication might warrant checking in around the timing the user described; an ongoing pattern like poor sleep might warrant checking in a week out. This does not default to 'tomorrow'. Say what you've decided in your reply (e.g. 'I'll check back in with you in a few days about this') so it doesn't feel like a silent background action. Be proactive, not just reactive: if that follow-up is more than a few hours away, also offer in the same reply to check in sooner if they'd like - e.g. 'Want me to check in with you in a couple of minutes instead, or is that timing fine?' - so the user always has the option of an immediate check-in, not only a future one. " +
        "\n\nWhen you attach to an EXISTING Thread instead, only set a fresh next_check_in if something actually changed enough to warrant re-scheduling (new detail, explicit request, or the situation clearly shifted) - otherwise leave it null and let the existing schedule stand. Something the user explicitly asked about ('call me in 5 minutes', 'check in next Tuesday', 'check in on me from time to time') must always be honoured, overriding any existing schedule. The current date/time is " + nowIso + " - compute next_check_in.when as a real ISO 8601 datetime relative to that. " +
        "\n\nNura CAN place a real proactive phone check-in call (voice), or follow up on WhatsApp or in-app - never say you are unable to call or check in. " +
        "\n\n" + (hasPhoneOnFile
          ? `The user's phone number on file is +${phoneOnFile}. When you confirm a voice check-in call, briefly state that exact number (e.g. "I'll call you on +${phoneOnFile}") so they can correct it if it's wrong - don't just silently assume it's still right without saying it.`
          : "The user does NOT have a phone number on file yet. If you're about to promise or schedule a phone check-in call, you must ask for their number in your reply first instead of just confirming a call - something like 'What's the best number to reach you on?' Do not set next_check_in with channel \"voice\" until a number has actually been given (in this message or an earlier one in the history). If they just gave a number in this message, thank them and it will be saved automatically. Until you have a number, prefer scheduling the follow-up on whatsapp or in_app instead of promising a call.") +
        "\n\nThe user can share documents, photos or voice notes as supporting context at any point - treat those as part of the conversation, not a separate step, and factor anything extracted from them into your understanding. " +
        "If the user shares clinician instructions, store and reflect them as user- or clinician-provided context, but ask the user to confirm before treating them as reminders. If something sounds urgent, tell the user to contact urgent or emergency care. " +
        (missed.length > 0
          ? "\n\nThe following scheduled check-ins were missed (Nura tried to reach the user and couldn't):\n" + missedCheckInContext(missed) +
            "\nIf this is early in the conversation or the topic comes up, gently mention it once - acknowledge you tried to reach them, and ask if they'd like to reschedule that specific check-in or just leave it. If they want to reschedule, treat it exactly like a normal follow-up request for that Thread (existing_plan + next_check_in). If they say to drop it, acknowledge warmly and leave next_check_in null for that Thread - don't bring it up again this conversation."
          : "") +
        "\n\nHere are the user's existing Threads as JSON: " +
        JSON.stringify(plans) +
        (contexts.length > 0
          ? ". Recent Thread-linked memory/RAG context:\n" + ragContext(contexts)
          : "") +
        (attachments.length > 0
          ? ". The user also shared these media/attachment contexts:\n" + attachmentContext(attachments)
          : "") +
        "\n\nThe conversation history below is provided for context - do not repeat questions the user already answered in it, and build on what you already know instead of starting over. " +
        "Lines are tagged with [Thread Title] when they belong to a specific Thread; untagged lines are general conversation not yet tied to one. Only continue or reference a tagged Thread if it's the same one currently being discussed. Do not proactively bring up, offer to resume, or remind the user about a pending check-in, open question, or unfinished item from a DIFFERENT, unrelated Thread just because it appears in the history - stay on the topic actually being discussed unless the user brings the other thing up themselves. " +
        "\n\nAlways call the decide tool exactly once with your decision - never reply in plain text.",
      tools: [
        {
          name: "decide",
          description: "Record Nura's decision about how to respond to the user's latest message: what to say, whether it belongs to a Thread, and whether to schedule a follow-up.",
          input_schema: {
            type: "object",
            properties: {
              reply: {
                type: "string",
                description: "1-4 warm, human sentences replying directly to the user. Ask a genuine follow-up question when you need one.",
              },
              action: {
                type: "string",
                enum: ["existing_plan", "new_plan", "none"],
                description: "\"none\" while still gathering context (small talk, or asking a follow-up question) - do not create or attach a Thread yet.",
              },
              plan_id: {
                type: "string",
                description: "An id from the provided existing Threads list. Required (non-empty) only when action is existing_plan; otherwise pass an empty string.",
              },
              new_plan: {
                type: "object",
                description: "Required when action is new_plan; otherwise pass all fields as empty strings.",
                properties: {
                  title: { type: "string", description: "2-4 words." },
                  why_this_exists: { type: "string", description: "One sentence." },
                  current_focus: { type: "string", description: "One short sentence." },
                  next_step: { type: "string", description: "One short sentence describing the plan - what Nura will do and when." },
                },
                required: ["title", "why_this_exists", "current_focus", "next_step"],
              },
              has_next_check_in: {
                type: "boolean",
                description: "True only when you're actually confident a follow-up makes sense right now. Not every message needs one.",
              },
              next_check_in: {
                type: "object",
                description: "Only meaningful when has_next_check_in is true; otherwise pass empty/placeholder values.",
                properties: {
                  when: { type: "string", description: "Real ISO 8601 datetime, computed relative to the current date/time given above." },
                  prompt: { type: "string", description: "What Nura should specifically ask about at that check-in." },
                  channel: { type: "string", enum: ["voice", "whatsapp", "in_app"] },
                },
                required: ["when", "prompt", "channel"],
              },
            },
            required: ["reply", "action", "plan_id", "new_plan", "has_next_check_in", "next_check_in"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "decide" },
      messages: [
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user" as const, content },
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
      new_plan: { title: string; why_this_exists: string; current_focus: string; next_step: string };
      has_next_check_in: boolean;
      next_check_in: { when: string; prompt: string; channel: string };
    };

    if (!raw.reply || !raw.action) {
      console.error("[classifyWithClaude] missing reply/action; raw:", JSON.stringify(raw));
      return fallback;
    }

    let nextCheckIn = raw.has_next_check_in && isValidNextCheckIn(raw.next_check_in)
      ? { ...raw.next_check_in, channel: (raw.next_check_in.channel || "voice") as NextCheckIn["channel"] }
      : null;
    if (nextCheckIn && nextCheckIn.channel === "voice" && !hasPhoneOnFile) {
      nextCheckIn = { ...nextCheckIn, channel: "in_app" };
    }

    const parsed: NuraDecision = {
      reply: raw.reply,
      action: raw.action,
      plan_id: raw.action === "existing_plan" && raw.plan_id ? raw.plan_id : null,
      new_plan: raw.action === "new_plan" && raw.new_plan?.title ? raw.new_plan : null,
      next_check_in: nextCheckIn,
    };
    return parsed;
  } catch (err) {
    console.error("[classifyWithClaude] failed:", err);
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
): Promise<NuraDecision> {
  if (requestedPlan) {
    return {
      reply: `Thanks — I’ll keep this with your ${requestedPlan.title} Thread and use it when planning the next check-in.`,
      action: "existing_plan",
      plan_id: requestedPlan.id,
      new_plan: null,
      next_check_in: null,
    };
  }

  const fallback: NuraDecision = plans.length > 0
    ? { reply: FALLBACK_REPLY, action: "existing_plan", plan_id: plans[0].id, new_plan: null, next_check_in: null }
    : FALLBACK_NEW_PLAN;

  return withTimeout(classifyWithClaude(content, plans, attachments, contexts, history, phoneOnFile, missed), fallback);
}

export async function applyPlanDecision(
  supabase: SupabaseClient,
  ownerId: string,
  decision: NuraDecision,
  plans: PlanSummary[],
): Promise<{ planId: string | null; planTitle: string | null; error?: string }> {
  if (decision.action === "existing_plan" && decision.plan_id && plans.some((p) => p.id === decision.plan_id)) {
    return { planId: decision.plan_id, planTitle: plans.find((p) => p.id === decision.plan_id)?.title ?? null };
  }

  if (decision.action === "new_plan" && decision.new_plan) {
    const { data: newPlan, error } = await supabase
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

    if (error || !newPlan) {
      return { planId: null, planTitle: null, error: error?.message ?? "plan creation failed" };
    }
    return { planId: newPlan.id as string, planTitle: newPlan.title as string };
  }

  return { planId: null, planTitle: null };
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

export async function applyNextCheckIn(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string,
  nextCheckIn: NextCheckIn,
) {
  const when = await avoidSameDayCollision(supabase, ownerId, planId, new Date(nextCheckIn.when));

  const { data: openCheckIn } = await supabase
    .from("nura_check_ins")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("plan_id", planId)
    .is("completed_at", null)
    .limit(1)
    .maybeSingle();

  if (openCheckIn) {
    await supabase
      .from("nura_check_ins")
      .update({
        prompt: nextCheckIn.prompt,
        scheduled_for: when.toISOString(),
        channel: nextCheckIn.channel,
        triggered_at: null,
        call_status: null,
        call_error: null,
      })
      .eq("id", openCheckIn.id)
      .eq("owner_id", ownerId);
  } else {
    await supabase.from("nura_check_ins").insert({
      owner_id: ownerId,
      plan_id: planId,
      channel: nextCheckIn.channel,
      prompt: nextCheckIn.prompt,
      scheduled_for: when.toISOString(),
    });
  }
}

export async function insertConversationTurn(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string | null,
  userContent: string,
  assistantReply: string,
) {
  const { error: userMsgError } = await supabase.from("nura_messages").insert({
    owner_id: ownerId,
    plan_id: planId,
    role: "user",
    content: userContent,
  });
  if (userMsgError) return { error: userMsgError.message };

  const { error: replyMsgError } = await supabase.from("nura_messages").insert({
    owner_id: ownerId,
    plan_id: planId,
    role: "assistant",
    content: assistantReply,
  });
  if (replyMsgError) return { error: replyMsgError.message };

  return { error: null };
}
