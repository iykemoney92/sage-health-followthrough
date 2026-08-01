import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const ownerId = user.id;

  // Explicit per-table deletes rather than relying on FK cascade behavior - some tables
  // (nura_messages.plan_id) use ON DELETE SET NULL rather than CASCADE, so deleting Journeys
  // first wouldn't necessarily clear everything else on its own.
  const tables = [
    "nura_plan_steps",
    "nura_plan_milestones",
    "nura_observations",
    "nura_source_contexts",
    "nura_check_ins",
    "nura_calendar_events",
    "nura_appointment_summaries",
    "nura_channel_links",
    "nura_messages",
    "nura_plans",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("owner_id", ownerId);
    if (error) {
      return NextResponse.json({ ok: false, error: `Failed to delete ${table}: ${error.message}` }, { status: 500 });
    }
  }

  const { error: profileError } = await supabase.from("nura_profiles").delete().eq("id", ownerId);
  if (profileError) {
    return NextResponse.json({ ok: false, error: `Failed to delete profile: ${profileError.message}` }, { status: 500 });
  }

  // Fully removing the auth.users row needs the service-role key - if it's not configured
  // yet, all of the user's data is still genuinely gone, just the login credential itself
  // remains until an admin (or a later deploy with the key set) removes it.
  let authAccountDeleted = false;
  try {
    const adminClient = getSupabaseServerClient();
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(ownerId);
    authAccountDeleted = !authDeleteError;
  } catch {
    authAccountDeleted = false;
  }

  return NextResponse.json({
    ok: true,
    dataDeleted: true,
    authAccountDeleted,
    message: authAccountDeleted
      ? "Your account and all data have been permanently deleted."
      : "All your data has been permanently deleted. Your login credential could not be removed automatically right now - it will be cleared shortly, or contact support.",
  });
}
