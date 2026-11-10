/**
 * Two emails for people who would otherwise hear nothing (10 Nov 2026):
 *
 * - Setup nudge: a sign-up that stopped part-way through onboarding gets one
 *   reminder after 24 hours. Before this, Nura had none (Vangie does), and new
 *   sign-ups who stopped on the first screen were never asked back.
 * - Plus skip notice: a check-in skipped because it needs Plus used to vanish
 *   silently, so a free user who had booked daily check-ins just stopped
 *   hearing from Nura and thought it was broken. Now they're told, at most
 *   once a week.
 *
 * Both run inside jobs that already exist (no new crons) and remember what
 * they sent in auth user_metadata, so no migration is needed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  nuraEmailLogoAttachment,
  onboardingNudgeEmailHtml,
  onboardingNudgeEmailText,
  plusSkipNoticeEmailHtml,
  plusSkipNoticeEmailText,
  sendAuthEmail,
} from "@/lib/integrations/resend";

export const ONBOARDING_NUDGE_KEY = "onboarding_nudge_sent_at";
export const PLUS_SKIP_NOTICE_KEY = "plus_skip_notice_sent_at";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Wait this long after sign-up before nudging. */
export const ONBOARDING_NUDGE_AFTER_MS = DAY;
/** Don't nudge sign-ups older than this; they've moved on. */
export const ONBOARDING_NUDGE_MAX_AGE_MS = 7 * DAY;
/** At most one skip notice per person per week. */
export const PLUS_SKIP_NOTICE_EVERY_MS = 7 * DAY;

/** Addresses that would only bounce, or are ours. */
const NO_SEND =
  /(@example\.(com|org|net)$|\.test$|@privaterelay\.appleid\.com$|yopmail|mailinator|ikanasiudu|ikmaniservices|aistudioplus77|labszapx|iykemoney|@zapxlabs\.com$|@usenura\.app$)/i;

export function canEmail(email: string | null | undefined): email is string {
  return !!email && !NO_SEND.test(email.trim());
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://usenura.app").replace(/\/$/, "");
}

function firstNameOf(meta: Record<string, unknown>): string | undefined {
  const raw = [meta.display_name, meta.full_name, meta.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return raw?.trim().split(/\s+/)[0] || undefined;
}

type AuthUserLike = {
  id: string;
  email?: string | null;
  created_at?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Pure check, so it can be tested without Supabase. */
export function needsOnboardingNudge(user: AuthUserLike, now: number): boolean {
  const meta = user.user_metadata ?? {};
  if (meta.onboarding_complete === true || meta.joined_via_care_circle === true) return false;
  if (meta[ONBOARDING_NUDGE_KEY]) return false;
  if (!user.email_confirmed_at || !canEmail(user.email)) return false;
  const age = now - new Date(user.created_at ?? 0).getTime();
  return age >= ONBOARDING_NUDGE_AFTER_MS && age <= ONBOARDING_NUDGE_MAX_AGE_MS;
}

/** Pure check for the weekly cap. */
export function skipNoticeDue(meta: Record<string, unknown> | null | undefined, now: number): boolean {
  const last = meta?.[PLUS_SKIP_NOTICE_KEY];
  if (typeof last !== "string") return true;
  const at = new Date(last).getTime();
  return !Number.isFinite(at) || now - at >= PLUS_SKIP_NOTICE_EVERY_MS;
}

async function remember(supabase: SupabaseClient, user: AuthUserLike, key: string, at: string) {
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata ?? {}), [key]: at },
  });
}

export async function sendOnboardingNudges(supabase: SupabaseClient, now = Date.now()) {
  let sent = 0;
  let failed = 0;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = (data?.users ?? []) as AuthUserLike[];
    for (const user of users) {
      if (!needsOnboardingNudge(user, now)) continue;
      const input = { onboardingUrl: `${appBaseUrl()}/onboarding`, firstName: firstNameOf(user.user_metadata ?? {}) };
      const result = await sendAuthEmail({
        to: user.email as string,
        subject: "Finish setting up Nura (about two minutes)",
        html: onboardingNudgeEmailHtml(input),
        text: onboardingNudgeEmailText(input),
        idempotencyKey: `onboarding-nudge:${user.id}`,
        attachments: nuraEmailLogoAttachment(),
        optOut: true,
      });
      if (!result.ok) {
        failed += 1;
        console.error("[nudges] onboarding nudge failed", user.id, result.error);
        continue;
      }
      await remember(supabase, user, ONBOARDING_NUDGE_KEY, new Date(now).toISOString());
      sent += 1;
    }
    if (users.length < 1000) break;
  }
  return { sent, failed };
}

/** Called with the check-ins the job just skipped for Plus. One email per person, the soonest plan named. */
export async function sendPlusSkipNotices(
  supabase: SupabaseClient,
  skipped: Array<{ owner_id: string; scheduled_for: string; nura_plans?: { title?: string } | null }>,
  now = Date.now(),
) {
  const byOwner = new Map<string, string>();
  for (const c of [...skipped].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))) {
    if (!byOwner.has(c.owner_id)) byOwner.set(c.owner_id, c.nura_plans?.title?.trim() || "your Care plan");
  }
  let sent = 0;
  for (const [ownerId, planTitle] of byOwner) {
    try {
      const { data } = await supabase.auth.admin.getUserById(ownerId);
      const user = data?.user as AuthUserLike | undefined;
      if (!user || !canEmail(user.email) || !skipNoticeDue(user.user_metadata, now)) continue;
      const input = { billingUrl: `${appBaseUrl()}/billing`, planTitle, firstName: firstNameOf(user.user_metadata ?? {}) };
      const result = await sendAuthEmail({
        to: user.email as string,
        subject: `Nura: your check-in about ${planTitle} didn't go out`,
        html: plusSkipNoticeEmailHtml(input),
        text: plusSkipNoticeEmailText(input),
        idempotencyKey: `plus-skip-notice:${ownerId}:${new Date(now).toISOString().slice(0, 10)}`,
        attachments: nuraEmailLogoAttachment(),
        optOut: true,
      });
      if (!result.ok) {
        console.error("[nudges] skip notice failed", ownerId, result.error);
        continue;
      }
      await remember(supabase, user, PLUS_SKIP_NOTICE_KEY, new Date(now).toISOString());
      sent += 1;
    } catch (error) {
      console.error("[nudges] skip notice error", ownerId, error);
    }
  }
  return { sent };
}
