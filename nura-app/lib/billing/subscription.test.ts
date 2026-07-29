import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enforceThreadLimit, getSubscriptionAccess, plusRequiredResponse, requirePlusAccess } from "./subscription";

function fakeSupabase(profileRow: Record<string, unknown> | null): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: profileRow, error: null }),
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

const OWNER_ID = "00000000-0000-0000-0000-000000000001";

describe("getSubscriptionAccess", () => {
  it("has no access for a brand-new free profile", async () => {
    const access = await getSubscriptionAccess(fakeSupabase(null), OWNER_ID);
    expect(access).toEqual({
      tier: "free",
      status: "free",
      hasPlus: false,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
    });
  });

  it("grants access during an active 7-day trial", async () => {
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_status: "trialing", trial_ends_at: trialEndsAt }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
    expect(access.status).toBe("trialing");
  });

  it("denies access once the trial has expired and no paid tier is active", async () => {
    const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_status: "trialing", trial_ends_at: trialEndsAt }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
  });

  it("grants access for an active paid subscription", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "active" }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("keeps access during a grace period after a billing issue", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "grace_period" }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("keeps access for a cancelled subscription until the paid period actually ends", async () => {
    const futureEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "cancelled",
        subscription_current_period_ends_at: futureEnd,
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("denies access for a cancelled subscription past its paid period", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "cancelled",
        subscription_current_period_ends_at: pastEnd,
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
  });

  it("denies access once fully expired", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "expired" }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
  });
});

describe("requirePlusAccess", () => {
  it("returns null (allowed) when the user has Plus", async () => {
    const result = await requirePlusAccess(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "active" }),
      OWNER_ID,
      "voice",
    );
    expect(result).toBeNull();
  });

  it("returns a 402 response when the user lacks Plus", async () => {
    const result = await requirePlusAccess(fakeSupabase(null), OWNER_ID, "voice");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(402);
  });
});

describe("plusRequiredResponse", () => {
  it("returns a 402 with the feature name in the body", async () => {
    const response = plusRequiredResponse("threads");
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.feature).toBe("threads");
    expect(body.error).toBe("plus_required");
  });
});

describe("enforceThreadLimit", () => {
  it("allows creating a new thread when not at the free limit", async () => {
    const result = await enforceThreadLimit(fakeSupabase(null), OWNER_ID, 0, true);
    expect(result).toBeNull();
  });

  it("allows non-creating requests regardless of count", async () => {
    const result = await enforceThreadLimit(fakeSupabase(null), OWNER_ID, 5, false);
    expect(result).toBeNull();
  });

  it("blocks a new thread at the free limit without Plus", async () => {
    const result = await enforceThreadLimit(fakeSupabase(null), OWNER_ID, 1, true);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(402);
  });

  it("allows a new thread past the free limit when the user has Plus", async () => {
    const result = await enforceThreadLimit(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "active" }),
      OWNER_ID,
      3,
      true,
    );
    expect(result).toBeNull();
  });
});
