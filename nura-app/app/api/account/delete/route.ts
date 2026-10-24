import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { deleteConversation } from "@/lib/integrations/elevenlabs";
import { VOICE_NOTES_BUCKET } from "@/lib/voice-notes";

/** Removes every voice note under the person's folder in storage, a page at a time. */
async function deleteVoiceNotes(ownerId: string) {
  const admin = getSupabaseServerClient();
  const bucket = admin.storage.from(VOICE_NOTES_BUCKET);
  let removed = 0;
  for (let guard = 0; guard < 100; guard++) {
    const { data, error } = await bucket.list(ownerId, { limit: 1000 });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    const { error: removeError } = await bucket.remove(data.map((file) => `${ownerId}/${file.name}`));
    if (removeError) throw new Error(removeError.message);
    removed += data.length;
  }
  return removed;
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const ownerId = user.id;

  // Call recordings live with ElevenLabs, keyed by the conversation ids on the person's
  // check-ins, so collect those before the check-ins themselves are deleted.
  const { data: calls } = await supabase
    .from("nura_check_ins")
    .select("call_conversation_id")
    .eq("owner_id", ownerId)
    .not("call_conversation_id", "is", null);
  const conversationIds = [...new Set((calls ?? []).map((row) => row.call_conversation_id as string).filter(Boolean))];

  // Voice notes are files in storage rather than table rows, so they go first, while the
  // person's session can still be matched to their folder.
  let voiceNotesDeleted = 0;
  try {
    voiceNotesDeleted = await deleteVoiceNotes(ownerId);
  } catch (error) {
    console.error("[account-delete] voice notes", ownerId, error);
    return NextResponse.json({ ok: false, error: "Failed to delete voice notes. Please try again." }, { status: 500 });
  }

  // Explicit per-table deletes rather than relying on FK cascade behavior - some tables
  // (nura_messages.plan_id) use ON DELETE SET NULL rather than CASCADE, so deleting Journeys
  // first wouldn't necessarily clear everything else on its own.
  const tables = [
    "nura_health_signals",
    "nura_health_daily",
    "nura_health_connections",
    "nura_plan_steps",
    "nura_plan_milestones",
    "nura_observations",
    "nura_source_contexts",
    "nura_check_ins",
    "nura_calendar_events",
    "nura_appointment_summaries",
    "nura_channel_links",
    "nura_messages",
    "nura_care_recipients",
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

  // Recordings held by ElevenLabs. A failure here is logged with the ids so it can be cleared
  // by hand; the person's account data above is already gone either way.
  const results = await Promise.all(conversationIds.map((id) => deleteConversation(id)));
  const recordingsLeft = conversationIds.filter((_, i) => !results[i]);
  if (recordingsLeft.length) {
    console.error("[account-delete] ElevenLabs conversations not deleted", ownerId, recordingsLeft);
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
    voiceNotesDeleted,
    callRecordingsDeleted: conversationIds.length - recordingsLeft.length,
    message: authAccountDeleted
      ? "Your account and all data have been permanently deleted."
      : "All your data has been permanently deleted. Your login credential could not be removed automatically right now - it will be cleared shortly, or contact support.",
  });
}
