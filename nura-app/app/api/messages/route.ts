import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  content: z.string().min(1),
  planId: z.string().uuid().optional().nullable(),
  attachments: z.array(z.object({
    name: z.string().min(1),
    type: z.string().default("application/octet-stream"),
    kind: z.enum(["image", "audio", "document", "file"]).default("file"),
    text: z.string().optional().default(""),
  })).optional().default([]),
});

type NuraDecision = {
  reply: string;
  action: "existing_plan" | "new_plan" | "none";
  plan_id: string | null;
  new_plan: { title: string; why_this_exists: string; current_focus: string; next_step: string } | null;
};

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

type MessageAttachment = z.infer<typeof requestSchema>["attachments"][number];
type PlanContext = {
  plan_id: string;
  title: string;
  summary: string;
  kind: string;
};

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

function deterministicDecision(
  content: string,
  plans: { id: string; title: string; current_focus: string | null }[],
): NuraDecision | null {
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

function relativeMinuteRequest(normalized: string) {
  const numberMatch = normalized.match(/\b(?:in\s*)?(\d{1,2})\s*(?:minutes?|mins?|min)\b/);
  if (numberMatch) return Number(numberMatch[1]);

  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const wordMatch = normalized.match(/\b(?:in\s*)?(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:minutes?|mins?|min)\b/);
  return wordMatch ? words[wordMatch[1]] : null;
}

function inferredCheckIn(content: string, planTitle: string | null) {
  const normalized = content.toLowerCase();
  const scheduledFor = new Date();
  let label = "tomorrow evening";
  let explicit = false;
  const requestedMinutes = relativeMinuteRequest(normalized);

  if (requestedMinutes && requestedMinutes > 0) {
    scheduledFor.setTime(Date.now() + requestedMinutes * 60_000);
    label = `in ${requestedMinutes} minute${requestedMinutes === 1 ? "" : "s"}`;
    explicit = true;
  } else if (/\btonight\b|\bthis evening\b/.test(normalized)) {
    scheduledFor.setHours(19, 30, 0, 0);
    if (scheduledFor.getTime() <= Date.now()) scheduledFor.setDate(scheduledFor.getDate() + 1);
    label = "this evening";
    explicit = true;
  } else if (/\btomorrow\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(19, 30, 0, 0);
    explicit = true;
  } else if (/\b(two|2)\s+weeks?\b|\bfortnight\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 14);
    scheduledFor.setHours(9, 0, 0, 0);
    label = "in two weeks";
    explicit = true;
  } else if (/\b(next week|one week|1 week)\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 7);
    scheduledFor.setHours(9, 0, 0, 0);
    label = "next week";
    explicit = true;
  } else if (/\b(few days|couple of days|every few days)\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 3);
    scheduledFor.setHours(19, 30, 0, 0);
    label = "in a few days";
    explicit = true;
  } else {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(19, 30, 0, 0);
  }

  const topic = planTitle ? `your ${planTitle} Thread` : "what you shared";
  return {
    scheduledFor,
    label,
    explicit,
    prompt: `Quick check-in on ${topic}: how have things been since you told Nura about this?`,
  };
}

