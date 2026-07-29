import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const ownerId = user.id;

  const [
    { data: profile },
    { data: plans },
    { data: milestones },
    { data: steps },
    { data: messages },
    { data: checkIns },
    { data: observations },
    { data: sourceContexts },
    { data: calendarEvents },
    { data: appointmentSummaries },
    { data: channelLinks },
  ] = await Promise.all([
    supabase.from("nura_profiles").select("*").eq("id", ownerId).maybeSingle(),
    supabase.from("nura_plans").select("*").eq("owner_id", ownerId),
    supabase.from("nura_plan_milestones").select("*").eq("owner_id", ownerId),
    supabase.from("nura_plan_steps").select("*").eq("owner_id", ownerId),
    supabase.from("nura_messages").select("*").eq("owner_id", ownerId),
    supabase.from("nura_check_ins").select("*").eq("owner_id", ownerId),
    supabase.from("nura_observations").select("*").eq("owner_id", ownerId),
    supabase.from("nura_source_contexts").select("*").eq("owner_id", ownerId),
    supabase.from("nura_calendar_events").select("*").eq("owner_id", ownerId),
    supabase.from("nura_appointment_summaries").select("*").eq("owner_id", ownerId),
    supabase.from("nura_channel_links").select("*").eq("owner_id", ownerId),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile ?? null,
    threads: plans ?? [],
    threadMilestones: milestones ?? [],
    threadSteps: steps ?? [],
    messages: messages ?? [],
    checkIns: checkIns ?? [],
    observations: observations ?? [],
    sharedDocuments: sourceContexts ?? [],
    calendarEvents: calendarEvents ?? [],
    appointmentSummaries: appointmentSummaries ?? [],
    connectedChannels: channelLinks ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nura-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
