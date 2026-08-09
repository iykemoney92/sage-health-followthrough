import { describe, expect, it } from "vitest";
import {
  IDLE_WELLNESS_GAP_MS,
  idleWellnessPrompt,
  isIdleLongEnough,
  isWithinQuietHours,
  nextTimeOutsideQuietHours,
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

describe("nextTimeOutsideQuietHours", () => {
  it("leaves a time outside quiet hours untouched", () => {
    const midday = new Date("2026-08-02T12:00:00.000Z");
    const quiet = { enabled: true, start: "22:00", end: "07:00", allowUrgent: true };
    expect(nextTimeOutsideQuietHours(midday, quiet, "UTC")).toEqual(midday);
  });

  it("pushes an overnight-window time to the end boundary on the correct day", () => {
    // 23:30 UTC is inside 22:00-07:00 and after the start boundary, so the window's end (07:00)
    // falls the next calendar day.
    const late = new Date("2026-08-02T23:30:00.000Z");
    const quiet = { enabled: true, start: "22:00", end: "07:00", allowUrgent: true };
    const result = nextTimeOutsideQuietHours(late, quiet, "UTC");
    expect(result.toISOString()).toBe("2026-08-03T07:00:00.000Z");
  });

  it("pushes an early-morning tail of an overnight window to the same-day end boundary", () => {
    // 03:00 UTC is inside 22:00-07:00 but before the start boundary, so 07:00 is still today.
    const early = new Date("2026-08-02T03:00:00.000Z");
    const quiet = { enabled: true, start: "22:00", end: "07:00", allowUrgent: true };
    const result = nextTimeOutsideQuietHours(early, quiet, "UTC");
    expect(result.toISOString()).toBe("2026-08-02T07:00:00.000Z");
  });

  it("pushes a same-day window to its end boundary later the same day", () => {
    const during = new Date("2026-08-02T14:00:00.000Z");
    const quiet = { enabled: true, start: "13:00", end: "17:00", allowUrgent: false };
    const result = nextTimeOutsideQuietHours(during, quiet, "UTC");
    expect(result.toISOString()).toBe("2026-08-02T17:00:00.000Z");
  });

  it("respects the user's timezone, not server UTC", () => {
    // 23:00 local time in America/New_York (UTC-4 in August) is 03:00 UTC the next day.
    const localLateNight = new Date("2026-08-03T03:00:00.000Z");
    const quiet = { enabled: true, start: "22:00", end: "07:00", allowUrgent: true };
    const result = nextTimeOutsideQuietHours(localLateNight, quiet, "America/New_York");
    // End boundary is 07:00 local time same local day -> 11:00 UTC.
    expect(result.toISOString()).toBe("2026-08-03T11:00:00.000Z");
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

  it("prefers voice over WhatsApp when no explicit preferred is set", () => {
    expect(pickIdleChannel(["whatsapp", "in_app", "voice"], null)).toBe("voice");
  });
});

describe("idleWellnessPrompt", () => {
  it("names the Care plan", () => {
    const prompt = idleWellnessPrompt("Sleep rhythm");
    expect(prompt).toContain("Sleep rhythm");
    expect(prompt.toLowerCase()).toContain("wellness");
  });
});
