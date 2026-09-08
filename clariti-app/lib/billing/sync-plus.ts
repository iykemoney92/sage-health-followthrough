import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { PLUS_ENTITLEMENT_ID } from "@/lib/billing/subscription";
import { getPlusProductIds } from "@/lib/billing/revenuecat-webhook";
import { getRevenueCatSubscriberApiKey } from "@/lib/billing/revenuecat";

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

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

/**
 * Pulls live entitlement state from RevenueCat's REST subscriber API and writes
 * Plus onto clariti_profiles. Requires CLARITI_REVENUECAT_REST_API_KEY.
 */
export async function syncPlusFromRevenueCat(supabase: SupabaseClient, appUserId: string) {
  const apiKey = getRevenueCatSubscriberApiKey();
  if (!apiKey) {
    return { ok: false as const, hasPlus: false, reason: "missing_rc_key" as const };
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return { ok: false as const, hasPlus: false, reason: "rc_fetch_failed" as const, status: response.status };
  }

  const payload = (await response.json()) as RevenueCatSubscriberResponse;
  const entitlements = payload.subscriber?.entitlements ?? {};
  const subscriptions = payload.subscriber?.subscriptions ?? {};
  const plusEntitlement = entitlements[PLUS_ENTITLEMENT_ID];
  const plusProductIds = new Set(getPlusProductIds());

  // Product id only. `|| Boolean(plusEntitlement)` used to be part of this test,
  // which meant that once a Plus entitlement existed at all — including a long
  // expired one — any unrelated active subscription on the same RevenueCat
  // account was read as Plus.
  const activeSubscription = Object.entries(subscriptions).find(
    ([productId, sub]) => plusProductIds.has(productId) && isFuture(sub.expires_date),
  )?.[1];

  const entitled = (plusEntitlement && isFuture(plusEntitlement.expires_date)) || Boolean(activeSubscription);
  if (!entitled) {
    return clearStalePlus(supabase, appUserId);
  }

  const periodType = (activeSubscription?.period_type ?? "").toUpperCase();
  const isTrial = periodType === "TRIAL" || periodType === "INTRO";
  const purchaseDateRaw = activeSubscription?.purchase_date || plusEntitlement?.purchase_date || null;
  const expiresDateRaw = activeSubscription?.expires_date || plusEntitlement?.expires_date || null;
  const purchasedAt = purchaseDateRaw ? new Date(purchaseDateRaw) : new Date();
  const periodEndsAt = expiresDateRaw ?? new Date(purchasedAt.getTime() + CARD_TRIAL_DAYS * 86_400_000).toISOString();
  const cancelled = Boolean(activeSubscription?.unsubscribe_detected_at);
  const billingIssue = Boolean(activeSubscription?.billing_issues_detected_at);

  const status = billingIssue ? "grace_period" : cancelled ? "cancelled" : isTrial ? "trialing" : "active";

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
    updatePayload.trial_ends_at = periodEndsAt;
  }

  const { error } = await supabase.from("clariti_profiles").upsert(updatePayload, { onConflict: "id" });
  if (error) {
    return { ok: false as const, hasPlus: false, reason: "profile_update_failed" as const, error: error.message };
  }

  return { ok: true as const, hasPlus: true, status, trialEndsAt: isTrial ? periodEndsAt : null, periodEndsAt };
}

type StoredProfileRow = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  stripe_customer_id?: string | null;
  revenuecat_app_user_id?: string | null;
};

/**
 * RevenueCat has no live entitlement for this account. Until now that was the
 * end of it, which made this poller upgrade-only: a lapse or a refund that
 * never arrived as a webhook could never take Plus away again, and the profile
 * kept saying "plus" indefinitely.
 *
 * Three accounts are left alone on purpose. A trial that has not run out yet is
 * granted by Clariti itself and has no RevenueCat subscription behind it, so an
 * empty subscriber response says nothing about it. Neither does it say anything
 * about an account billed directly through Stripe, which RevenueCat does not
 * own.
 *
 * Nor about an account RevenueCat has never heard of. GET /v1/subscribers/:id
 * answers 200 with no entitlements for an id that does not exist there, so a
 * REST key pointed at the wrong project or environment reads as "everybody
 * lapsed" and would revoke Plus from paying App Store subscribers one paywall
 * load at a time. A stored revenuecat_app_user_id is what says RevenueCat is the
 * recorded source of truth for this account; both the upgrade path above and the
 * webhook write it, so a genuine lapse or refund is still caught.
 */
async function clearStalePlus(supabase: SupabaseClient, appUserId: string) {
  const noEntitlement = { ok: true as const, hasPlus: false, reason: "no_active_entitlement" as const };

  const { data } = await supabase
    .from("clariti_profiles")
    .select("subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, revenuecat_app_user_id")
    .eq("id", appUserId)
    .maybeSingle();

  const profile = (data ?? null) as StoredProfileRow | null;
  if (!profile || profile.subscription_tier !== "plus") return noEntitlement;
  if (profile.stripe_customer_id) return noEntitlement;
  if (profile.subscription_status === "trialing" && isFuture(profile.trial_ends_at)) {
    return { ok: true as const, hasPlus: true, reason: "local_trial_active" as const };
  }
  // Checked after the trial so a Clariti-granted trial keeps reporting itself as
  // live rather than falling out here as "no entitlement".
  if (!profile.revenuecat_app_user_id) return noEntitlement;

  const { error } = await supabase
    .from("clariti_profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "expired",
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", appUserId);

  if (error) {
    return { ok: false as const, hasPlus: false, reason: "profile_update_failed" as const, error: error.message };
  }

  return { ok: true as const, hasPlus: false, reason: "downgraded" as const };
}
