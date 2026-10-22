import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getZonedParts, normalizeTimeZone, wallTimeInTimeZoneToUtcIso } from "@/lib/timezone";
import type { QuietHoursSettings } from "@/lib/profile-settings";

/**
 * Check in on someone you care for.
 *
 * A Care plan can be about another person (Mum, a partner). Their check-in calls ring them, not
 * the account owner, and only after they've agreed - by tapping Yes on a link the owner sends,
 * or by the owner confirming they agree on their behalf. They never have a Nura account; what we
 * hold about them lives in nura_care_recipients.
 */

export type RecipientRelationship = "parent" | "partner" | "grandparent" | "child" | "friend" | "other";
export type ConsentStatus = "pending" | "granted" | "declined" | "revoked";
export type ConsentMethod = "link" | "on_behalf";

export const RECIPIENT_RELATIONSHIPS: RecipientRelationship[] = [
  "parent",
  "partner",
  "grandparent",
  "child",
  "friend",
  "other",
];

export type CareRecipient = {
  id: string;
  plan_id: string;
  owner_id: string;
  first_name: string;
  relationship: RecipientRelationship;
  phone: string;
  time_zone: string;
  consent_status: ConsentStatus;
  consent_method: ConsentMethod | null;
  consent_at: string | null;
  consent_expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  first_checkin_prompt: string | null;
};

export const RECIPIENT_COLUMNS =
  "id, plan_id, owner_id, first_name, relationship, phone, time_zone, consent_status, consent_method, consent_at, consent_expires_at, revoked_at, revoke_reason, first_checkin_prompt";

/** Bumped whenever the wording on the agreement page changes; stored with each agreement. */
export const CONSENT_COPY_VERSION = "2026-10-23";

/** How long a "please agree" link stays usable for saying yes. */
export const CONSENT_LINK_TTL_DAYS = 7;
/** The same link keeps working as a "stop the calls" page for this long. */
export const CONSENT_STOP_TTL_DAYS = 365;
export const CONSENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,64}$/;

/** Calls to someone else only ring between these local hours, whatever the owner's settings. */
export const RECIPIENT_CALL_WINDOW = { startHour: 9, endHour: 20 } as const;

/** The same window expressed as quiet hours, for the shared quiet-hours helpers. */
export const RECIPIENT_QUIET_HOURS: QuietHoursSettings = {
  enabled: true,
  start: `${String(RECIPIENT_CALL_WINDOW.endHour).padStart(2, "0")}:00`,
  end: `${String(RECIPIENT_CALL_WINDOW.startHour).padStart(2, "0")}:00`,
  allowUrgent: false,
};

export function hashConsentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newConsentToken() {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + CONSENT_LINK_TTL_DAYS * 24 * 60 * 60_000).toISOString();
  return { token, hash: hashConsentToken(token), expiresAt };
}

