import { describe, expect, it } from "vitest";
import {
  desiredCardTrialEndsAt,
  shouldExtendCardTrial,
  subscriptionUpdateFor,
  type RevenueCatEvent,
} from "./revenuecat-webhook";

const OWNER = "00000000-0000-0000-0000-000000000001";
const DAY = 24 * 60 * 60 * 1000;

function baseEvent(overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent {
  const purchased = Date.UTC(2026, 6, 30, 12, 0, 0);
  return {
    id: "evt_test",
    type: "INITIAL_PURCHASE",
    app_user_id: OWNER,
    product_id: "prod_UxrFQntebp8P6e",
    entitlement_ids: ["plus"],
    period_type: "TRIAL",
    purchased_at_ms: purchased,
    expiration_at_ms: purchased + 7 * DAY,
    ...overrides,
  };
}

describe("subscriptionUpdateFor", () => {
  it("marks INITIAL_PURCHASE trials as trialing with trial dates", () => {
    const event = baseEvent();
    const update = subscriptionUpdateFor(event, { extendShortTrials: false });
    expect(update).toMatchObject({
      subscription_tier: "plus",
      subscription_status: "trialing",
    });
    expect(update?.trial_ends_at).toBe(new Date(event.expiration_at_ms!).toISOString());
  });

  it("extends short trials to 14 days when allowed", () => {
    const event = baseEvent();
    const update = subscriptionUpdateFor(event, { extendShortTrials: true });
    expect(update?.subscription_status).toBe("trialing");
    expect(update?.trial_ends_at).toBe(desiredCardTrialEndsAt(event));
    expect(shouldExtendCardTrial(event)).toBe(true);
  });

  it("keeps a true 14-day trial end without rewriting it", () => {
    const purchased = Date.UTC(2026, 6, 30, 12, 0, 0);
    const event = baseEvent({
      purchased_at_ms: purchased,
      expiration_at_ms: purchased + 14 * DAY,
    });
    expect(shouldExtendCardTrial(event)).toBe(false);
    const update = subscriptionUpdateFor(event, { extendShortTrials: true });
    expect(update?.trial_ends_at).toBe(new Date(purchased + 14 * DAY).toISOString());
  });

  it("marks NORMAL INITIAL_PURCHASE as active", () => {
    const update = subscriptionUpdateFor(baseEvent({ period_type: "NORMAL" }));
    expect(update).toMatchObject({
      subscription_tier: "plus",
      subscription_status: "active",
    });
    expect(update?.trial_ends_at).toBeUndefined();
  });

  it("keeps access after UNSUBSCRIBE cancellation until period end", () => {
    const future = Date.now() + 5 * DAY;
    const update = subscriptionUpdateFor(baseEvent({
      type: "CANCELLATION",
      period_type: "TRIAL",
      cancel_reason: "UNSUBSCRIBE",
      expiration_at_ms: future,
    }));
    expect(update).toMatchObject({
      subscription_tier: "plus",
      subscription_status: "cancelled",
    });
    expect(update?.subscription_current_period_ends_at).toBe(new Date(future).toISOString());
  });

  it("expires immediately on support refund cancellation", () => {
    const update = subscriptionUpdateFor(baseEvent({
      type: "CANCELLATION",
      cancel_reason: "CUSTOMER_SUPPORT",
      expiration_at_ms: Date.now() + DAY,
      price: -9.99,
    }));
    expect(update).toMatchObject({
      subscription_tier: "free",
      subscription_status: "expired",
    });
  });

  it("marks RENEWAL after trial as active", () => {
    const update = subscriptionUpdateFor(baseEvent({
      type: "RENEWAL",
      period_type: "NORMAL",
      is_trial_conversion: true,
      expiration_at_ms: Date.now() + 30 * DAY,
    }));
    expect(update).toMatchObject({
      subscription_tier: "plus",
      subscription_status: "active",
    });
  });

  it("uses grace_period_expiration_at_ms for billing issues", () => {
    const grace = Date.now() + 3 * DAY;
    const update = subscriptionUpdateFor(baseEvent({
      type: "BILLING_ISSUE",
      period_type: "NORMAL",
      grace_period_expiration_at_ms: grace,
      expiration_at_ms: Date.now() - DAY,
    }));
    expect(update).toMatchObject({
      subscription_tier: "plus",
      subscription_status: "grace_period",
    });
    expect(update?.subscription_current_period_ends_at).toBe(new Date(grace).toISOString());
  });

  it("revokes on EXPIRATION", () => {
    const update = subscriptionUpdateFor(baseEvent({
      type: "EXPIRATION",
      period_type: "NORMAL",
      expiration_reason: "UNSUBSCRIBE",
      expiration_at_ms: Date.now() - 1000,
    }));
    expect(update).toMatchObject({
      subscription_tier: "free",
      subscription_status: "expired",
    });
  });

  it("ignores non-plus products", () => {
    const update = subscriptionUpdateFor(baseEvent({
      product_id: "something_else",
      entitlement_ids: [],
    }));
    expect(update).toBeNull();
  });

  it("handles PRODUCT_CHANGE while keeping Plus", () => {
    const update = subscriptionUpdateFor(baseEvent({
      type: "PRODUCT_CHANGE",
      period_type: "NORMAL",
      expiration_at_ms: Date.now() + 20 * DAY,
    }));
    expect(update).toMatchObject({
      subscription_tier: "plus",
      subscription_status: "active",
    });
  });
});
