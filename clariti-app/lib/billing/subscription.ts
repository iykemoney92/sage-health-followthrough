import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";

export const PLUS_ENTITLEMENT_ID = "plus";

/** Free-tier document analyses before Clariti Plus is required. */
export const FREE_DOCUMENT_LIMIT = 3;
/** Free-tier generated explainer videos before Clariti Plus is required. */
export const FREE_VIDEO_LIMIT = 1;

export type SubscriptionAccess = {
  tier: "free" | "plus";
  status: "free" | "trialing" | "active" | "grace_period" | "cancelled" | "expired";
  hasPlus: boolean;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  documentsAnalyzedCount: number;
  videosGeneratedCount: number;
};

type ProfileSubscriptionRow = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_current_period_ends_at?: string | null;
};

/** Actual analyzed-document count for this owner — derived from real rows, not a client-writable counter. */
export async function getDocumentAnalysisCount(supabase: SupabaseClient, ownerId: string) {
  const { count } = await supabase
    .from("clariti_documents")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("status", "extracted");
  return count ?? 0;
}

/** Actual generated-video count for this owner — derived from real rows, not a client-writable counter. */
export async function getVideoGenerationCount(supabase: SupabaseClient, ownerId: string) {
  const { count } = await supabase
    .from("clariti_video_generations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .in("status", ["queued", "scripting", "generating_scenes", "stitching", "completed"]);
  return count ?? 0;
}

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
  const [{ data }, documentsAnalyzedCount, videosGeneratedCount] = await Promise.all([
    supabase
      .from("clariti_profiles")
      .select(
        "subscription_tier, subscription_status, trial_started_at, trial_ends_at, subscription_current_period_ends_at",
      )
      .eq("id", ownerId)
      .maybeSingle(),
    getDocumentAnalysisCount(supabase, ownerId),
    getVideoGenerationCount(supabase, ownerId),
  ]);

  const profile = (data ?? {}) as ProfileSubscriptionRow;
  const tier = profile.subscription_tier === "plus" ? "plus" : "free";
  let status = ["trialing", "active", "grace_period", "cancelled", "expired"].includes(profile.subscription_status ?? "")
    ? (profile.subscription_status as SubscriptionAccess["status"])
    : "free";
  const trialEndsAt = profile.trial_ends_at ?? trialEndFromStart(profile.trial_started_at);
  const paidUntil = profile.subscription_current_period_ends_at ?? null;
  const activePaidStatus = status === "active" || status === "grace_period" || (status === "cancelled" && isFuture(paidUntil));
  const trialActive = status === "trialing" && isFuture(trialEndsAt);
  const hasPlus = (tier === "plus" && activePaidStatus) || trialActive;

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
    currentPeriodEndsAt: paidUntil,
    documentsAnalyzedCount,
    videosGeneratedCount,
  };
}

/** True when a previous trial/subscription lapsed and Plus is no longer active. */
export function isSubscriptionLockedOut(access: SubscriptionAccess) {
  if (access.hasPlus) return false;
  if (access.status === "expired") return true;
  if (access.status === "cancelled") return true;
  return Boolean(access.trialEndsAt && !isFuture(access.trialEndsAt));
}

/**
 * Persist expired status once a trial/period has lapsed.
 * Must use a service-role client — subscription columns are protected from user writes.
 */
export async function markExpiredSubscriptionIfNeeded(
  supabase: SupabaseClient,
  ownerId: string,
  access?: SubscriptionAccess,
): Promise<SubscriptionAccess> {
  const current = access ?? (await getSubscriptionAccess(supabase, ownerId));
  if (current.hasPlus || current.status !== "expired") return current;

  const { data } = await supabase
    .from("clariti_profiles")
    .select("subscription_status")
    .eq("id", ownerId)
    .maybeSingle();
  const stored = (data as ProfileSubscriptionRow | null)?.subscription_status;
  if (stored === "expired") return current;

  await supabase
    .from("clariti_profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "expired",
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  return { ...current, tier: "free", status: "expired", hasPlus: false };
}

export type PlusFeature = "documents" | "videos" | "follow_ups" | "calls" | "compare";

const FEATURE_MESSAGES: Record<PlusFeature, string> = {
  documents: `You have used your ${FREE_DOCUMENT_LIMIT} free document analyses. Upgrade to Clariti Plus for unlimited analyses.`,
  videos: `You have used your ${FREE_VIDEO_LIMIT} free explainer video. Upgrade to Clariti Plus for unlimited videos.`,
  follow_ups: "Phone follow-ups are a Clariti Plus feature.",
  calls: "Live calls with Clariti are a Clariti Plus feature.",
  compare: "Comparing documents over time is a Clariti Plus feature.",
};

export function plusRequiredResponse(feature: PlusFeature) {
  return NextResponse.json(
    {
      ok: false,
      error: "plus_required",
      feature,
      upgradeUrl: "/billing",
      message: FEATURE_MESSAGES[feature],
    },
    { status: 402 },
  );
}

/** Idempotently ensures a clariti_profiles row exists for this user (free tier by default). */
export async function ensureClaritiProfile(
  supabase: SupabaseClient,
  ownerId: string,
  displayName?: string | null,
) {
  await supabase
    .from("clariti_profiles")
    .upsert({ id: ownerId, ...(displayName ? { display_name: displayName } : {}) }, { onConflict: "id", ignoreDuplicates: true });
}

export async function requirePlusAccess(
  supabase: SupabaseClient,
  ownerId: string,
  feature: PlusFeature,
) {
  const access = await getSubscriptionAccess(supabase, ownerId);
  return access.hasPlus ? null : plusRequiredResponse(feature);
}

/**
 * Soft free-tier gate: allow the first `limit` uses (counted from real saved rows,
 * not a client-writable counter), then require Plus. Pass an `access` you already
 * fetched to avoid a duplicate round trip.
 */
export async function enforceFreeLimit(
  supabase: SupabaseClient,
  ownerId: string,
  feature: "documents" | "videos",
  limit: number,
  access?: SubscriptionAccess,
) {
  const resolved = access ?? (await getSubscriptionAccess(supabase, ownerId));
  if (resolved.hasPlus) return null;
  const currentCount = feature === "documents" ? resolved.documentsAnalyzedCount : resolved.videosGeneratedCount;
  return currentCount < limit ? null : plusRequiredResponse(feature);
}
