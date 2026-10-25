import { describe, expect, it } from "vitest";
import { giftTrialEnd, recordedTrialEnd } from "@/lib/billing/gift-checkout";
import { profileUpdateFromStripe } from "@/lib/billing/sync-plus-stripe";

const now = new Date("2026-10-25T12:00:00Z");

describe("giftTrialEnd", () => {
  it("ends the card trial on the gift's last day", () => {
    expect(giftTrialEnd("2026-11-23T12:00:00Z", now)?.toISOString()).toBe("2026-11-23T12:00:00.000Z");
  });

  it("gives up when Stripe would refuse the date (under 48h away) or there is no gift", () => {
    expect(giftTrialEnd("2026-10-27T11:00:00Z", now)).toBeNull();
    expect(giftTrialEnd(null, now)).toBeNull();
    expect(giftTrialEnd("not a date", now)).toBeNull();
  });
});

describe("recordedTrialEnd", () => {
  it("keeps the gift's end from the checkout session", () => {
    expect(recordedTrialEnd("2026-11-23T12:00:00.000Z", 14, now)).toBe("2026-11-23T12:00:00.000Z");
  });

  it("falls back to the standard trial when there is none or it has passed", () => {
    expect(recordedTrialEnd(undefined, 14, now)).toBe("2026-11-08T12:00:00.000Z");
    expect(recordedTrialEnd("2026-10-01T00:00:00Z", 14, now)).toBe("2026-11-08T12:00:00.000Z");
  });
});

describe("profileUpdateFromStripe", () => {
  const owner = "owner-1";
  const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

  it("ignores subscriptions that belong to someone else or another product", () => {
    expect(profileUpdateFromStripe([{ status: "active", metadata: { recut_user_id: "x" } }], owner)).toBeNull();
    expect(profileUpdateFromStripe([{ status: "active", metadata: { owner_id: "someone-else" } }], owner)).toBeNull();
    expect(profileUpdateFromStripe([{ status: "canceled", metadata: { owner_id: owner } }], owner)).toBeNull();
  });

  it("turns a paid subscription into active Plus, reading the period end from the item", () => {
    expect(
      profileUpdateFromStripe(
        [{ status: "active", metadata: { owner_id: owner }, items: { data: [{ current_period_end: at("2026-12-23T12:00:00Z") }] } }],
        owner,
      ),
    ).toEqual({
      subscription_tier: "plus",
      subscription_status: "active",
      subscription_current_period_ends_at: "2026-12-23T12:00:00.000Z",
    });
  });

  it("keeps a running trial as a trial ending on Stripe's trial_end", () => {
    expect(
      profileUpdateFromStripe([{ status: "trialing", trial_end: at("2026-11-23T12:00:00Z"), metadata: { owner_id: owner } }], owner),
    ).toMatchObject({ subscription_status: "trialing", trial_ends_at: "2026-11-23T12:00:00.000Z" });
  });

  it("treats a failed renewal as the grace period, not a lock-out", () => {
    expect(profileUpdateFromStripe([{ status: "past_due", metadata: { owner_id: owner } }], owner)).toMatchObject({
      subscription_status: "grace_period",
    });
  });
});
