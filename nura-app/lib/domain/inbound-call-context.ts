import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAgentOwnerId } from "@/lib/agent/resolve-owner";
import { buildVoiceCheckinContext, NO_CIRCLE_PASS_ON } from "@/lib/domain/voice-checkin-context";

/**
 * Context for a call someone places INTO Nura (WhatsApp calling on Nura's number).
 *
 * ElevenLabs starts inbound calls with no dynamic variables, and the agent's first message and
 * prompt need them, so without this the call is answered and then dropped in about a second
 * ("Missing required dynamic variables"). The dashboard placeholders are test values only and
 * are not used on real calls. ElevenLabs calls our conversation-initiation webhook instead, and
 * this builds what it returns.
 *
 * Every variable the agent's prompt uses is always filled, even when something fails, because a
 * missing one drops the call.
 */

export type InboundCallVariables = {
  user_name: string;
  thread_title: string;
  thread_context: string;
  checkin_goal: string;
  persona_guidance: string;
  knowledge_brief: string;
  circle_pass_on: string;
  call_brief: string;
  on_behalf_of: string;
  [key: string]: string;
};

export type InboundCallContext = {
  dynamicVariables: InboundCallVariables;
  firstMessage: string;
  matched: "owner" | "unknown";
};

export function inboundOwnerCallBrief(firstName: string) {
  if (firstName === "there") {
    return [
      "The account holder has called Nura themselves on WhatsApp, matched by their WhatsApp number. We don't have a name to use for them.",
      "This is NOT a scheduled check-in and it overrides the Call purpose section below: you did not call them, so never say you said you'd check in or that you're calling about something.",
      "Don't call them \"there\" as if it were a name. You may ask what they'd like to be called.",
      "Ask how they are and what's on their mind, and follow their lead. The Care plan below is the one most likely on their mind, so bring it up only if it fits.",
      "If they want a follow-up, use schedule_checkin as usual.",
    ].join(" ");
  }
  return [
    `${firstName} has called Nura themselves on WhatsApp - this is the account holder, matched by their WhatsApp number.`,
    "This is NOT a scheduled check-in and it overrides the Call purpose section below: you did not call them, so never say you said you'd check in or that you're calling about something.",
    `Your opening line already greeted ${firstName} by name. If they say they aren't ${firstName}, follow the someone-else-answers rules below.`,
    "Ask how they are and what's on their mind, and follow their lead. The Care plan below is the one most likely on their mind, so bring it up only if it fits.",
    "If they want a follow-up, use schedule_checkin as usual.",
  ].join(" ");
}

export const UNKNOWN_CALLER_BRIEF = [
  "This person called Nura's WhatsApp number themselves and their number is not linked to a Nura account.",
  "This overrides the Call purpose section below: there is no Care plan and no scheduled check-in, and you know nothing about them - never pretend you do.",
  "Be warm and brief. Ask their name. If they want to know what Nura is: a health and wellbeing companion that checks in on you by phone call, WhatsApp or the app between appointments, and they can start free at usenura.app (say \"use nura dot app\").",
  "Answer simple questions about Nura. Don't collect health details or set up anything on this call, and don't use schedule_checkin, pass_on_to_circle or stop_calls.",
  "If they say they already use Nura, suggest they add this WhatsApp number in the app's settings so Nura recognises them next time.",
  "The safety rules below still apply in full.",
].join(" ");

export function inboundOwnerOpeningLine(firstName: string) {
  const name = firstName.trim();
  return name && name.toLowerCase() !== "there"
    ? `Hi ${name}, it's Nura - lovely to hear from you. How are you doing?`
    : "Hi, it's Nura - lovely to hear from you. How are you doing?";
}

export const UNKNOWN_CALLER_OPENING_LINE = "Hi, it's Nura - who am I speaking with?";

