import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionAccess, getVideoGenerationCount, isSubscriptionLockedOut } from "./subscription";

const DAY = 24 * 60 * 60 * 1000;
const OWNER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * getSubscriptionAccess issues three queries against one client: a profile read
 * ending in maybeSingle, and two head-only counts that are awaited on the query
 * builder itself. The fake is therefore both chainable and thenable — awaiting
 * it yields a count, calling maybeSingle yields the row.
 */
function fakeSupabase(profileRow: Record<string, unknown> | null, counts = { documents: 0, videos: 0 }) {
  const from = (table: string) => {
    const count = table === "clariti_documents" ? counts.documents : counts.videos;
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      maybeSingle: async () => ({ data: profileRow, error: null }),
      then: (resolve: (value: { count: number; error: null }) => unknown) => resolve({ count, error: null }),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

describe("getSubscriptionAccess", () => {
  it("gives a brand-new account the free tier", async () => {
    const access = await getSubscriptionAccess(fakeSupabase(null), OWNER_ID);
    expect(access).toMatchObject({ tier: "free", status: "free", hasPlus: false });
  });

  it("grants Plus during a live trial", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_status: "trialing", trial_ends_at: new Date(Date.now() + 3 * DAY).toISOString() }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("marks a lapsed trial expired rather than leaving it trialing", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_status: "trialing", trial_ends_at: new Date(Date.now() - DAY).toISOString() }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
    expect(access.status).toBe("expired");
  });

  it("keeps a cancelled subscription usable until its paid period ends", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "cancelled",
        subscription_current_period_ends_at: new Date(Date.now() + 5 * DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("expires a cancelled subscription once its paid period has passed", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "cancelled",
        subscription_current_period_ends_at: new Date(Date.now() - DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
    expect(access.status).toBe("expired");
  });

  it("treats a grace period as still entitled", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "grace_period" }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  // The date stored against a billing issue is the end of the grace period, not
  // of the lapsed paid period, so a grace period that has run out is a dropped
  // EXPIRATION event — the same missed-webhook hole as a stale "active".
  it("stops trusting a grace period once its stored end has passed", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "grace_period",
        subscription_current_period_ends_at: new Date(Date.now() - DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
    expect(access.status).toBe("expired");
  });

  it("keeps a grace period entitled while the store is still retrying", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "grace_period",
        subscription_current_period_ends_at: new Date(Date.now() + 5 * DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("keeps an active subscription entitled while its paid period runs", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "active",
        subscription_current_period_ends_at: new Date(Date.now() + 20 * DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
    expect(access.status).toBe("active");
  });

  // The renewal webhook that would have pushed the period forward never
  // arrived. A stored "active" on its own must not grant Plus indefinitely.
  it("stops trusting a stored active status once its paid period has passed", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "active",
        subscription_current_period_ends_at: new Date(Date.now() - DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(false);
    expect(access.status).toBe("expired");
    expect(access.tier).toBe("free");
  });

  // Absent is not the same as lapsed: rows written before the column was
  // populated have no period end, and revoking on missing information would
  // lock out paying accounts.
  it("keeps an active subscription with no recorded period end", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_tier: "plus", subscription_status: "active" }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
  });

  it("keeps a live trial entitled regardless of the paid period end", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({
        subscription_tier: "plus",
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + 3 * DAY).toISOString(),
        subscription_current_period_ends_at: new Date(Date.now() - DAY).toISOString(),
      }),
      OWNER_ID,
    );
    expect(access.hasPlus).toBe(true);
    expect(access.status).toBe("trialing");
  });
});

describe("getVideoGenerationCount", () => {
  // A job that dies at the stitch has already had its scenes rendered and
  // billed, so it has to count against the free allowance like any other.
  it("counts failed jobs alongside running and completed ones", async () => {
    const statuses: string[][] = [];
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: (_column: string, values: string[]) => {
        statuses.push(values);
        return builder;
      },
      then: (resolve: (value: { count: number; error: null }) => unknown) => resolve({ count: 2, error: null }),
    };
    const supabase = { from: () => builder } as unknown as SupabaseClient;

    await expect(getVideoGenerationCount(supabase, OWNER_ID)).resolves.toBe(2);
    expect(statuses[0]).toContain("failed");
    expect(statuses[0]).toContain("completed");
  });
});

describe("isSubscriptionLockedOut", () => {
  it("does not lock out an account that has never subscribed", async () => {
    const access = await getSubscriptionAccess(fakeSupabase(null), OWNER_ID);
    expect(isSubscriptionLockedOut(access)).toBe(false);
  });

  it("locks out an account whose trial has ended", async () => {
    const access = await getSubscriptionAccess(
      fakeSupabase({ subscription_status: "trialing", trial_ends_at: new Date(Date.now() - DAY).toISOString() }),
      OWNER_ID,
    );
    expect(isSubscriptionLockedOut(access)).toBe(true);
  });
});
