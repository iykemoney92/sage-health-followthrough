import { describe, expect, it } from "vitest";
import {
  IDLE_WELLNESS_GAP_MS,
  idleWellnessPrompt,
  isIdleLongEnough,
  isWithinQuietHours,
  pickIdleChannel,
} from "./idle-wellness";

describe("isWithinQuietHours", () => {
  it("is inactive when quiet hours are disabled", () => {
    const now = new Date("2026-08-02T23:30:00.000Z");
    expect(
      isWithinQuietHours(now, {
        enabled: false,
        start: "22:00",
        end: "07:00",
        allowUrgent: true,
      }),
    ).toBe(false);
  });

  it("handles overnight windows in UTC", () => {
    const late = new Date("2026-08-02T23:30:00.000Z");
    const midday = new Date("2026-08-02T12:00:00.000Z");
    const quiet = { enabled: true, start: "22:00", end: "07:00", allowUrgent: true };
    expect(isWithinQuietHours(late, quiet)).toBe(true);
    expect(isWithinQuietHours(midday, quiet)).toBe(false);
  });

  it("handles same-day windows", () => {
    const during = new Date("2026-08-02T14:00:00.000Z");
    const after = new Date("2026-08-02T18:00:00.000Z");
    const quiet = { enabled: true, start: "13:00", end: "17:00", allowUrgent: false };
    expect(isWithinQuietHours(during, quiet)).toBe(true);
    expect(isWithinQuietHours(after, quiet)).toBe(false);
  });
});

describe("isIdleLongEnough", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  it("treats never-contacted users as idle", () => {
    expect(isIdleLongEnough(null, now)).toBe(true);
  });

  it("requires the configured silence gap", () => {
    const recent = new Date(now.getTime() - IDLE_WELLNESS_GAP_MS + 60_000);
    const old = new Date(now.getTime() - IDLE_WELLNESS_GAP_MS - 60_000);
    expect(isIdleLongEnough(recent, now)).toBe(false);
    expect(isIdleLongEnough(old, now)).toBe(true);
  });
});

describe("pickIdleChannel", () => {
  it("prefers the user's preferred channel when allowed", () => {
    expect(pickIdleChannel(["voice", "whatsapp", "in_app"], "whatsapp")).toBe("whatsapp");
  });

  it("falls back when preferred is not allowed", () => {
    expect(pickIdleChannel(["in_app"], "voice")).toBe("in_app");
  });
});

describe("idleWellnessPrompt", () => {
  it("names the Care plan", () => {
    const prompt = idleWellnessPrompt("Sleep rhythm");
    expect(prompt).toContain("Sleep rhythm");
    expect(prompt.toLowerCase()).toContain("wellness");
  });
});
