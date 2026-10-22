import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAgentContext } from "@/lib/agent/persona-config";
import { NURA_CORE_IDENTITY, NURA_SAFETY_BOUNDARIES } from "@/lib/domain/nura-persona";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";
import { describeNowForTimeZone } from "@/lib/timezone";
import {
  OWNER_CALL_BRIEF,
  recipientCallBrief,
  recipientOpeningLine,
  recipientThreadContext,
  type CareRecipient,
} from "@/lib/care-recipient";

export const NO_CIRCLE_PASS_ON = "No Care circle on this Journey. Never offer to pass anything on to anyone.";

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The end-of-call "anything to pass on?" instruction, sent as the circle_pass_on dynamic
 * variable. The agent's prompt carries the general rule; this names who is in the circle and
 * restates the consent steps so they hold even if the dashboard prompt drifts.
 */
export function circlePassOnBrief(memberFirstNames: string[] | null) {
  if (memberFirstNames && memberFirstNames.length === 0) return NO_CIRCLE_PASS_ON;
  // null = there is a circle but we couldn't read their names (session client).
  const who = !memberFirstNames
    ? "your Care circle"
    : memberFirstNames.length > 3
      ? `${memberFirstNames.slice(0, 3).join(", ")} and the others in your Care circle`
      : joinNames(memberFirstNames);
  return [
    `The user has shared this Journey with their Care circle${memberFirstNames ? ` (${joinNames(memberFirstNames)})` : ""}. The circle can see the plan and check-ins, never this conversation.`,
    `Near the end of the call, after you've confirmed what you heard, ask once and lightly: "Before I go, is there anything you'd like me to pass on to ${who} this week?"`,
    "If they say no or hesitate, say that's completely fine and move on. Never ask twice and never suggest what they could say.",
    `If they give you a message, read it back in their own words and ask "Shall I send that to ${who}?". Only after a clear yes, call the pass_on_to_circle tool with exactly that message, in their words.`,
    "Never add anything else from this call: no symptoms, moods, scores or details they didn't ask you to pass on.",
    "Skip this entirely if they mentioned feeling unsafe, a crisis, or anything that needed urgent help on this call.",
  ].join(" ");
}

async function circleMemberFirstNames(supabase: SupabaseClient, planId: string): Promise<string[] | null> {
  const { data: members } = await supabase.from("nura_plan_members").select("member_id").eq("plan_id", planId).is("revoked_at", null);
  if (!members || members.length === 0) return [];
  const ids = members.map((m) => m.member_id as string);
  // Profiles of other people are only readable with the service role (the scheduled call path).
  // A session client gets nothing back here, and the brief falls back to "your Care circle".
  const { data: profiles } = await supabase.from("nura_profiles").select("id, display_name").in("id", ids);
  const names = (profiles ?? [])
    .map((p) => ((p.display_name as string | null) ?? "").trim().split(/\s+/)[0])
    .filter(Boolean);
  return names.length === ids.length ? names : null;
}

/** Set when the call goes to the person a plan is about, not the account owner. */
export type RecipientCallOptions = {
  recipient: CareRecipient;
  ownerFirstName: string;
  isFirstCall: boolean;
};

