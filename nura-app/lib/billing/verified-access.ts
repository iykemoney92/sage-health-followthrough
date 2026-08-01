import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionAccess, type SubscriptionAccess } from "@/lib/billing/subscription";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
}

async function stripeHasActiveCustomer(email: string | null | undefined) {
  const secret = getStripeSecretKey();
  if (!secret || !email) return false;

  const customers = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    },
  );
  if (!customers.ok) return false;
  const payload = (await customers.json()) as { data?: Array<{ id?: string }> };
  const customerId = payload.data?.[0]?.id;
  if (!customerId?.startsWith("cus_")) return false;

  const subs = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&limit=5&status=all`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    },
  );
  if (!subs.ok) return false;
  const subPayload = (await subs.json()) as {
    data?: Array<{ status?: string; trial_end?: number | null }>;
  };
  return (subPayload.data ?? []).some((sub) => {
    const status = sub.status ?? "";
    if (status === "active" || status === "trialing" || status === "past_due") return true;
    return false;
  });
}

async function revokeIllicitPlus(ownerId: string) {
  try {
    const admin = getSupabaseServerClient();
    await admin
      .from("nura_profiles")
      .update({
        subscription_tier: "free",
        subscription_status: "free",
        trial_started_at: null,
        trial_ends_at: null,
        subscription_current_period_ends_at: null,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", ownerId);
  } catch (error) {
    console.error("[billing] failed to revoke illicit Plus", error);
  }
}

/**
 * Subscription gate that cannot be bypassed by client self-writes to nura_profiles.
 * Trusts RevenueCat entitlements or an active/trialing Stripe subscription for the user email.
 */
export async function getVerifiedSubscriptionAccess(
  supabase: SupabaseClient,
  ownerId: string,
  email?: string | null,
): Promise<SubscriptionAccess> {
  const local = await getSubscriptionAccess(supabase, ownerId);
  if (!local.hasPlus) return local;

  // Prefer service-role reads/writes so RLS/client tampering cannot stick.
  let admin: SupabaseClient;
  try {
    admin = getSupabaseServerClient();
  } catch {
    return local;
  }

  const synced = await syncPlusFromRevenueCat(admin, ownerId);
  if (synced.hasPlus) {
    return getSubscriptionAccess(admin, ownerId);
  }

  if (await stripeHasActiveCustomer(email)) {
    return getSubscriptionAccess(admin, ownerId);
  }

  // Profile claimed Plus but neither RC nor Stripe confirms — treat as free (blocks anon upserts).
  await revokeIllicitPlus(ownerId);
  return {
    tier: "free",
    status: "free",
    hasPlus: false,
    trialEndsAt: null,
    currentPeriodEndsAt: null,
  };
}
