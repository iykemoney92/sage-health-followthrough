import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  planId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  label: z.string().optional().default(""),
});

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

  const { planId, scheduledFor, label } = parsed.data;
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ ok: false, error: "scheduled time must be in the future" }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();

  const { data: plan, error: planError } = await supabase
    .from("nura_plans")
    .select("id, title")
    .eq("id", planId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (planError || !plan) {
    return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
  }

  // Keep channel/prompt from the soonest open check-in so reschedule doesn't reset them.
  const { data: existing } = await supabase
    .from("nura_check_ins")
    .select("id, channel, prompt")
    .eq("owner_id", user.id)
    .eq("plan_id", planId)
    .is("completed_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Replace open check-ins for this Journey (same behaviour as chat intake reschedule).
  const { error: clearError } = await supabase
    .from("nura_check_ins")
    .delete()
    .eq("owner_id", user.id)
    .eq("plan_id", planId)
    .is("completed_at", null);

  if (clearError) {
    return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
  }

  const prompt =
    (existing?.prompt as string | undefined)?.trim() ||
    `How have things been with ${plan.title}?`;
  const channel = (existing?.channel as string | undefined) || "whatsapp";

  const { error } = await supabase.from("nura_check_ins").insert({
    owner_id: user.id,
    plan_id: planId,
    channel,
    prompt,
    scheduled_for: when.toISOString(),
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const nextStep = `Next check-in ${label || "scheduled"}.`;
  const { error: updateError } = await supabase
    .from("nura_plans")
    .update({ next_step: nextStep, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scheduledFor: when.toISOString() });
}
