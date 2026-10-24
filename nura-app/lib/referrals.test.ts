import { describe, expect, it } from "vitest";
import { referralShareText } from "@/lib/referral-share";
import {
  friendEligibility,
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_PATTERN,
  REFERRER_MONTHLY_LIMIT,
  referralUrl,
} from "@/lib/referrals";

const now = new Date("2026-10-24T12:00:00Z");
const base = {
  referrerId: "referrer",
  refereeId: "friend",
  refereeCreatedAt: "2026-10-24T11:00:00Z",
  profile: null,
  referrerRewardsLast30Days: 0,
  now,
};

describe("referral codes", () => {
  it("generates codes people can read aloud", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateReferralCode();
      expect(code).toMatch(REFERRAL_CODE_PATTERN);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it("accepts pasted codes with stray case, spaces and slashes", () => {
    expect(normalizeReferralCode(" k7mq2xpa/ ")).toBe("K7MQ2XPA");
    expect(normalizeReferralCode("K7MQ2XP")).toBeNull();
    expect(normalizeReferralCode("K7MQ2XP0")).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });

  it("builds the link without a double slash", () => {
    expect(referralUrl("https://usenura.app/", "K7MQ2XPA")).toBe("https://usenura.app/r/K7MQ2XPA");
  });
});

describe("friendEligibility", () => {
  it("lets a brand-new account take the gift", () => {
    expect(friendEligibility(base)).toEqual({ ok: true });
  });

  it("refuses your own link", () => {
    expect(friendEligibility({ ...base, refereeId: "referrer" })).toEqual({ ok: false, reason: "self" });
  });

  it("refuses accounts older than two weeks", () => {
    expect(friendEligibility({ ...base, refereeCreatedAt: "2026-10-01T00:00:00Z" })).toEqual({
      ok: false,
      reason: "existing_account",
    });
    expect(friendEligibility({ ...base, refereeCreatedAt: null })).toEqual({ ok: false, reason: "existing_account" });
  });

  it("refuses anyone who has had a trial, subscription or grant", () => {
    for (const profile of [
      { trial_started_at: "2026-10-20T00:00:00Z" },
      { subscription_status: "expired" },
      { subscription_status: "active" },
      { complimentary_plus_until: "2026-11-01T00:00:00Z" },
    ]) {
      expect(friendEligibility({ ...base, profile })).toEqual({ ok: false, reason: "already_had_plus" });
    }
  });

  it("still lets a fresh free profile through", () => {
    expect(friendEligibility({ ...base, profile: { subscription_status: "free" } })).toEqual({ ok: true });
  });

  it("stops a link once it has given its monthly share", () => {
    expect(friendEligibility({ ...base, referrerRewardsLast30Days: REFERRER_MONTHLY_LIMIT })).toEqual({
      ok: false,
      reason: "referrer_limit",
    });
    expect(friendEligibility({ ...base, referrerRewardsLast30Days: REFERRER_MONTHLY_LIMIT - 1 })).toEqual({ ok: true });
  });
});

describe("referralShareText", () => {
  it("mentions the gift on the web only", () => {
    expect(referralShareText("https://usenura.app/r/K7MQ2XPA", { mentionGift: true })).toContain("30 days of Nura Plus");
    expect(referralShareText("https://usenura.app/r/K7MQ2XPA", { mentionGift: false })).not.toMatch(/free|Plus/);
  });
});