async function decide(
  content: string,
  plans: { id: string; title: string; current_focus: string | null }[],
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

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const [{ data, error }, { data: activePlan }] = await Promise.all([
    supabase
    .from("nura_messages")
    .select("id, plan_id, role, content, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("nura_plans")
      .select("id, title")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).sort((a, b) => {
    const byTime = new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
    if (byTime !== 0) return byTime;
    if (a.role === b.role) return 0;
    return a.role === "user" ? -1 : 1;
  });

  return NextResponse.json({ ok: true, messages, activePlan });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { content, attachments, planId: requestedPlanId } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const { data: plans, error: plansError } = await supabase
    .from("nura_plans")
    .select("id, title, current_focus")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (plansError) {
    return NextResponse.json({ ok: false, error: plansError.message }, { status: 500 });
  }

  const { data: contexts } = await supabase
    .from("nura_source_contexts")
    .select("plan_id, title, summary, kind, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const requestedPlan = requestedPlanId ? plans?.find((plan) => plan.id === requestedPlanId) : null;
  const deterministic = requestedPlan ? {
    reply: `Thanks — I’ll keep this with your ${requestedPlan.title} Thread and use it when planning the next check-in.`,
    action: "existing_plan" as const,
    plan_id: requestedPlan.id,
    new_plan: null,
  } : deterministicDecision(content, plans ?? []);
  const decision = deterministic ?? await withTimeout(decide(content, plans ?? [], attachments, (contexts ?? []) as PlanContext[]), plans && plans.length > 0
    ? { reply: FALLBACK_REPLY, action: "existing_plan", plan_id: plans[0].id, new_plan: null }
    : FALLBACK_NEW_PLAN);

  let planId: string | null = null;
  let planTitle: string | null = null;

  if (decision.action === "existing_plan" && decision.plan_id && plans?.some((p) => p.id === decision.plan_id)) {
    planId = decision.plan_id;
    planTitle = plans?.find((p) => p.id === decision.plan_id)?.title ?? null;
  } else if (decision.action === "new_plan" && decision.new_plan) {
    const { data: newPlan, error: planError } = await supabase
      .from("nura_plans")
      .insert({
        owner_id: user.id,
        title: decision.new_plan.title,
        status: "active",
        why_this_exists: decision.new_plan.why_this_exists,
        current_focus: decision.new_plan.current_focus,
        next_step: decision.new_plan.next_step,
      })
      .select("id, title")
      .single();

    if (planError || !newPlan) {
      return NextResponse.json({ ok: false, error: planError?.message ?? "plan creation failed" }, { status: 500 });
    }

    planId = newPlan.id;
    planTitle = newPlan.title;
  }

  const { error: userMsgError } = await supabase.from("nura_messages").insert({
    owner_id: user.id,
    plan_id: planId,
    role: "user",
    content,
  });

  if (userMsgError) {
    return NextResponse.json({ ok: false, error: userMsgError.message }, { status: 500 });
  }

  const { error: replyMsgError } = await supabase.from("nura_messages").insert({
    owner_id: user.id,
    plan_id: planId,
    role: "assistant",
    content: decision.reply,
  });

  if (replyMsgError) {
    return NextResponse.json({ ok: false, error: replyMsgError.message }, { status: 500 });
  }

  if (planId) {
    if (attachments.length > 0) {
      await supabase.from("nura_source_contexts").insert(attachments.map((file) => ({
        owner_id: user.id,
        plan_id: planId,
        kind: file.kind === "image" ? "document_upload" : file.kind === "audio" ? "conversation" : "document_upload",
        title: file.name,
        summary: file.text
          ? `${file.kind} shared in conversation: ${file.text.slice(0, 500)}`
          : `${file.kind} shared in conversation (${file.type}).`,
        requires_user_confirmation: file.kind === "document",
      })));
    }

    const { data: openCheckIn } = await supabase
      .from("nura_check_ins")
      .select("id")
      .eq("owner_id", user.id)
      .eq("plan_id", planId)
      .is("completed_at", null)
      .limit(1)
      .maybeSingle();

    const checkIn = inferredCheckIn(content, planTitle);

    if (openCheckIn && checkIn.explicit) {
      await supabase
        .from("nura_check_ins")
        .update({
          prompt: checkIn.prompt,
          scheduled_for: checkIn.scheduledFor.toISOString(),
          triggered_at: null,
          call_status: null,
          call_error: null,
        })
        .eq("id", openCheckIn.id)
        .eq("owner_id", user.id);

      await supabase
        .from("nura_plans")
        .update({ next_step: `Nura will check in ${checkIn.label}.` })
        .eq("id", planId)
        .eq("owner_id", user.id);
    } else if (!openCheckIn) {
      await supabase.from("nura_check_ins").insert({
        owner_id: user.id,
        plan_id: planId,
        channel: "whatsapp",
        prompt: checkIn.prompt,
        scheduled_for: checkIn.scheduledFor.toISOString(),
      });

      await supabase
        .from("nura_plans")
        .update({ next_step: `Nura will check in ${checkIn.label}.` })
        .eq("id", planId)
        .eq("owner_id", user.id);
    }

    const { error: updateError } = await supabase
      .from("nura_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("owner_id", user.id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, reply: decision.reply, planId, planTitle });
}
