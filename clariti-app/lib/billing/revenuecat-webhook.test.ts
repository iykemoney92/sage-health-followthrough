import { describe, expect, it } from "vitest";
import { isPlusProduct, subscriptionUpdateFor, type RevenueCatEvent } from "./revenuecat-webhook";

const HOUR = 60 * 60 * 1000;
const future = () => Date.now() + 24 * HOUR;
const past = () => Date.now() - 24 * HOUR;

function event(overrides: Partial<RevenueCatEvent>): RevenueCatEvent {
  return { type: "INITIAL_PURCHASE", app_user_id: "user-1", entitlement_ids: ["plus"], ...overrides };
}

describe("isPlusProduct", () => {
  // The entitlement, not the product id, is what makes a purchase count. This is
  // the property that lets an App Store purchase grant Plus without the backend
  // knowing anything about StoreKit product ids.
  it("accepts an unknown product id when the plus entitlement is attached", () => {
    expect(isPlusProduct(event({ product_id: "something_nobody_configured" }))).toBe(true);
  });

  it("accepts a known store product id even with no entitlement on the event", () => {
    expect(isPlusProduct(event({ entitlement_ids: null, product_id: "clariti_plus_annual" }))).toBe(true);
  });

  it("rejects an unrelated product with no entitlement", () => {
    expect(isPlusProduct(event({ entitlement_ids: [], product_id: "some_other_app_product" }))).toBe(false);
  });
});

describe("subscriptionUpdateFor", () => {
  it("grants Plus for a StoreKit purchase", () => {
    const update = subscriptionUpdateFor(
      event({ store: "APP_STORE", product_id: "clariti_plus_monthly", expiration_at_ms: future() }),
    );
    expect(update).toMatchObject({ subscription_tier: "plus", subscription_status: "active" });
  });

  it("treats an introductory offer as a trial rather than a paid period", () => {
    const update = subscriptionUpdateFor(
      event({ period_type: "TRIAL", purchased_at_ms: Date.now(), expiration_at_ms: future() }),
    );
    expect(update).toMatchObject({ subscription_status: "trialing" });
    expect(update?.trial_ends_at).toBeTruthy();
  });

  it("keeps Plus on after a cancellation until the paid period actually ends", () => {
    const update = subscriptionUpdateFor(event({ type: "CANCELLATION", expiration_at_ms: future() }));
    expect(update).toMatchObject({ subscription_tier: "plus", subscription_status: "cancelled" });
  });

  it("revokes immediately when support cancels with a refund", () => {
    const update = subscriptionUpdateFor(
      event({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", expiration_at_ms: future() }),
    );
    expect(update).toMatchObject({ subscription_tier: "free", subscription_status: "expired" });
  });

  it("holds Plus through a billing issue while the grace period is live", () => {
    const update = subscriptionUpdateFor(
      event({ type: "BILLING_ISSUE", grace_period_expiration_at_ms: future(), expiration_at_ms: past() }),
    );
    expect(update).toMatchObject({ subscription_tier: "plus", subscription_status: "grace_period" });
  });

  it("drops Plus once the grace period has passed", () => {
    const update = subscriptionUpdateFor(
      event({ type: "BILLING_ISSUE", grace_period_expiration_at_ms: past(), expiration_at_ms: past() }),
    );
    expect(update).toMatchObject({ subscription_tier: "free", subscription_status: "expired" });
  });

  it("expires on EXPIRATION", () => {
    const update = subscriptionUpdateFor(event({ type: "EXPIRATION", expiration_at_ms: past() }));
    expect(update).toMatchObject({ subscription_tier: "free", subscription_status: "expired" });
  });

  it("ignores an event for a product that is not Plus", () => {
    expect(subscriptionUpdateFor(event({ entitlement_ids: [], product_id: "unrelated" }))).toBeNull();
  });
});
