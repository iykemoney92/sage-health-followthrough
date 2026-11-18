import { describe, expect, it } from "vitest";
import { checkTrialCard } from "@/lib/billing/card-check";
import { hasLiveStripeSubscription, hasUsedStripeTrial, profileUpdateFromStripe, type StripeSubscription } from "@/lib/billing/sync-plus-stripe";
import { plusStateFromProfile } from "@/lib/billing/subscription";

const KEY = process.env.STRIPE_TEST_SECRET_KEY ?? "";
const OWNER = `cardfirst-test-${Date.now()}`;

async function api(method: string, path: string, form?: Record<string, string>) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose Stripe JSON in a test helper
  return (await r.json()) as Record<string, any>;
}

async function trialWith(paymentMethod: string) {
  const customer = await api("POST", "customers", { description: "Clariti card-first test", "metadata[owner_id]": OWNER });
  const pm = await api("POST", `payment_methods/${paymentMethod}/attach`, { customer: customer.id });
  await api("POST", `customers/${customer.id}`, { "invoice_settings[default_payment_method]": pm.id });
  const sub = await api("POST", "subscriptions", {
    customer: customer.id,
    default_payment_method: pm.id,
    trial_period_days: "7",
    "items[0][price_data][currency]": "usd",
    "items[0][price_data][unit_amount]": "999",
    "items[0][price_data][recurring][interval]": "month",
    "items[0][price_data][product]": (await api("POST", "products", { name: "Clariti Plus (test)" })).id,
    "metadata[owner_id]": OWNER,
    "metadata[product]": "clariti",
  });
  return { customer: customer.id as string, sub: sub.id as string, raw: sub };
}

describe.skipIf(!KEY.includes("_test_"))("Stripe test mode: card-first trial", () => {
  it("a good card passes the hold, and the trial reads as Plus", async () => {
    const { sub, customer } = await trialWith("pm_card_visa");
    expect(await checkTrialCard(KEY, sub)).toBe("ok");
    expect(await checkTrialCard(KEY, sub)).toBe("ok"); // second return: no second hold
    const read = (await api("GET", `subscriptions/${sub}`)) as StripeSubscription;
    expect(read.metadata?.card_check).toBe("ok");
    const update = profileUpdateFromStripe([read], OWNER);
    expect(update).toMatchObject({ subscription_status: "trialing", stripe_customer_id: customer });
    expect(plusStateFromProfile(update!).hasPlus).toBe(true);
    const holds = await api("GET", `payment_intents?customer=${customer}&limit=5`);
    expect(holds.data).toHaveLength(1);
    expect(holds.data[0].status).toBe("canceled");
    const portal = await api("POST", "billing_portal/sessions", { customer, return_url: "http://localhost:3000/billing" });
    console.log("portal session:", portal.url ? "ok" : portal.error?.message);
    await api("DELETE", `subscriptions/${sub}`);
  }, 60_000);

  it("a card that cannot pay fails the hold, and the trial is cancelled without using the trial up", async () => {
    const { sub } = await trialWith("pm_card_chargeCustomerFail");
    expect(await checkTrialCard(KEY, sub)).toBe("failed");
    const read = (await api("GET", `subscriptions/${sub}`)) as StripeSubscription;
    expect(read.status).toBe("canceled");
    expect(profileUpdateFromStripe([read], OWNER)).toBeNull();
    expect(hasLiveStripeSubscription([read])).toBe(false);
    expect(hasUsedStripeTrial([read])).toBe(false);
  }, 60_000);

  it("Stripe accepts the checkout session the route builds", async () => {
    const session = await api("POST", "checkout/sessions", {
      mode: "subscription",
      success_url: "http://localhost:3000/api/billing/checkout-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/start-trial?checkout=cancelled",
      "metadata[owner_id]": OWNER,
      "metadata[product]": "clariti",
      "subscription_data[metadata][owner_id]": OWNER,
      "subscription_data[metadata][product]": "clariti",
      "subscription_data[trial_period_days]": "7",
      "subscription_data[metadata][trial_days]": "7",
      payment_method_collection: "always",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": "999",
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": "Clariti Plus",
      customer_email: "cardfirst-test@example.com",
    });
    expect(session.error?.message).toBeUndefined();
    expect(String(session.url)).toContain("checkout.stripe.com");
  }, 30_000);
});
