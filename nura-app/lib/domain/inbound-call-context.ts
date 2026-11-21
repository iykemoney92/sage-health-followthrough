import type { SupabaseClient } from "@supabase/supabase-js";
import { isNuraSystemPhone } from "@/lib/agent/resolve-owner";
import { NO_CIRCLE_PASS_ON } from "@/lib/domain/voice-checkin-context";
import { guessTimeZoneFromPhoneDigits } from "@/lib/timezone";

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

type InboundPlanRow = {
  id: string;
  title: string | null;
  category: string | null;
  why_this_exists: string | null;
  current_focus: string | null;
  next_step: string | null;
};

/**
 * Who is calling: the account whose own phone or active WhatsApp link matches. Person someone
 * cares for (care_recipient) is deliberately not matched: their calls are about the owner's plan
 * and are only ever placed by Nura, so calling in gets them the generic welcome.
 */
async function findOwnerByPhone(supabase: SupabaseClient, phone: string) {
  const [links, profiles] = await Promise.all([
    supabase
      .from("nura_channel_links")
      .select("owner_id")
      .eq("provider", "whatsapp")
      .eq("channel_identifier", phone)
      .eq("status", "active")
      .limit(1),
    supabase.from("nura_profiles").select("id, display_name").eq("phone", phone).limit(2),
  ]);
  const rows = (profiles.data ?? []) as { id: string; display_name: string | null }[];
  // A verified WhatsApp link wins. Otherwise the phone must belong to exactly one profile: some
  // numbers sit on several accounts, and a wrong guess would read one account's plans to another.
  const linkedOwner = links.data?.[0]?.owner_id as string | undefined;
  if (linkedOwner) {
    const linkedProfile = rows.find((row) => row.id === linkedOwner);
    return { ownerId: linkedOwner, displayName: linkedProfile?.display_name ?? null, haveName: Boolean(linkedProfile) };
  }
  if (rows.length === 1) return { ownerId: rows[0].id, displayName: rows[0].display_name, haveName: true };
  return null;
}

/**
 * ElevenLabs waits on this before the call can connect, and gives up quickly (a 1.9s reply was
 * too slow on 21 Nov). So: two parallel round trips, no per-plan deep context.
 */
export async function buildInboundCallContext(
  supabase: SupabaseClient,
  callerId: string | null | undefined,
): Promise<InboundCallContext> {
  const phone = digitsOnly(callerId);
  if (!phone || isNuraSystemPhone(phone)) return unknownCallerContext();

  const owner = await findOwnerByPhone(supabase, phone);
  if (!owner) return unknownCallerContext();
  const { ownerId } = owner;

  const [profileRes, plansRes, nextRes] = await Promise.all([
    owner.haveName
      ? Promise.resolve({ data: { display_name: owner.displayName } })
      : supabase.from("nura_profiles").select("display_name").eq("id", ownerId).maybeSingle(),
    supabase
      .from("nura_plans")
      .select("id, title, category, why_this_exists, current_focus, next_step")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("nura_check_ins")
      .select("plan_id, prompt")
      .eq("owner_id", ownerId)
      .is("completed_at", null)
      .order("scheduled_for", { ascending: true })
      .limit(1),
  ]);

  const firstName = spokenFirstName((profileRes.data?.display_name as string | null | undefined) ?? null);
  const plans = (plansRes.data ?? []) as InboundPlanRow[];
  const next = nextRes.data?.[0] as { plan_id: string; prompt: string | null } | undefined;
  const plan = plans.find((p) => p.id === next?.plan_id) ?? plans[0];
  const timeZone = guessTimeZoneFromPhoneDigits(phone) ?? "Europe/London";

  const base = {
    user_name: firstName,
    user_id: ownerId,
    persona_guidance: "Use core Nura identity and safety boundaries.",
    knowledge_brief: "Use core Nura safety boundaries.",
    circle_pass_on: NO_CIRCLE_PASS_ON,
    call_brief: inboundOwnerCallBrief(firstName),
    on_behalf_of: "",
    user_timezone: timeZone,
  };

  if (!plan) {
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

  const others = plans.filter((p) => p.id !== plan.id).map((p) => p.title).filter(Boolean);
  const threadContext = [
    `Care plan: ${plan.title ?? "their plan"}`,
    plan.why_this_exists ? `Why this exists: ${plan.why_this_exists}` : "",
    plan.current_focus ? `Current focus: ${plan.current_focus}` : "",
    plan.next_step ? `Next step: ${plan.next_step}` : "",
    others.length > 0 ? `Their other active Care plans: ${others.join(", ")}` : "",
    `Their timezone is probably ${timeZone} (from their number); confirm before scheduling a clock time.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    matched: "owner",
    firstMessage: inboundOwnerOpeningLine(firstName),
    dynamicVariables: {
      ...base,
      plan_id: plan.id,
      thread_title: plan.title || "how they've been",
      thread_context: threadContext,
      checkin_goal:
        (next?.plan_id === plan.id ? next.prompt : null) || plan.next_step || "None - they called Nura; ask how they are.",
      journey_category: plan.category ?? "general_health",
    },
  };
}
