import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";

export type StripeCheckoutSession = {
  id?: string;
  mode?: string;
  status?: string;
  metadata?: {
    owner_id?: string;
  } | null;
};

export type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: unknown;
  };
};

export async function getStripeTestCheckoutSession(sessionId: string) {
  const secretKey =
    process.env.STRIPE_TEST_SECRET_KEY
    || (process.env.NODE_ENV !== "production" ? process.env.STRIPE_SECRET_KEY : "")
    || "";
  if (!secretKey) return null;

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as StripeCheckoutSession;
}

export function verifyStripeWebhook(payload: string, signatureHeader: string | null) {
  const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail closed in production — unsigned webhooks must never mutate billing state.
    return false;
  }
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...value] = part.split("=");
      return [key, value.join("=")];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function grantStripeTestPlus(supabase: SupabaseClient, ownerId: string) {
  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + CARD_TRIAL_DAYS);

  return await supabase
    .from("nura_profiles")
    .upsert({
      id: ownerId,
      subscription_tier: "plus",
      subscription_status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_current_period_ends_at: trialEndsAt.toISOString(),
      subscription_updated_at: now.toISOString(),
    }, { onConflict: "id" });
}
