import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RATE_LIMITS, enforceRateLimit } from "./rate-limit";

/**
 * The RPC is the counter, so the fake is one: it tallies per route name and
 * hands back the running count, which is exactly what the real function
 * returns.
 */
function fakeSupabase({ down = false } = {}) {
  const counts = new Map<string, number>();
  const client = {
    rpc: async (_name: string, args: { p_route: string }) => {
      if (down) return { data: null, error: { message: "increment unavailable" } };
      const next = (counts.get(args.p_route) ?? 0) + 1;
      counts.set(args.p_route, next);
      return { data: next, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, counts };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("video ceilings", () => {
  // These two are the ceiling on money, so they are pinned rather than left to
  // drift: one explainer is five Veo renders plus a stitch.
  it("keeps the claim ceilings at the audited numbers", () => {
    expect(RATE_LIMITS.videos).toEqual({ limit: 3, windowSeconds: 3600 });
    expect(RATE_LIMITS.videosDaily).toEqual({ limit: 10, windowSeconds: 86_400 });
  });

  // Queuing and claiming are separate requests, usually in separate windows. On
  // one shared budget an attacker banks free queued jobs in one hour and claims
  // them all in the next, so the half that spends the money gets the whole
  // budget to itself.
  it("does not let queued jobs eat the budget the claims are charged against", async () => {
    const { client, counts } = fakeSupabase();

    for (let queued = 0; queued < RATE_LIMITS.videosQueue.limit; queued += 1) {
      expect(await enforceRateLimit(client, "videosQueue", "videosQueueDaily")).toBeNull();
    }
    expect(counts.get("videos")).toBeUndefined();

    for (let claimed = 0; claimed < RATE_LIMITS.videos.limit; claimed += 1) {
      expect(await enforceRateLimit(client, "videos", "videosDaily")).toBeNull();
    }

    const refused = await enforceRateLimit(client, "videos", "videosDaily");
    expect(refused?.status).toBe(429);
  });

  it("refuses the claim once the daily ceiling is met even in a fresh hour", async () => {
    const { client } = fakeSupabase();

    for (let claimed = 0; claimed < RATE_LIMITS.videosDaily.limit; claimed += 1) {
      // The hourly window is charged too, so spend it from a counter that never
      // fills: what is under test is the daily one.
      await enforceRateLimit(client, "videosDaily");
    }

    const refused = await enforceRateLimit(client, "videosDaily");
    expect(refused?.status).toBe(429);
  });

  // A spend check that did not run has authorised nothing.
  it("fails closed on every video window and open on the cheap routes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeSupabase({ down: true });

    for (const route of ["videos", "videosDaily", "videosQueue", "videosQueueDaily"] as const) {
      expect((await enforceRateLimit(client, route))?.status).toBe(429);
    }

    expect(await enforceRateLimit(client, "extract")).toBeNull();
    expect(await enforceRateLimit(client, "messages")).toBeNull();
  });
});
