import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";

const requestSchema = z.object({
  ownerId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  planTitle: z.string().min(1).optional(),
  channel: z.enum(["whatsapp", "in_app", "voice"]).default("voice"),
  prompt: z.string().min(1),
  scheduledFor: z.string().datetime(),
}).refine((value) => value.planId || value.planTitle, { message: "Provide planId or planTitle." });

const DEMO_OWNER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { ownerId, planId: requestedPlanId, planTitle, channel, prompt, scheduledFor } = parsed.data;
  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const planQuery = supabase.from("nura_plans").select("id, title, owner_id");
  const { data: plan, error: planError } = requestedPlanId
    ? await planQuery.eq("id", requestedPlanId).maybeSingle()
    : await planQuery.eq("owner_id", ownerId ?? DEMO_OWNER_ID).ilike("title", planTitle!).maybeSingle();

  if (planError) {
    return NextResponse.json({ ok: false, error: planError.message }, { status: 500 });
  }

  if (requestedPlanId && !plan) {
    return NextResponse.json({ ok: false, error: "Thread not found" }, { status: 404 });
  }

  let planId = plan?.id as string | undefined;
  let resolvedTitle = plan?.title ?? planTitle!;
  const resolvedOwnerId = (plan?.owner_id as string | undefined) ?? ownerId ?? DEMO_OWNER_ID;

  if (!planId) {
    const { data: created, error: createError } = await supabase
      .from("nura_plans")
      .insert({
        owner_id: resolvedOwnerId,
        title: planTitle!,
        status: "active",
        why_this_exists: "Created from a proactive call by Nura.",
        current_focus: prompt,
        next_step: "Follow up at the scheduled check-in.",
      })
      .select("id, title")
      .single();

    if (createError || !created) {
      return NextResponse.json({ ok: false, error: createError?.message ?? "Could not create plan" }, { status: 500 });
    }
    planId = created.id;
    resolvedTitle = created.title;
  }

  const { data: checkIn, error: checkInError } = await supabase
    .from("nura_check_ins")
    .insert({
      owner_id: resolvedOwnerId,
      plan_id: planId,
      channel,
      prompt,
      scheduled_for: scheduledFor,
    })
    .select("id, plan_id, channel, prompt, scheduled_for, created_at")
    .single();

  if (checkInError || !checkIn) {
    return NextResponse.json({ ok: false, error: checkInError?.message ?? "Could not schedule check-in" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Check-in scheduled for the ${resolvedTitle} thread on ${scheduledFor} via ${channel}.`,
    checkIn: { ...checkIn, planTitle: resolvedTitle },
  });
}

export async function GET() {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("nura_check_ins")
    .select("id, channel, prompt, scheduled_for, created_at, nura_plans(title)")
    .eq("owner_id", DEMO_OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checkIns: data });
}
