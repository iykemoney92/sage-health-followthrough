import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  planId: z.string().uuid(),
  mood: z.string().min(1),
  note: z.string().optional().default(""),
});

async function draftNextStep(planTitle: string, currentFocus: string | null, mood: string, note: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = "Nura will check in again soon.";
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 100,
      system:
        "You help Nura, a warm AI health companion, write the 'next step' line shown on a user's Thread after they complete a check-in. " +
        "Respond with ONLY a single short sentence (no JSON, no quotes, no markdown) describing what happens next or what to keep an eye on. Never diagnose or prescribe.",
      messages: [
        {
          role: "user",
          content: `Thread: "${planTitle}". Current focus: "${currentFocus ?? "n/a"}". The user just reported feeling "${mood}"${note ? ` and added: "${note}"` : ""}.`,
        },
      ],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallback;
    return textBlock.text.trim().replace(/^["']|["']$/g, "") || fallback;
  } catch {
    return fallback;
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

  const { planId, mood, note } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const { data: plan, error: planFetchError } = await supabase
    .from("nura_plans")
    .select("id, title, current_focus")
    .eq("id", planId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (planFetchError || !plan) {
    return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  const { error: obsError } = await supabase.from("nura_observations").insert([
    { owner_id: user.id, plan_id: planId, label: "mood", value: mood, recorded_at: now },
    ...(note ? [{ owner_id: user.id, plan_id: planId, label: "note", value: note, recorded_at: now }] : []),
  ]);

  if (obsError) {
    return NextResponse.json({ ok: false, error: obsError.message }, { status: 500 });
  }

  const { data: openCheckIn } = await supabase
    .from("nura_check_ins")
    .select("id")
    .eq("plan_id", planId)
    .eq("owner_id", user.id)
    .is("completed_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (openCheckIn) {
    const { error } = await supabase
      .from("nura_check_ins")
      .update({ completed_at: now })
      .eq("id", openCheckIn.id)
      .eq("owner_id", user.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("nura_check_ins").insert({
      owner_id: user.id,
      plan_id: planId,
      prompt: `How have things been with ${plan.title}?`,
      scheduled_for: now,
      completed_at: now,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  const nextStep = await draftNextStep(plan.title, plan.current_focus, mood, note);
  const nextCheckInTime = new Date();
  nextCheckInTime.setDate(nextCheckInTime.getDate() + 3);
  nextCheckInTime.setHours(19, 30, 0, 0);

  const { error: nextCheckInError } = await supabase.from("nura_check_ins").insert({
    owner_id: user.id,
    plan_id: planId,
    channel: "whatsapp",
    prompt: `How have things been with ${plan.title} since your last check-in?`,
    scheduled_for: nextCheckInTime.toISOString(),
  });

  if (nextCheckInError) {
    return NextResponse.json({ ok: false, error: nextCheckInError.message }, { status: 500 });
  }

  const { error: updatePlanError } = await supabase
    .from("nura_plans")
    .update({ next_step: `${nextStep} Next check-in is scheduled.`, updated_at: now })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (updatePlanError) {
    return NextResponse.json({ ok: false, error: updatePlanError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nextStep });
}
