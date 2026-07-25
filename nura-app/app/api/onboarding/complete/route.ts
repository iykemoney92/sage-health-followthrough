import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  interests: z.array(z.string()).default([]),
  channel: z.string().default("WhatsApp"),
  intake: z.string().default(""),
  skip: z.boolean().optional().default(false),
});

const CHANNEL_MAP: Record<string, string> = {
  "WhatsApp": "whatsapp",
  "In the app": "in_app",
  "Both": "both",
};

type PlanDraft = {
  title: string;
  why_this_exists: string;
  current_focus: string;
  next_step: string;
};

const FALLBACK_PLAN: PlanDraft = {
  title: "Stabilise My Week",
  why_this_exists: "You shared overwhelm, poor sleep, and a GP walking goal that Nura can help you follow through on.",
  current_focus: "Keep the next step gentle: sleep, stress, and a realistic daily walk.",
  next_step: "Nura will check in tomorrow to see how sleep and walking went.",
};

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 4500) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function draftPlanFromIntake(intake: string): Promise<PlanDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return FALLBACK_PLAN;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system:
        "You turn a short piece of free text from a new Nura user into the start of a health Plan (also called a Thread). " +
        "Nura organises messy life/health context into small, manageable plans and follows up over time. " +
        "Respond with ONLY a JSON object, no markdown fences, no extra text, matching exactly: " +
        '{"title": string (2-4 words, e.g. "Stabilise My Week"), "why_this_exists": string (one sentence), "current_focus": string (one short sentence), "next_step": string (one short sentence)}. ' +
        "Never diagnose, prescribe, or give medical advice - just organise what the user said.",
      messages: [{ role: "user", content: intake }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return FALLBACK_PLAN;

    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed.title || !parsed.why_this_exists || !parsed.current_focus || !parsed.next_step) {
      return FALLBACK_PLAN;
    }
    return parsed as PlanDraft;
  } catch {
    return FALLBACK_PLAN;
  }
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

  const { interests, channel, intake, skip } = parsed.data;
  if (!skip && !intake.trim()) {
    return NextResponse.json({ ok: false, error: "intake_required" }, { status: 400 });
  }
  const supabase = await getSupabaseSessionClient();

  const displayName = (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "";

  const { error: profileError } = await supabase.from("nura_profiles").upsert({
    id: user.id,
    display_name: displayName,
    preferred_channel: CHANNEL_MAP[channel] ?? "whatsapp",
    interests,
  });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  if (skip) {
    await supabase.auth.updateUser({ data: { onboarding_complete: true } });
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: existingPlan, error: existingPlanError } = await supabase
    .from("nura_plans")
    .select("id, title, why_this_exists, current_focus, next_step")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingPlanError) {
    return NextResponse.json({ ok: false, error: existingPlanError.message }, { status: 500 });
  }

  if (existingPlan) {
    await supabase.auth.updateUser({ data: { onboarding_complete: true } });

    return NextResponse.json({
      ok: true,
      plan: {
        title: existingPlan.title,
        why_this_exists: existingPlan.why_this_exists,
        current_focus: existingPlan.current_focus,
        next_step: existingPlan.next_step,
      },
      existing: true,
    });
  }

  const plan = await withTimeout(draftPlanFromIntake(intake), FALLBACK_PLAN);

  const { data: createdPlan, error: planError } = await supabase
    .from("nura_plans")
    .insert({
      owner_id: user.id,
      title: plan.title,
      status: "active",
      why_this_exists: plan.why_this_exists,
      current_focus: plan.current_focus,
      next_step: plan.next_step,
    })
    .select("id")
    .single();

  if (planError || !createdPlan) {
    return NextResponse.json({ ok: false, error: planError?.message ?? "Could not create Thread" }, { status: 500 });
  }

  const checkInTime = new Date();
  checkInTime.setDate(checkInTime.getDate() + 1);
  checkInTime.setHours(19, 30, 0, 0);
  const followUpChannel = channel === "In the app" ? "in_app" : "whatsapp";

  await Promise.all([
    supabase.from("nura_messages").insert([
      { owner_id: user.id, plan_id: createdPlan.id, role: "user", content: intake },
      { owner_id: user.id, plan_id: createdPlan.id, role: "assistant", content: "I’ve made this a Thread and scheduled a gentle check-in for tomorrow." },
    ]),
    supabase.from("nura_check_ins").insert({
      owner_id: user.id,
      plan_id: createdPlan.id,
      channel: followUpChannel,
      prompt: "How did sleep feel last night, and was a short walk realistic today?",
      scheduled_for: checkInTime.toISOString(),
    }),
  ]);

  await supabase.auth.updateUser({ data: { onboarding_complete: true } });

  return NextResponse.json({ ok: true, plan });
}
