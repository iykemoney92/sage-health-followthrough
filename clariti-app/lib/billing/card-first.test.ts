import { afterEach, describe, expect, it, vi } from "vitest";
import { cardFirstApplies, cardFirstSurfaces, paywallPathFor, surfaceFromUserAgent } from "@/lib/billing/card-first";
import {
  hasLiveStripeSubscription,
  hasUsedStripeTrial,
  profileUpdateFromStripe,
} from "@/lib/billing/sync-plus-stripe";
import { plusStateFromProfile } from "@/lib/billing/subscription";

const OWNER = "11111111-1111-4111-8111-111111111111";
const inDays = (days: number) => Math.floor(Date.now() / 1000) + days * 86_400;

afterEach(() => vi.unstubAllEnvs());

describe("card-first surfaces", () => {
  it("reads the surface from the app's user-agent marker", () => {
    expect(surfaceFromUserAgent("Mozilla/5.0 (Macintosh) Safari")).toBe("web");
    expect(surfaceFromUserAgent("Mozilla/5.0 (Linux; Android 14) ClaritiApp")).toBe("android");
    expect(surfaceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) ClaritiApp")).toBe("ios");
    expect(surfaceFromUserAgent(null)).toBe("web");
  });

  it("applies everywhere by default and only where the env lists", () => {
    expect(cardFirstSurfaces()).toEqual(["web", "ios", "android"]);
    vi.stubEnv("CLARITI_CARD_FIRST_SURFACES", "web,ios");
    expect(cardFirstApplies("Android ClaritiApp")).toBe(false);
    expect(cardFirstApplies("iPhone ClaritiApp")).toBe(true);
    vi.stubEnv("CLARITI_CARD_FIRST_SURFACES", "off");
    expect(cardFirstApplies("Mozilla")).toBe(false);
  });

  it("sends a never-subscribed account to the trial step and a lapsed one to renew", () => {
    expect(paywallPathFor(plusStateFromProfile({}))).toBe("/start-trial");
    const lapsed = plusStateFromProfile({
      subscription_tier: "plus",
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(lapsed.hasPlus).toBe(false);
    expect(paywallPathFor(lapsed)).toBe("/billing/locked");
  });
});

describe("Stripe subscription → profile", () => {
  const trialing = { id: "sub_1", status: "trialing", trial_end: inDays(7), customer: "cus_1", metadata: { owner_id: OWNER } };

  it("writes a live trial as trialing Plus with the customer id", () => {
    const update = profileUpdateFromStripe([trialing], OWNER);
    expect(update).toMatchObject({ subscription_tier: "plus", subscription_status: "trialing", stripe_customer_id: "cus_1" });
    expect(plusStateFromProfile(update!).hasPlus).toBe(true);
  });

  it("never counts another owner's subscription or one whose card failed the check", () => {
    expect(profileUpdateFromStripe([{ ...trialing, metadata: { owner_id: "someone-else" } }], OWNER)).toBeNull();
    const failed = { ...trialing, metadata: { owner_id: OWNER, card_check: "failed:insufficient_funds" } };
    expect(profileUpdateFromStripe([failed], OWNER)).toBeNull();
    expect(hasLiveStripeSubscription([failed])).toBe(false);
    // A declined card does not use the free trial up.
    expect(hasUsedStripeTrial([failed])).toBe(false);
  });

  it("reads a paid period from the subscription item on newer API versions", () => {
    const paid = { id: "sub_2", status: "active", items: { data: [{ current_period_end: inDays(30) }] }, metadata: { owner_id: OWNER } };
    const update = profileUpdateFromStripe([paid], OWNER);
    expect(update?.subscription_status).toBe("active");
    expect(new Date(update!.subscription_current_period_ends_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it("gives no second trial once any subscription passed, and none while one is live", () => {
    const cancelled = { id: "sub_3", status: "canceled", metadata: { owner_id: OWNER, card_check: "ok" } };
    expect(profileUpdateFromStripe([cancelled], OWNER)).toBeNull();
    expect(hasUsedStripeTrial([cancelled])).toBe(true);
    expect(hasLiveStripeSubscription([cancelled])).toBe(false);
    expect(hasLiveStripeSubscription([trialing])).toBe(true);
  });
});
