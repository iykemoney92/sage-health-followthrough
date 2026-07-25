import type { SupabaseClient } from "@supabase/supabase-js";

export async function buildVoiceCheckinContext(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string,
  userName?: string,
) {
  const { data: plan } = await supabase
    .from("nura_plans")
    .select("id, title, why_this_exists, current_focus, next_step")
    .eq("id", planId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!plan) return null;

  const [{ data: observations }, { data: contexts }, { data: nextCheckIn }] = await Promise.all([
    supabase.from("nura_observations").select("label, value, recorded_at").eq("owner_id", ownerId).eq("plan_id", planId).order("recorded_at", { ascending: false }).limit(8),
    supabase.from("nura_source_contexts").select("kind, title, summary, requires_user_confirmation").eq("owner_id", ownerId).eq("plan_id", planId).order("created_at", { ascending: false }).limit(8),
    supabase.from("nura_check_ins").select("scheduled_for, prompt, channel").eq("owner_id", ownerId).eq("plan_id", planId).is("completed_at", null).order("scheduled_for", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const contextText = [
    `Thread: ${plan.title}`,
    `Why this exists: ${plan.why_this_exists}`,
    `Current focus: ${plan.current_focus}`,
    `Next step: ${plan.next_step}`,
    contexts && contexts.length > 0 ? `Thread context:\n${contexts.map((item) => `- ${item.title}: ${item.summary}${item.requires_user_confirmation ? " (needs user confirmation)" : ""}`).join("\n")}` : "",
    observations && observations.length > 0 ? `Recent user updates:\n${observations.map((item) => `- ${item.label}: ${item.value}`).join("\n")}` : "",
    nextCheckIn ? `Scheduled check-in objective: ${nextCheckIn.prompt}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    dynamicVariables: {
      user_name: userName ?? "there",
      user_id: ownerId,
      plan_id: plan.id as string,
      thread_title: plan.title as string,
      thread_context: contextText,
      checkin_goal: (nextCheckIn?.prompt as string | undefined) ?? (plan.next_step as string),
    },
    systemPrompt:
      "You are Nura, a warm AI health companion doing a short check-in call. " +
      "Use only the supplied thread_context and checkin_goal. Do not diagnose, prescribe, change medication, or provide emergency guidance beyond telling the user to seek urgent/emergency care if needed. " +
      "Ask concise follow-up questions, record user-reported updates, and confirm before turning clinician instructions into reminders.",
  };
}
