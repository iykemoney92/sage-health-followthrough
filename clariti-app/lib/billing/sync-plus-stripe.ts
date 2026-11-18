import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeSecretKey } from "@/lib/billing/revenuecat";

/**
 * Clariti's own Stripe Checkout (the web card-first trial) creates subscriptions
 * RevenueCat never hears about, and no Stripe webhook is wired on this shared
 * account. So Stripe is read on demand instead: whenever a profile says "no
 * Plus", this looks for a live subscription and writes what it implies. A trial
 * that became paid, or a renewal, is picked up the first time the old period
 * runs out; a cancelled one simply stops being found.
 *
 * Matched on metadata.owner_id only: the Stripe account is shared with other
 * products, so an email match could unlock Clariti for someone paying for
 * something else.
 */

export type StripeSubscription = {
  id?: string;
  status?: string;
  trial_end?: number | null;
  trial_start?: number | null;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  customer?: string | { id?: string } | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
  metadata?: Record<string, string> | null;
};

const LIVE_STATUSES = ["active", "trialing", "past_due"];

function isoFromUnix(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : null;
}

function customerIdOf(sub: StripeSubscription) {
  const id = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  return id?.startsWith("cus_") ? id : null;
}

/** A subscription whose card failed Clariti's check never counts, even if its cancel lagged. */
function failedCardCheck(sub: StripeSubscription) {
  return (sub.metadata?.card_check ?? "").startsWith("failed");
}

/** The profile fields a live Clariti subscription implies, or null when none is live. */
export function profileUpdateFromStripe(subscriptions: StripeSubscription[], ownerId: string) {
  const live = subscriptions.find(
    (sub) => sub.metadata?.owner_id === ownerId && LIVE_STATUSES.includes(sub.status ?? "") && !failedCardCheck(sub),
  );
  if (!live) return null;
  // Newer Stripe API versions moved the period end onto the subscription item.
  const periodEnd = isoFromUnix(live.current_period_end ?? live.items?.data?.[0]?.current_period_end);
  const customerId = customerIdOf(live);
  const shared = { subscription_tier: "plus" as const, ...(customerId ? { stripe_customer_id: customerId } : {}) };
  if (live.status === "trialing") {
    const trialEnd = isoFromUnix(live.trial_end) ?? periodEnd;
    return {
      ...shared,
      subscription_status: "trialing" as const,
      ...(isoFromUnix(live.trial_start) ? { trial_started_at: isoFromUnix(live.trial_start) } : {}),
      trial_ends_at: trialEnd,
      subscription_current_period_ends_at: trialEnd,
    };
  }
  return {
    ...shared,
    subscription_status:
      live.status === "past_due" ? ("grace_period" as const) : live.cancel_at_period_end ? ("cancelled" as const) : ("active" as const),
    subscription_current_period_ends_at: periodEnd,
  };
}

/** Every Clariti subscription Stripe holds for this account, any status. Null when Stripe could not be read. */
export async function listStripeSubscriptions(ownerId: string): Promise<StripeSubscription[] | null> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  const query = new URLSearchParams({ query: `metadata['owner_id']:'${ownerId}'`, limit: "20" });
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/search?${query}`, {
    // The account's default API version predates search, so pin one that has it.
    headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": "2024-06-20" },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) {
    console.error("[billing] Stripe subscription search failed", response?.status ?? "network");
    return null;
  }
  const payload = (await response.json()) as { data?: StripeSubscription[] };
  return (payload.data ?? []).filter((sub) => sub.metadata?.owner_id === ownerId);
}

/** True once this account has had a Clariti subscription whose card passed: no second free trial. */
export function hasUsedStripeTrial(subscriptions: StripeSubscription[]) {
  return subscriptions.some((sub) => !failedCardCheck(sub) && sub.status !== "incomplete" && sub.status !== "incomplete_expired");
}

export function hasLiveStripeSubscription(subscriptions: StripeSubscription[]) {
  return subscriptions.some((sub) => LIVE_STATUSES.includes(sub.status ?? "") && !failedCardCheck(sub));
}

/** Writes one subscription's state onto the profile. Used right after checkout, before search has indexed it. */
export async function writeStripeSubscription(admin: SupabaseClient, ownerId: string, subscription: StripeSubscription) {
  const update = profileUpdateFromStripe([{ ...subscription, metadata: { ...subscription.metadata, owner_id: ownerId } }], ownerId);
  if (!update) return { hasPlus: false as const };
  const { error } = await admin
    .from("clariti_profiles")
    .upsert({ id: ownerId, ...update, subscription_updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    console.error("[billing] Stripe profile update failed", error.message);
    return { hasPlus: false as const, error: error.message };
  }
  return { hasPlus: true as const };
}

export async function syncPlusFromStripe(admin: SupabaseClient, ownerId: string): Promise<{ hasPlus: boolean }> {
  const subscriptions = await listStripeSubscriptions(ownerId);
  if (!subscriptions) return { hasPlus: false };
  const update = profileUpdateFromStripe(subscriptions, ownerId);
  if (!update) return { hasPlus: false };

  const { error } = await admin
    .from("clariti_profiles")
    .update({ ...update, subscription_updated_at: new Date().toISOString() })
    .eq("id", ownerId);
  if (error) {
    console.error("[billing] Stripe sync profile update failed", error.message);
    return { hasPlus: false };
  }
  return { hasPlus: true };
}
