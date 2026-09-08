import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncPlusFromRevenueCat } from "./sync-plus";

const DAY = 24 * 60 * 60 * 1000;
const OWNER_ID = "00000000-0000-0000-0000-000000000001";
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

/**
 * The sync reads the stored profile, then either upserts an entitlement onto it
 * or updates it back down to free. The fake records both so a test can assert on
 * what was actually written, and `updates` staying empty is what "left alone"
 * looks like.
 */
function fakeSupabase(profileRow: Record<string, unknown> | null) {
  const upserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const from = () => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: profileRow, error: null }),
      upsert: async (payload: Record<string, unknown>) => {
        upserts.push(payload);
        return { error: null };
      },
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    };
    return builder;
  };

  return { client: { from } as unknown as SupabaseClient, upserts, updates };
}

function revenueCatReturns(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })),
  );
}

beforeEach(() => {
  vi.stubEnv("CLARITI_REVENUECAT_REST_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("syncPlusFromRevenueCat", () => {
  it("writes Plus for a live subscription", async () => {
    revenueCatReturns({
      subscriber: {
        entitlements: { plus: { expires_date: iso(20 * DAY) } },
        subscriptions: { clariti_plus_monthly: { expires_date: iso(20 * DAY), period_type: "NORMAL" } },
      },
    });
    const { client, upserts } = fakeSupabase({ subscription_tier: "free" });

    const result = await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(result).toMatchObject({ ok: true, hasPlus: true, status: "active" });
    expect(upserts[0]).toMatchObject({ subscription_tier: "plus", subscription_status: "active" });
  });

  // The poller used to be upgrade-only, so a lapse or a refund that never
  // arrived as a webhook could not take Plus away at all.
  it("downgrades a profile RevenueCat no longer has an entitlement for", async () => {
    revenueCatReturns({ subscriber: { entitlements: {}, subscriptions: {} } });
    const { client, updates } = fakeSupabase({
      subscription_tier: "plus",
      subscription_status: "active",
      subscription_current_period_ends_at: iso(-DAY),
      revenuecat_app_user_id: OWNER_ID,
    });

    const result = await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(result).toMatchObject({ ok: true, hasPlus: false, reason: "downgraded" });
    expect(updates[0]).toMatchObject({ subscription_tier: "free", subscription_status: "expired" });
  });

  // A refund revokes access now, even though the period we recorded still has
  // time left on it.
  it("downgrades a refund whose recorded period has not run out yet", async () => {
    revenueCatReturns({ subscriber: { entitlements: { plus: { expires_date: iso(-DAY) } }, subscriptions: {} } });
    const { client, updates } = fakeSupabase({
      subscription_tier: "plus",
      subscription_status: "active",
      subscription_current_period_ends_at: iso(10 * DAY),
      revenuecat_app_user_id: OWNER_ID,
    });

    await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(updates[0]).toMatchObject({ subscription_tier: "free", subscription_status: "expired" });
  });

  // Clariti grants the card trial itself, so RevenueCat having nothing on file
  // is expected during it and is not evidence of a lapse.
  it("leaves a trial that has not run out alone", async () => {
    revenueCatReturns({ subscriber: { entitlements: {}, subscriptions: {} } });
    const { client, updates } = fakeSupabase({
      subscription_tier: "plus",
      subscription_status: "trialing",
      trial_ends_at: iso(3 * DAY),
    });

    const result = await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(result).toMatchObject({ hasPlus: true, reason: "local_trial_active" });
    expect(updates).toHaveLength(0);
  });

  it("downgrades a trial that has run out", async () => {
    revenueCatReturns({ subscriber: { entitlements: {}, subscriptions: {} } });
    const { client, updates } = fakeSupabase({
      subscription_tier: "plus",
      subscription_status: "trialing",
      trial_ends_at: iso(-DAY),
      revenuecat_app_user_id: OWNER_ID,
    });

    await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(updates[0]).toMatchObject({ subscription_tier: "free", subscription_status: "expired" });
  });

  // RevenueCat is not the source of truth for a Stripe-billed account, so an
  // empty subscriber response there means nothing.
  it("leaves a Stripe-billed account alone", async () => {
    revenueCatReturns({ subscriber: { entitlements: {}, subscriptions: {} } });
    const { client, updates } = fakeSupabase({
      subscription_tier: "plus",
      subscription_status: "active",
      stripe_customer_id: "cus_123",
    });

    await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(updates).toHaveLength(0);
  });

  // RevenueCat answers 200 with no entitlements for a subscriber it has never
  // seen, so a key pointed at the wrong project would otherwise read as a lapse
  // and revoke a paying subscriber.
  it("leaves an account RevenueCat has no record of alone", async () => {
    revenueCatReturns({ subscriber: { entitlements: {}, subscriptions: {} } });
    const { client, updates } = fakeSupabase({
      subscription_tier: "plus",
      subscription_status: "active",
      subscription_current_period_ends_at: iso(10 * DAY),
    });

    const result = await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(result).toMatchObject({ hasPlus: false, reason: "no_active_entitlement" });
    expect(updates).toHaveLength(0);
  });

  it("leaves a free profile untouched", async () => {
    revenueCatReturns({ subscriber: { entitlements: {}, subscriptions: {} } });
    const { client, updates } = fakeSupabase({ subscription_tier: "free", subscription_status: "free" });

    const result = await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(result).toMatchObject({ hasPlus: false, reason: "no_active_entitlement" });
    expect(updates).toHaveLength(0);
  });

  // A RevenueCat outage must not be read as "everybody lapsed".
  it("does not downgrade when the RevenueCat call fails", async () => {
    revenueCatReturns({}, false);
    const { client, updates } = fakeSupabase({ subscription_tier: "plus", subscription_status: "active" });

    const result = await syncPlusFromRevenueCat(client, OWNER_ID);

    expect(result).toMatchObject({ ok: false, reason: "rc_fetch_failed" });
    expect(updates).toHaveLength(0);
  });
});
