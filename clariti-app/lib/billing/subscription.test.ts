import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionAccess, getVideoGenerationCount, isSubscriptionLockedOut } from "./subscription";

const DAY = 24 * 60 * 60 * 1000;
const OWNER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * getSubscriptionAccess issues a profile read ending in maybeSingle plus the
 * count queries, which are awaited on the query builder itself. The fake is
 * therefore both chainable and thenable — awaiting it yields a count and a row
 * list, calling maybeSingle yields the profile. The video count runs three
 * queries over one table, so `videos` is attributed to the completed one.
 */
function fakeSupabase(profileRow: Record<string, unknown> | null, counts = { documents: 0, videos: 0 }) {
  const from = (table: string) => {
    const filters: Record<string, string> = {};
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: string) => {
        filters[column] = value;
        return builder;
      },
      in: () => builder,
      maybeSingle: async () => ({ data: profileRow, error: null }),
      then: (resolve: (value: { data: unknown[]; count: number; error: null }) => unknown) => resolve({
        data: [],
        count: table === "clariti_documents"
          ? counts.documents
          : filters.status === "completed" ? counts.videos : 0,
        error: null,
      }),
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

type VideoRow = { status: string; scenes?: unknown; provider_response?: unknown };

/**
 * getVideoGenerationCount asks the one table three questions — the completed
 * count, the unfinished count, and the failed rows themselves. The fake answers
 * all three from the same set of rows, so a test only has to describe the jobs.
 */
function fakeVideoSupabase(rows: VideoRow[]) {
  const from = () => {
    let matches: (row: VideoRow) => boolean = () => true;
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: string) => {
        if (column === "status") {
          const previous = matches;
          matches = (row) => previous(row) && row.status === value;
        }
        return builder;
      },
      in: (column: string, values: string[]) => {
        if (column === "status") {
          const previous = matches;
          matches = (row) => previous(row) && values.includes(row.status);
        }
        return builder;
      },
      then: (resolve: (value: { data: VideoRow[]; count: number; error: null }) => unknown) => {
        const matched = rows.filter(matches);
        return resolve({ data: matched, count: matched.length, error: null });
      },
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

const RENDERED_SCENES = [{ sceneIndex: 0, videoUrl: "/api/media/owner/job/segment-0.mp4" }];

describe("getVideoGenerationCount", () => {
  it("counts a finished explainer", async () => {
    const supabase = fakeVideoSupabase([{ status: "completed", scenes: RENDERED_SCENES }]);
    await expect(getVideoGenerationCount(supabase, OWNER_ID)).resolves.toBe(1);
  });

  // enforceFreeLimit runs before the queued row is inserted, so a job that only
  // counted once it had a clip let a free account start several renders at once.
  it("holds the slot for a job that is still in flight", async () => {
    const supabase = fakeVideoSupabase([
      { status: "queued", scenes: [] },
      { status: "generating_scenes", scenes: [] },
    ]);
    await expect(getVideoGenerationCount(supabase, OWNER_ID)).resolves.toBe(2);
  });

  // flux-single is what production runs: one call, and the scene URL is written
  // on the success path only. The failed row carries the provider_response
  // processJob wrote, which is the evidence the render was paid for.
  it("counts a failed job that reached the provider", async () => {
    const supabase = fakeVideoSupabase([
      { status: "failed", scenes: [], provider_response: { rawError: "the video model returned no file" } },
    ]);
    await expect(getVideoGenerationCount(supabase, OWNER_ID)).resolves.toBe(1);
  });

  it("counts a failed job that kept the clips it already rendered", async () => {
    const supabase = fakeVideoSupabase([{ status: "failed", scenes: RENDERED_SCENES }]);
    await expect(getVideoGenerationCount(supabase, OWNER_ID)).resolves.toBe(1);
  });

  // Nothing but processJob writes provider_response, so a failed row without one
  // never got as far as a render and cost nothing to refuse.
  it("does not charge for a job that failed before any render", async () => {
    const supabase = fakeVideoSupabase([{ status: "failed", scenes: [], provider_response: null }]);
    await expect(getVideoGenerationCount(supabase, OWNER_ID)).resolves.toBe(0);
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
