import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingMode } from "@/lib/billing/revenuecat";

/**
 * Restores Plus from a Stripe subscription that Nura's own Checkout created (the invite-gift
 * card step, or the direct Stripe fallback). RevenueCat never hears about those, so without
 * this a friend who added a card would be shown the trial-ended screen on the day their first
 * payment went through.
 *
 * Matched on metadata.owner_id only: the Stripe account is shared with other products, so an
 * email match could unlock Nura for someone paying for something else.
 */

type StripeSubscription = {
  id?: string;
  status?: string;
  trial_end?: number | null;
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
  metadata?: Record<string, string> | null;
};

const LIVE_STATUSES = ["active", "trialing", "past_due"];

function getStripeSecretKey() {
  return getBillingMode() === "live"
    ? process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || ""
    : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

function isoFromUnix(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : null;
}

/** The profile fields a live Nura subscription implies, or null when none is live. */
export function profileUpdateFromStripe(subscriptions: StripeSubscription[], ownerId: string) {
  const live = subscriptions.find(
    (sub) => sub.metadata?.owner_id === ownerId && LIVE_STATUSES.includes(sub.status ?? ""),
  );
  if (!live) return null;
  // Newer Stripe API versions moved the period end onto the subscription item.
  const periodEnd = isoFromUnix(live.current_period_end ?? live.items?.data?.[0]?.current_period_end);
  if (live.status === "trialing") {
    const trialEnd = isoFromUnix(live.trial_end) ?? periodEnd;
    return {
      subscription_tier: "plus" as const,
      subscription_status: "trialing" as const,
      trial_ends_at: trialEnd,
      subscription_current_period_ends_at: trialEnd,
    };
  }
  return {
    subscription_tier: "plus" as const,
    subscription_status: live.status === "past_due" ? ("grace_period" as const) : ("active" as const),
    subscription_current_period_ends_at: periodEnd,
  };
}

export async function syncPlusFromStripe(admin: SupabaseClient, ownerId: string): Promise<{ hasPlus: boolean }> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return { hasPlus: false };

  const query = new URLSearchParams({ query: `metadata['owner_id']:'${ownerId}'`, limit: "10" });
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/search?${query}`, {
    // The account's default API version (2020-03-02) predates search, so pin one that has it.
    headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": "2024-06-20" },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("[billing] Stripe subscription search failed", response.status);
    return { hasPlus: false };
  }
  const payload = (await response.json()) as { data?: StripeSubscription[] };
  const update = profileUpdateFromStripe(payload.data ?? [], ownerId);
  if (!update) return { hasPlus: false };

  const { error } = await admin
    .from("nura_profiles")
    .update({ ...update, subscription_updated_at: new Date().toISOString() })
    .eq("id", ownerId);
  if (error) {
    console.error("[billing] Stripe sync profile update failed", error.message);
    return { hasPlus: false };
  }
  return { hasPlus: true };
}