export function unknownCallerContext(): InboundCallContext {
  return {
    matched: "unknown",
    firstMessage: UNKNOWN_CALLER_OPENING_LINE,
    dynamicVariables: {
      user_name: "there",
      thread_title: "an incoming call",
      thread_context: "None - this caller has no Nura account linked to their number.",
      checkin_goal: "None - they called Nura; find out what they'd like.",
      persona_guidance: "Use core Nura identity and safety boundaries.",
      knowledge_brief: "Use core Nura safety boundaries.",
      circle_pass_on: NO_CIRCLE_PASS_ON,
      call_brief: UNKNOWN_CALLER_BRIEF,
      on_behalf_of: "",
    },
  };
}

/** First name to say out loud. Some accounts have their email as the display name - never read that out. */
export function spokenFirstName(displayName: string | null | undefined) {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  return first && !first.includes("@") ? first : "there";
}

function digitsOnly(value: string | null | undefined) {
  return value ? value.replace(/[^\d]/g, "") : "";
}

/** The plan with the nearest open check-in, else the most recently touched active plan. */
async function pickPlanForInboundCall(supabase: SupabaseClient, ownerId: string): Promise<string | null> {
  const { data: plans } = await supabase
    .from("nura_plans")
    .select("id, updated_at")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);
  const planIds = (plans ?? []).map((p) => p.id as string);
  if (planIds.length === 0) return null;

  const { data: next } = await supabase
    .from("nura_check_ins")
    .select("plan_id")
    .eq("owner_id", ownerId)
    .in("plan_id", planIds)
    .is("completed_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (next?.plan_id as string | undefined) ?? planIds[0];
}

export async function buildInboundCallContext(
  supabase: SupabaseClient,
  callerId: string | null | undefined,
): Promise<InboundCallContext> {
  const phone = digitsOnly(callerId);
  if (!phone) return unknownCallerContext();

  const resolved = await resolveAgentOwnerId(supabase, { callerPhoneDigits: phone });
  // Only the account holder's own number gets their account. A person someone cares for
  // (care_recipient) calling in gets the generic welcome: their calls are about the owner's plan
  // and are only ever placed by Nura with the owner's set-up.
  if (!resolved.ownerId || (resolved.via !== "profile_phone" && resolved.via !== "whatsapp_link")) {
    return unknownCallerContext();
  }
  const ownerId = resolved.ownerId;

  const { data: profile } = await supabase.from("nura_profiles").select("display_name").eq("id", ownerId).maybeSingle();
  const firstName = spokenFirstName(profile?.display_name as string | null);

  const base = {
    user_name: firstName,
    user_id: ownerId,
    persona_guidance: "Use core Nura identity and safety boundaries.",
    knowledge_brief: "Use core Nura safety boundaries.",
    circle_pass_on: NO_CIRCLE_PASS_ON,
    call_brief: inboundOwnerCallBrief(firstName),
    on_behalf_of: "",
  };

  const planId = await pickPlanForInboundCall(supabase, ownerId);
  const planContext = planId ? await buildVoiceCheckinContext(supabase, ownerId, planId, firstName) : null;

  if (!planContext) {
    return {
      matched: "owner",
      firstMessage: inboundOwnerOpeningLine(firstName),
      dynamicVariables: {
        ...base,
        thread_title: "how they've been",
        thread_context: "They have no active Care plan right now.",
        checkin_goal: "None - they called Nura; ask how they are and what's on their mind.",
      },
    };
  }

  const vars = planContext.dynamicVariables;
  return {
    matched: "owner",
    firstMessage: inboundOwnerOpeningLine(firstName),
    dynamicVariables: {
      ...base,
      plan_id: vars.plan_id,
      thread_title: vars.thread_title || "how they've been",
      thread_context: vars.thread_context || "None.",
      checkin_goal: vars.checkin_goal || "None - they called Nura; ask how they are.",
      persona_guidance: vars.persona_guidance || base.persona_guidance,
      knowledge_brief: vars.knowledge_brief || base.knowledge_brief,
      circle_pass_on: vars.circle_pass_on || NO_CIRCLE_PASS_ON,
      user_timezone: vars.user_timezone,
      user_local_now: vars.user_local_now,
      journey_category: vars.journey_category,
    },
  };
}
