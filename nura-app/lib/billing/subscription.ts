import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_TRIAL_DAYS, SOFT_TRIAL_DAYS } from "@/lib/billing/trial";

export const PLUS_ENTITLEMENT_ID = "plus";
export const FREE_THREAD_LIMIT = 1;
/** Days before trial end to send the renewal reminder email. */
export const TRIAL_REMINDER_DAYS_BEFORE = 4;

export type SubscriptionAccess = {
  tier: "free" | "plus";
  status: "free" | "trialing" | "active" | "grace_period" | "cancelled" | "expired";
  hasPlus: boolean;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
};

type ProfileSubscriptionRow = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_current_period_ends_at?: string | null;
};

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function trialEndFromStart(value: string | null | undefined, days = CARD_TRIAL_DAYS) {
  if (!value) return null;
  const startedAt = new Date(value);
  if (Number.isNaN(startedAt.getTime())) return null;
  startedAt.setDate(startedAt.getDate() + days);
  return startedAt.toISOString();
}

export async function getSubscriptionAccess(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<SubscriptionAccess> {
  const { data } = await supabase
    .from("nura_profiles")
    .select("subscription_tier, subscription_status, trial_started_at, trial_ends_at, subscription_current_period_ends_at")
    .eq("id", ownerId)
    .maybeSingle();

  const profile = (data ?? {}) as ProfileSubscriptionRow;
  const tier = profile.subscription_tier === "plus" ? "plus" : "free";
  let status = ["trialing", "active", "grace_period", "cancelled", "expired"].includes(profile.subscription_status ?? "")
    ? profile.subscription_status as SubscriptionAccess["status"]
    : "free";
  const trialEndsAt = profile.trial_ends_at ?? trialEndFromStart(profile.trial_started_at);
  const paidUntil = profile.subscription_current_period_ends_at;
  const activePaidStatus = status === "active" || status === "grace_period" || (status === "cancelled" && isFuture(paidUntil));
  const trialActive = status === "trialing" && isFuture(trialEndsAt);
  const hasPlus = (tier === "plus" && activePaidStatus) || trialActive;

  // Surface past trials as expired even if the webhook hasn't flipped the row yet.
  if (!hasPlus && status === "trialing" && trialEndsAt && !isFuture(trialEndsAt)) {
    status = "expired";
  }
  if (!hasPlus && status === "cancelled" && !isFuture(paidUntil)) {
    status = "expired";
  }

  return {
    tier: hasPlus ? tier : status === "expired" ? "free" : tier,
    status,
    hasPlus,
    trialEndsAt: trialEndsAt ?? null,
    currentPeriodEndsAt: paidUntil ?? null,
  };
}

/** True when the user previously had a trial/subscription that is no longer valid. */
export function isSubscriptionLockedOut(access: SubscriptionAccess) {
  if (access.hasPlus) return false;
  if (access.status === "expired") return true;
  if (access.status === "cancelled") return true;
  return Boolean(access.trialEndsAt && !isFuture(access.trialEndsAt));
}

/**
 * Persist expired status for trials/periods that have lapsed.
 * Must use a service-role client (subscription columns are protected from user writes).
 */
export async function markExpiredSubscriptionIfNeeded(
  supabase: SupabaseClient,
  ownerId: string,
  access?: SubscriptionAccess,
): Promise<SubscriptionAccess> {
  const current = access ?? (await getSubscriptionAccess(supabase, ownerId));
  if (current.hasPlus || current.status !== "expired") return current;

  const { data } = await supabase
    .from("nura_profiles")
    .select("subscription_status")
    .eq("id", ownerId)
    .maybeSingle();
  const stored = (data as ProfileSubscriptionRow | null)?.subscription_status;
  if (stored === "expired") return current;

  await supabase
    .from("nura_profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "expired",
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  return { ...current, tier: "free", status: "expired", hasPlus: false };
}

/** Starts a no-card soft trial (default 7 days). Skips if already trial/paid. */
export async function ensureTrialStarted(
  supabase: SupabaseClient,
  ownerId: string,
  days: number = SOFT_TRIAL_DAYS,
) {
  const { data } = await supabase
    .from("nura_profiles")
    .select("subscription_status, trial_started_at")
    .eq("id", ownerId)
    .maybeSingle();

  const profile = (data ?? {}) as ProfileSubscriptionRow;
  if (profile.trial_started_at || ["active", "grace_period", "cancelled"].includes(profile.subscription_status ?? "")) {
    return;
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setDate(endsAt.getDate() + days);

  await supabase
    .from("nura_profiles")
    .update({
      subscription_status: "trialing",
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      subscription_updated_at: startedAt.toISOString(),
    })
    .eq("id", ownerId);
}

export function plusRequiredResponse(feature: "voice" | "whatsapp" | "threads" | "journey") {
  return NextResponse.json({
    ok: false,
    error: "plus_required",
    feature,
    upgradeUrl: "/billing",
    message: "This is a Nura Plus feature. Start or renew Plus to keep using it.",
  }, { status: 402 });
}

export async function requirePlusAccess(
  supabase: SupabaseClient,
  ownerId: string,
  feature: "voice" | "whatsapp" | "threads" | "journey",
) {
  const access = await getSubscriptionAccess(supabase, ownerId);
  return access.hasPlus ? null : plusRequiredResponse(feature);
}

export async function enforceThreadLimit(
  supabase: SupabaseClient,
  ownerId: string,
  existingJourneyCount: number,
  isCreatingNewJourney: boolean,
) {
  if (!isCreatingNewJourney || existingJourneyCount < FREE_THREAD_LIMIT) return null;
  const access = await getSubscriptionAccess(supabase, ownerId);
  return access.hasPlus ? null : plusRequiredResponse("threads");
}
