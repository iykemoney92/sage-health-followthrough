import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NuraDecision = {
  reply: string;
  action: "existing_plan" | "new_plan" | "none";
  plan_id: string | null;
  new_plan: { title: string; why_this_exists: string; current_focus: string; next_step: string } | null;
};

export type PlanSummary = { id: string; title: string; current_focus: string | null };
export type PlanContext = { plan_id: string; title: string; summary: string; kind: string };
export type MessageAttachment = { name: string; type: string; kind: "image" | "audio" | "document" | "file"; text?: string };

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
    next_step: "Nura will check in tomorrow.",
  },
};

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 4500) {
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

export function deterministicDecision(content: string, plans: PlanSummary[]): NuraDecision | null {
  const normalized = content.toLowerCase();
  const findPlan = (patterns: RegExp[]) => plans.find((plan) => patterns.some((pattern) => pattern.test(plan.title.toLowerCase())));

  if (/\b(amlodipine|medication|medicine|dose|side effect|dizziness)\b/.test(normalized)) {
    const existing = findPlan([/medication/, /amlodipine/, /blood pressure/]);
    if (existing) {
      return {
        reply: "I’ll keep that with your medication follow-through context and check back so side effects or blood pressure follow-up don’t get lost.",
        action: "existing_plan",
        plan_id: existing.id,
        new_plan: null,
      };
    }
    return {
      reply: "I’ve made this a medication follow-through Thread and will check back around the timing your GP mentioned.",
      action: "new_plan",
      plan_id: null,
      new_plan: {
        title: "Medication Follow-Up",
        why_this_exists: "You started a medication and shared follow-up points to keep track of.",
        current_focus: "Track dizziness, dose context, and the blood pressure follow-up.",
        next_step: "Nura will check in around the blood pressure follow-up.",
      },
    };
  }

  if (/\b(blood pressure|bp check|bp)\b/.test(normalized)) {
    const existing = findPlan([/blood pressure/, /bp/, /medication/]);
    if (existing) {
      return {
        reply: "I’ll keep that with the right follow-through Thread and check back around the blood pressure timing.",
        action: "existing_plan",
        plan_id: existing.id,
        new_plan: null,
      };
    }
    return {
      reply: "I’ve made this a blood pressure follow-through Thread and will bring it back at the right time.",
      action: "new_plan",
      plan_id: null,
      new_plan: {
        title: "Blood Pressure Check",
        why_this_exists: "You shared a blood pressure follow-up that should not be forgotten.",
        current_focus: "Keep the blood pressure check and related symptoms visible.",
        next_step: "Nura will check in around the blood pressure follow-up.",
      },
    };
  }

  if (/\b(headache|migraine)\b/.test(normalized)) {
    const existing = findPlan([/headache/, /migraine/]);
    if (existing) {
      return {
        reply: "I’ll keep this with your headache Thread so sleep, symptoms, and follow-up stay together.",
        action: "existing_plan",
        plan_id: existing.id,
        new_plan: null,
      };
    }
  }

  return null;
}

async function classifyWithClaude(
  content: string,
  plans: PlanSummary[],
  attachments: MessageAttachment[],
  contexts: PlanContext[],
): Promise<NuraDecision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback: NuraDecision = plans.length > 0
    ? { reply: FALLBACK_REPLY, action: "existing_plan", plan_id: plans[0].id, new_plan: null }
    : FALLBACK_NEW_PLAN;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "You are Nura, a warm, concise AI health companion. A user just sent you a message. " +
        "Nura organises what people tell it into small 'Plans' (also called Threads) and follows up over time. " +
        "You never diagnose, prescribe, or give medical advice - you listen, organise, and follow through. " +
        "Nura CAN place a real proactive phone check-in call (via voice) or WhatsApp message at a scheduled time - when the user asks to be called or checked in on (including 'in N minutes'), confirm warmly that you'll check in then; never say you are unable to call. " +
        "Stay inside the user's provided Thread context. If the user shares clinician instructions, store and reflect them as user-provided or clinician-provided context, but ask the user to confirm before treating them as reminders. " +
        "If something sounds urgent, tell the user to contact urgent or emergency care. " +
        "Here are the user's existing Plans as JSON: " +
        JSON.stringify(plans) +
        (contexts.length > 0
          ? ". Recent Thread-linked memory/RAG context:\n" + ragContext(contexts)
          : "") +
        (attachments.length > 0
          ? ". The user also shared these media/attachment contexts:\n" + attachmentContext(attachments)
          : "") +
        ". Decide whether this message belongs to one of these existing Plans (by id), should start a brand new Plan, or needs no Plan at all (e.g. small talk). " +
        "Respond with ONLY a JSON object, no markdown fences, no extra text, matching exactly: " +
        '{"reply": string (1-3 warm short sentences replying directly to the user), "action": "existing_plan"|"new_plan"|"none", ' +
        '"plan_id": string or null (an id from the provided list, required if action is existing_plan), ' +
        '"new_plan": null or {"title": string (2-4 words), "why_this_exists": string (one sentence), "current_focus": string (one short sentence), "next_step": string (one short sentence)} (required if action is new_plan)}',
      messages: [{ role: "user", content }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;

    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as NuraDecision;
    if (!parsed.reply || !parsed.action) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export async function resolveDecision(
  content: string,
  plans: PlanSummary[],
  attachments: MessageAttachment[],
  contexts: PlanContext[],
  requestedPlan?: PlanSummary | null,
): Promise<NuraDecision> {
  const deterministic = requestedPlan
    ? {
        reply: `Thanks — I’ll keep this with your ${requestedPlan.title} Thread and use it when planning the next check-in.`,
        action: "existing_plan" as const,
        plan_id: requestedPlan.id,
        new_plan: null,
      }
    : deterministicDecision(content, plans);

  const fallback: NuraDecision = plans.length > 0
    ? { reply: FALLBACK_REPLY, action: "existing_plan", plan_id: plans[0].id, new_plan: null }
    : FALLBACK_NEW_PLAN;

  return deterministic ?? (await withTimeout(classifyWithClaude(content, plans, attachments, contexts), fallback));
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
