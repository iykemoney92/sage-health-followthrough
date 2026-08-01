import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import type { RevenueCatEvent } from "@/lib/billing/revenuecat-webhook";
import { desiredCardTrialEndsAt, shouldExtendCardTrial } from "@/lib/billing/revenuecat-webhook";

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
}

type StripeInvoice = {
  id?: string;
  subscription?: string | { id?: string } | null;
};

type StripeSubscription = {
  id?: string;
  status?: string;
  trial_end?: number | null;
  error?: { message?: string };
};

async function stripeGet<T>(path: string, secretKey: string): Promise<T | null> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function stripePost<T>(path: string, secretKey: string, body: URLSearchParams): Promise<T | null> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function resolveStripeSubscriptionId(event: RevenueCatEvent, secretKey: string) {
  const candidates = [event.original_transaction_id, event.transaction_id].filter(Boolean) as string[];

  for (const id of candidates) {
    if (id.startsWith("sub_")) return id;
    if (id.startsWith("in_")) {
      const invoice = await stripeGet<StripeInvoice>(`invoices/${encodeURIComponent(id)}`, secretKey);
      const subscription = invoice?.subscription;
      if (typeof subscription === "string" && subscription.startsWith("sub_")) return subscription;
      if (subscription && typeof subscription === "object" && subscription.id?.startsWith("sub_")) {
        return subscription.id;
      }
    }
  }

  return null;
}

/**
 * When RevenueCat/Stripe created a shorter trial than CARD_TRIAL_DAYS, push
 * Stripe's trial_end forward so billing and our DB stay aligned.
 */
export async function extendStripeTrialIfNeeded(event: RevenueCatEvent) {
  if (!shouldExtendCardTrial(event)) {
    return { ok: true as const, extended: false as const, reason: "not_needed" as const };
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return { ok: false as const, extended: false as const, reason: "missing_stripe_key" as const };
  }

  const subscriptionId = await resolveStripeSubscriptionId(event, secretKey);
  if (!subscriptionId) {
    return { ok: false as const, extended: false as const, reason: "subscription_not_found" as const };
  }

  const trialEndsAt = desiredCardTrialEndsAt(event);
  const trialEndUnix = Math.floor(new Date(trialEndsAt).getTime() / 1000);
  const body = new URLSearchParams({
    trial_end: String(trialEndUnix),
    proration_behavior: "none",
  });

  const updated = await stripePost<StripeSubscription>(
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
    secretKey,
    body,
  );

  if (!updated?.id) {
    return { ok: false as const, extended: false as const, reason: "stripe_update_failed" as const, subscriptionId };
  }

  return {
    ok: true as const,
    extended: true as const,
    subscriptionId,
    trialEndsAt,
    trialDays: CARD_TRIAL_DAYS,
  };
}
