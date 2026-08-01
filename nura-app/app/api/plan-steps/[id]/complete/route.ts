import { NextResponse } from "next/server";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { completeStepAndCascade, regeneratePendingJourney } from "@/lib/domain/plan-journey";

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
    .select("id, status, milestone_id, plan_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!step) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const nowDone = step.status !== "done";

  if (nowDone) {
    await completeStepAndCascade(supabase, user.id, step.id as string, step.milestone_id as string);

    const { data: plan } = await supabase
      .from("nura_plans")
      .select("id, title, why_this_exists, current_focus, next_step")
      .eq("id", step.plan_id)
      .maybeSingle();
    if (plan) {
      await regeneratePendingJourney(supabase, user.id, plan as never);
    }
  } else {
    await supabase.from("nura_plan_steps").update({ status: "active", completed_at: null }).eq("id", step.id);
    await supabase.from("nura_plan_milestones").update({ status: "active" }).eq("id", step.milestone_id);
    // Un-completing the step that finished the Journey should undo the auto-archive too -
    // otherwise it's stuck looking "done and archived" while actually having an active step again.
    await supabase.from("nura_plans").update({ status: "active" }).eq("id", step.plan_id).eq("status", "archived");
  }

  const { data: milestoneRow } = await supabase.from("nura_plan_milestones").select("status").eq("id", step.milestone_id).maybeSingle();

  return NextResponse.json({ ok: true, status: nowDone ? "done" : "active", milestoneStatus: milestoneRow?.status ?? "active" });
}
