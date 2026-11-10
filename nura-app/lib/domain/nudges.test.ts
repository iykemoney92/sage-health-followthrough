import { describe, expect, it } from "vitest";
import { canEmail, needsOnboardingNudge, skipNoticeDue, ONBOARDING_NUDGE_KEY, PLUS_SKIP_NOTICE_KEY } from "./nudges";

const now = Date.parse("2026-11-11T09:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const base = { id: "u1", email: "ela@gmail.com", email_confirmed_at: hoursAgo(30), created_at: hoursAgo(30), user_metadata: {} };

describe("needsOnboardingNudge", () => {
  it("nudges a confirmed sign-up who stopped part-way, after a day", () => {
    expect(needsOnboardingNudge(base, now)).toBe(true);
  });
  it("waits the first 24 hours", () => {
    expect(needsOnboardingNudge({ ...base, created_at: hoursAgo(10) }, now)).toBe(false);
  });
  it("leaves sign-ups older than a week alone", () => {
    expect(needsOnboardingNudge({ ...base, created_at: hoursAgo(24 * 8) }, now)).toBe(false);
  });
  it("skips finished, care-circle, already nudged and unconfirmed accounts", () => {
    expect(needsOnboardingNudge({ ...base, user_metadata: { onboarding_complete: true } }, now)).toBe(false);
    expect(needsOnboardingNudge({ ...base, user_metadata: { joined_via_care_circle: true } }, now)).toBe(false);
    expect(needsOnboardingNudge({ ...base, user_metadata: { [ONBOARDING_NUDGE_KEY]: hoursAgo(1) } }, now)).toBe(false);
    expect(needsOnboardingNudge({ ...base, email_confirmed_at: null }, now)).toBe(false);
  });
  it("never emails our own, demo or relay addresses", () => {
    for (const email of ["sarah.nura.demo@example.com", "x@privaterelay.appleid.com", "labszapx@gmail.com", "a@yopmail.com", "hi@zapxlabs.com"]) {
      expect(canEmail(email)).toBe(false);
    }
    expect(canEmail("someone@gmail.com")).toBe(true);
  });
});

describe("skipNoticeDue", () => {
  it("sends the first notice and then at most once a week", () => {
    expect(skipNoticeDue({}, now)).toBe(true);
    expect(skipNoticeDue({ [PLUS_SKIP_NOTICE_KEY]: hoursAgo(24 * 3) }, now)).toBe(false);
    expect(skipNoticeDue({ [PLUS_SKIP_NOTICE_KEY]: hoursAgo(24 * 7) }, now)).toBe(true);
  });
});
