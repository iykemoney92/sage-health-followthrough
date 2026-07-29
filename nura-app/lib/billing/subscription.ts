import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLUS_ENTITLEMENT_ID = "plus";
export const FREE_THREAD_LIMIT = 1;

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

function trialEndFromStart(value: string | null | undefined) {
  if (!value) return null;
  const startedAt = new Date(value);
  if (Number.isNaN(startedAt.getTime())) return null;
  startedAt.setDate(startedAt.getDate() + 7);
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
  const status = ["trialing", "active", "grace_period", "cancelled", "expired"].includes(profile.subscription_status ?? "")
    ? profile.subscription_status as SubscriptionAccess["status"]
    : "free";
  const trialEndsAt = profile.trial_ends_at ?? trialEndFromStart(profile.trial_started_at);
  const paidUntil = profile.subscription_current_period_ends_at;
  const activePaidStatus = status === "active" || status === "grace_period" || (status === "cancelled" && isFuture(paidUntil));
  const hasPlus = (tier === "plus" && activePaidStatus) || (status === "trialing" && isFuture(trialEndsAt));

  return {
    tier,
    status,
    hasPlus,
    trialEndsAt: trialEndsAt ?? null,
    currentPeriodEndsAt: paidUntil ?? null,
  };
}

export async function ensureTrialStarted(supabase: SupabaseClient, ownerId: string) {
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
  endsAt.setDate(endsAt.getDate() + 7);

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
  existingThreadCount: number,
  isCreatingNewThread: boolean,
) {
  if (!isCreatingNewThread || existingThreadCount < FREE_THREAD_LIMIT) return null;
  const access = await getSubscriptionAccess(supabase, ownerId);
  return access.hasPlus ? null : plusRequiredResponse("threads");
}
