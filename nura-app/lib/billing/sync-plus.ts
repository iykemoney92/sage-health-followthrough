import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { PLUS_ENTITLEMENT_ID } from "@/lib/billing/subscription";
import { getPlusProductIds } from "@/lib/billing/revenuecat-webhook";

type RevenueCatEntitlement = {
  expires_date?: string | null;
  product_identifier?: string | null;
  purchase_date?: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<
      string,
      {
        expires_date?: string | null;
        purchase_date?: string | null;
        period_type?: string | null;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
      }
    >;
  };
};

function getRevenueCatApiKey() {
  return (
    process.env.REVENUECAT_REST_API_KEY
    || process.env.REVENUECAT_PUBLIC_API_KEY
    || ""
  ).replace(/\\n/g, "").trim();
}

function addDaysIso(from: Date, days: number) {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

/**
 * Pulls live entitlement state from RevenueCat and writes Plus onto the profile.
 * Used on post-checkout return so users are not stuck waiting for webhooks.
 */
export async function syncPlusFromRevenueCat(
  supabase: SupabaseClient,
  appUserId: string,
) {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return { ok: false as const, hasPlus: false, reason: "missing_rc_key" as const };
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      ok: false as const,
      hasPlus: false,
      reason: "rc_fetch_failed" as const,
      status: response.status,
    };
  }

  const payload = (await response.json()) as RevenueCatSubscriberResponse;
  const entitlements = payload.subscriber?.entitlements ?? {};
  const subscriptions = payload.subscriber?.subscriptions ?? {};
  const plusEntitlement = entitlements[PLUS_ENTITLEMENT_ID];
  const plusProductIds = new Set(getPlusProductIds());

  const activeSubscription = Object.entries(subscriptions).find(([productId, sub]) => {
    const matchesProduct = plusProductIds.has(productId) || Boolean(plusEntitlement);
    return matchesProduct && isFuture(sub.expires_date);
  })?.[1];

  const entitled =
    (plusEntitlement && isFuture(plusEntitlement.expires_date))
    || Boolean(activeSubscription);

  if (!entitled) {
    return { ok: true as const, hasPlus: false, reason: "no_active_entitlement" as const };
  }

  const purchaseDateRaw =
    activeSubscription?.purchase_date
    || plusEntitlement?.purchase_date
    || null;
  const expiresDateRaw =
    activeSubscription?.expires_date
    || plusEntitlement?.expires_date
    || null;

  const purchasedAt = purchaseDateRaw ? new Date(purchaseDateRaw) : new Date();
  const storeExpiresAt = expiresDateRaw ? new Date(expiresDateRaw) : null;
  const periodType = (activeSubscription?.period_type ?? "").toUpperCase();
  const isTrial = periodType === "TRIAL" || periodType === "INTRO" || !periodType;

  // Prefer the store expiry when it's already ≥14 days; otherwise honor our card trial.
  let trialEndsAt = addDaysIso(purchasedAt, CARD_TRIAL_DAYS);
  if (storeExpiresAt && !Number.isNaN(storeExpiresAt.getTime())) {
    const promised = new Date(trialEndsAt);
    if (storeExpiresAt.getTime() >= promised.getTime() - 12 * 60 * 60 * 1000) {
      trialEndsAt = storeExpiresAt.toISOString();
    }
  }

  const periodEndsAt = isTrial
    ? trialEndsAt
    : (storeExpiresAt?.toISOString() ?? trialEndsAt);

  const cancelled = Boolean(activeSubscription?.unsubscribe_detected_at);
  const billingIssue = Boolean(activeSubscription?.billing_issues_detected_at);

  const status = billingIssue
    ? "grace_period"
    : cancelled
      ? "cancelled"
      : isTrial
        ? "trialing"
        : "active";

  const updatePayload: Record<string, string> = {
    id: appUserId,
    subscription_tier: "plus",
    subscription_status: status,
    subscription_current_period_ends_at: periodEndsAt,
    revenuecat_app_user_id: appUserId,
    subscription_updated_at: new Date().toISOString(),
  };

  if (isTrial) {
    updatePayload.trial_started_at = purchasedAt.toISOString();
    updatePayload.trial_ends_at = trialEndsAt;
  }

  const { error } = await supabase
    .from("nura_profiles")
    .upsert(updatePayload, { onConflict: "id" });

  if (error) {
    return { ok: false as const, hasPlus: false, reason: "profile_update_failed" as const, error: error.message };
  }

  return {
    ok: true as const,
    hasPlus: true,
    status,
    trialEndsAt: isTrial ? trialEndsAt : null,
    periodEndsAt,
  };
}

/** Local grant used when RC confirms purchase or checkout return needs an immediate unlock. */
export async function grantLocalPlusTrial(
  supabase: SupabaseClient,
  ownerId: string,
  options?: { trialDays?: number; startedAt?: Date },
) {
  const now = options?.startedAt ?? new Date();
  const trialDays = options?.trialDays ?? CARD_TRIAL_DAYS;
  const trialEndsAt = addDaysIso(now, trialDays);

  return supabase.from("nura_profiles").upsert(
    {
      id: ownerId,
      subscription_tier: "plus",
      subscription_status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt,
      subscription_current_period_ends_at: trialEndsAt,
      revenuecat_app_user_id: ownerId,
      subscription_updated_at: now.toISOString(),
    },
    { onConflict: "id" },
  );
}