export async function buildVoiceCheckinContext(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string,
  userName?: string,
  recipientCall?: RecipientCallOptions,
) {
  if (recipientCall) return buildRecipientCallContext(supabase, ownerId, planId, recipientCall);

  const { data: plan } = await supabase
    .from("nura_plans")
    .select("id, title, category, why_this_exists, current_focus, next_step")
    .eq("id", planId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!plan) return null;

  const [{ data: observations }, { data: contexts }, { data: nextCheckIn }, timeZone, circleNames] = await Promise.all([
    supabase.from("nura_observations").select("label, value, recorded_at").eq("owner_id", ownerId).eq("plan_id", planId).order("recorded_at", { ascending: false }).limit(8),
    supabase.from("nura_source_contexts").select("kind, title, summary, requires_user_confirmation").eq("owner_id", ownerId).eq("plan_id", planId).order("created_at", { ascending: false }).limit(8),
    supabase.from("nura_check_ins").select("scheduled_for, prompt, channel").eq("owner_id", ownerId).eq("plan_id", planId).is("completed_at", null).order("scheduled_for", { ascending: true }).limit(1).maybeSingle(),
    resolveUserTimeZone(supabase, ownerId),
    circleMemberFirstNames(supabase, planId).catch(() => [] as string[]),
  ]);

  const nowInfo = describeNowForTimeZone(timeZone);
  const agentContext = buildAgentContext({
    primaryCategory: plan.category as string | null,
    surface: "voice",
  });

  const contextText = [
    `Care plan: ${plan.title}`,
    `Category: ${plan.category ?? "general_health"}`,
    `Persona: ${agentContext.personaLabel}`,
    `Why this exists: ${plan.why_this_exists}`,
    `Current focus: ${plan.current_focus}`,
    `Next step: ${plan.next_step}`,
    `User timezone: ${timeZone}. Local time now: ${nowInfo.localLabel}. When scheduling a follow-up, use this timezone — never treat their wall-clock time as UTC.`,
    contexts && contexts.length > 0 ? `Care plan context:\n${contexts.map((item) => `- ${item.title}: ${item.summary}${item.requires_user_confirmation ? " (needs user confirmation)" : ""}`).join("\n")}` : "",
    observations && observations.length > 0 ? `Recent user updates:\n${observations.map((item) => `- ${item.label}: ${item.value}`).join("\n")}` : "",
    nextCheckIn ? `Scheduled check-in objective: ${nextCheckIn.prompt}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = [
    NURA_CORE_IDENTITY,
    "You are doing a short check-in call.",
    agentContext.persona.roleOverlay,
    NURA_SAFETY_BOUNDARIES,
    "Use only the supplied thread_context, persona_guidance, knowledge_brief, and checkin_goal.",
    "Ask concise follow-up questions, record user-reported updates, and confirm before turning clinician instructions into reminders.",
    `The user's timezone is ${timeZone} (local now: ${nowInfo.localLabel}). When they ask to schedule a follow-up at a clock time, use that timezone and pass ISO datetimes with the correct offset — never treat their local time as UTC.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    dynamicVariables: {
      user_name: userName ?? "there",
      user_id: ownerId,
      plan_id: plan.id as string,
      thread_title: plan.title as string,
      thread_context: contextText,
      checkin_goal: (nextCheckIn?.prompt as string | undefined) ?? (plan.next_step as string),
      persona_label: agentContext.personaLabel,
      persona_guidance: agentContext.persona.roleOverlay || NURA_CORE_IDENTITY,
      knowledge_brief: agentContext.knowledgeBrief || "Use core Nura safety boundaries.",
      journey_category: String(plan.category ?? "general_health"),
      user_timezone: timeZone,
      user_local_now: nowInfo.localLabel,
      circle_pass_on: circlePassOnBrief(circleNames),
      call_brief: OWNER_CALL_BRIEF,
      on_behalf_of: "",
    },
    systemPrompt,
    elevenLabsAgentId: agentContext.elevenLabsAgentId,
    voiceParams: agentContext.voiceParams,
    firstMessage: undefined as string | undefined,
  };
}

/**
 * Context for a call to the person a plan is about. Deliberately thin: the plan's own title,
 * focus and next step, in their time zone - never the owner's messages, uploads, observations or
 * anything else the owner told Nura. Anything they pass on goes to the owner.
 */
async function buildRecipientCallContext(
  supabase: SupabaseClient,
  ownerId: string,
  planId: string,
  { recipient, ownerFirstName, isFirstCall }: RecipientCallOptions,
) {
  const { data: plan } = await supabase
    .from("nura_plans")
    .select("id, title, category, current_focus, next_step")
    .eq("id", planId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!plan) return null;

  const { data: nextCheckIn } = await supabase
    .from("nura_check_ins")
    .select("prompt")
    .eq("owner_id", ownerId)
    .eq("plan_id", planId)
    .is("completed_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  const timeZone = recipient.time_zone;
  const nowInfo = describeNowForTimeZone(timeZone);
  const agentContext = buildAgentContext({ primaryCategory: plan.category as string | null, surface: "voice" });
  const title = plan.title as string;

  return {
    dynamicVariables: {
      user_name: recipient.first_name,
      user_id: ownerId,
      plan_id: plan.id as string,
      thread_title: title,
      thread_context: recipientThreadContext(
        {
          title,
          category: plan.category as string | null,
          current_focus: plan.current_focus as string | null,
          next_step: plan.next_step as string | null,
        },
        timeZone,
        nowInfo.localLabel,
      ),
      checkin_goal: (nextCheckIn?.prompt as string | undefined) ?? (plan.next_step as string),
      persona_label: agentContext.personaLabel,
      persona_guidance: agentContext.persona.roleOverlay || NURA_CORE_IDENTITY,
      knowledge_brief: agentContext.knowledgeBrief || "Use core Nura safety boundaries.",
      journey_category: String(plan.category ?? "general_health"),
      user_timezone: timeZone,
      user_local_now: nowInfo.localLabel,
      circle_pass_on: circlePassOnBrief([ownerFirstName]),
      call_brief: recipientCallBrief(recipient.first_name, ownerFirstName, isFirstCall),
      on_behalf_of: ownerFirstName,
    },
    systemPrompt: [NURA_CORE_IDENTITY, NURA_SAFETY_BOUNDARIES].join(" "),
    elevenLabsAgentId: agentContext.elevenLabsAgentId,
    voiceParams: agentContext.voiceParams,
    firstMessage: recipientOpeningLine(recipient.first_name, ownerFirstName, title, isFirstCall) as string | undefined,
  };
}