export function consentUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/agree/${token}`;
}

export function firstNameOf(value: string | null | undefined, fallback = "there") {
  return (value ?? "").trim().split(/\s+/).filter(Boolean)[0] || fallback;
}

/** Digits only, no leading zeros or plus. Returns null unless it looks like a full international number. */
export function normalizeRecipientPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "").replace(/^0+/, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function maskPhone(digits: string) {
  return `•••${digits.slice(-4)}`;
}

/** The message the owner sends from their own phone, asking the person to agree. */
export function consentRequestText(ownerFirstName: string, recipientFirstName: string, planTitle: string, url: string) {
  return (
    `Hi ${recipientFirstName}, it's ${ownerFirstName}. I've set up Nura to give you a short phone call now and then ` +
    `about "${planTitle}", so I know how you're getting on. Could you tap here and say if that's OK? ${url}`
  );
}

export function whatsappConsentUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function smsConsentUrl(text: string) {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

export type ConsentShare = { url: string; text: string; whatsappUrl: string; smsUrl: string; expiresAt: string };

/** Everything the owner needs to send the agreement link from their own phone. */
export function buildConsentShare(
  origin: string,
  token: string,
  expiresAt: string,
  names: { ownerFirstName: string; recipientFirstName: string; planTitle: string },
): ConsentShare {
  const url = consentUrl(origin, token);
  const text = consentRequestText(names.ownerFirstName, names.recipientFirstName, names.planTitle, url);
  return { url, text, whatsappUrl: whatsappConsentUrl(text), smsUrl: smsConsentUrl(text), expiresAt };
}

/**
 * When the first call to someone should ring, once they've agreed: within the next half hour if
 * it's daytime where they are, otherwise 10am their time the next morning.
 */
export function firstRecipientCallTime(now: Date, timeZone: string): Date {
  const tz = normalizeTimeZone(timeZone);
  const parts = getZonedParts(now, tz);
  const soon = new Date(now.getTime() + 30 * 60_000);
  const soonHour = getZonedParts(soon, tz).hour;
  if (parts.hour >= RECIPIENT_CALL_WINDOW.startHour && soonHour < RECIPIENT_CALL_WINDOW.endHour - 1) {
    return soon;
  }
  const morning = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour >= RECIPIENT_CALL_WINDOW.startHour) morning.setUTCDate(morning.getUTCDate() + 1);
  const ymd = morning.toISOString().slice(0, 10);
  return new Date(wallTimeInTimeZoneToUtcIso(`${ymd}T10:00:00`, tz));
}

/**
 * What the voice agent is told about this call when it's to the person being cared for. Sent as
 * the call_brief dynamic variable. It names who set this up and the stop rule, and keeps the
 * owner's own conversation with Nura out of the call entirely.
 */
export function recipientCallBrief(recipientFirstName: string, ownerFirstName: string, isFirstCall: boolean) {
  return [
    `This call is to ${recipientFirstName}, not the account holder. ${ownerFirstName} set up this Journey to look after ${recipientFirstName} and asked you to check in with them.`,
    isFirstCall
      ? `This is your first call to ${recipientFirstName}. Say who you are and that ${ownerFirstName} set this up, in one short sentence, before anything else.`
      : `You have spoken with ${recipientFirstName} before.`,
    `Talk to ${recipientFirstName} directly, by name. Never repeat anything ${ownerFirstName} told you privately; only use the Journey details in thread_context.`,
    `Early in the call, and again if they seem unsure, let them know they can say "stop" at any time and you won't call again.`,
    `If ${recipientFirstName} says they don't want these calls, asks you to stop, or doesn't know what this is and doesn't want it: say that's completely fine, call the stop_calls tool, tell them you won't call again and that you'll let ${ownerFirstName} know, then end the call kindly.`,
    `Anything you pass on goes to ${ownerFirstName}.`,
  ].join(" ");
}

/** The opening line for a call to someone else, overriding the agent's default first message. */
export function recipientOpeningLine(recipientFirstName: string, ownerFirstName: string, planTitle: string, isFirstCall: boolean) {
  return isFirstCall
    ? `Hi ${recipientFirstName}, it's Nura, the assistant ${ownerFirstName} set up to check in with you about ${planTitle}. Is now an OK time for a quick chat?`
    : `Hi ${recipientFirstName}, it's Nura again, checking in about ${planTitle} like ${ownerFirstName} asked. Is now an OK time?`;
}

/** Default for the call_brief variable on ordinary calls to the account holder. */
export const OWNER_CALL_BRIEF = "This call is with the account holder themselves.";

/**
 * Journey details safe to read to the person being cared for: the plan itself, never the owner's
 * messages, uploads or notes. Kept pure so a test can pin that nothing else leaks in.
 */
export function recipientThreadContext(plan: {
  title: string;
  category?: string | null;
  current_focus?: string | null;
  next_step?: string | null;
}, timeZone: string, localNow: string) {
  return [
    `Care plan: ${plan.title}`,
    `Category: ${plan.category ?? "general_health"}`,
    plan.current_focus ? `Current focus: ${plan.current_focus}` : "",
    plan.next_step ? `Next step: ${plan.next_step}` : "",
    `Their timezone: ${timeZone}. Local time now: ${localNow}. When scheduling a follow-up, use this timezone - never treat their wall-clock time as UTC.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function loadRecipientForPlan(supabase: SupabaseClient, planId: string): Promise<CareRecipient | null> {
  const { data } = await supabase.from("nura_care_recipients").select(RECIPIENT_COLUMNS).eq("plan_id", planId).maybeSingle();
  return (data as CareRecipient | null) ?? null;
}

/** Recipients for a set of plans, keyed by plan id - one query for a whole dispatcher tick. */
export async function loadRecipientsForPlans(supabase: SupabaseClient, planIds: string[]): Promise<Map<string, CareRecipient>> {
  const unique = Array.from(new Set(planIds));
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("nura_care_recipients").select(RECIPIENT_COLUMNS).in("plan_id", unique);
  return new Map(((data ?? []) as CareRecipient[]).map((row) => [row.plan_id, row]));
}

/** Whether Nura has ever placed a call to this person before (decides the first-call wording). */
export async function hasCalledRecipientBefore(supabase: SupabaseClient, planId: string, exceptCheckInId?: string) {
  let query = supabase
    .from("nura_check_ins")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("call_status", "completed");
  if (exceptCheckInId) query = query.neq("id", exceptCheckInId);
  const { count } = await query;
  return (count ?? 0) > 0;
}
