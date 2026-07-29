import { NextResponse } from "next/server";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { respondToStepStart } from "@/lib/domain/plan-journey";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const paywall = await requirePlusAccess(supabase, user.id, "journey");
  if (paywall) return paywall;

  const { data: step } = await supabase
    .from("nura_plan_steps")
    .select("id, title, context_prompt, status, milestone_id, plan_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!step) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const [{ data: milestone }, { data: plan }, { data: recentMessages }] = await Promise.all([
    supabase.from("nura_plan_milestones").select("id, title, status").eq("id", step.milestone_id).maybeSingle(),
    supabase.from("nura_plans").select("id, title, why_this_exists, current_focus, next_step").eq("id", step.plan_id).maybeSingle(),
    supabase
      .from("nura_messages")
      .select("role, content, created_at")
      .eq("plan_id", step.plan_id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  if (!milestone || !plan) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const history = (recentMessages ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));

  const reply = await respondToStepStart(
    plan as never,
    { title: milestone.title as string },
    { title: step.title as string, contextPrompt: step.context_prompt as string },
    history,
  );

  const userTurn = `Let's work on: ${step.title as string}`;

  // Inserted sequentially, not in parallel - the assistant reply must get a strictly later
  // created_at than the user turn, or the transcript can render them out of order.
  const { error: userMsgError } = await supabase.from("nura_messages").insert({ owner_id: user.id, plan_id: step.plan_id, role: "user", content: userTurn });
  if (userMsgError) {
    return NextResponse.json({ ok: false, error: userMsgError.message }, { status: 500 });
  }

  const { error: replyMsgError } = await supabase.from("nura_messages").insert({ owner_id: user.id, plan_id: step.plan_id, role: "assistant", content: reply });
  if (replyMsgError) {
    return NextResponse.json({ ok: false, error: replyMsgError.message }, { status: 500 });
  }

  await supabase.from("nura_plan_steps").update({ status: "active" }).eq("id", step.id);
  if (milestone.status === "pending") {
    await supabase.from("nura_plan_milestones").update({ status: "active" }).eq("id", milestone.id);
  }
  await supabase.from("nura_plans").update({ updated_at: new Date().toISOString() }).eq("id", step.plan_id);

  return NextResponse.json({ ok: true, planId: step.plan_id, planTitle: plan.title });
}
