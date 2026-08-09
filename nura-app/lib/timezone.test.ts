import { describe, expect, it } from "vitest";
import { formatInTimeZone, wallTimeInTimeZoneToUtcIso } from "@/lib/timezone";

describe("wallTimeInTimeZoneToUtcIso", () => {
  it("maps London winter noon to 12:00Z", () => {
    const iso = wallTimeInTimeZoneToUtcIso("2026-01-15T12:30:00", "Europe/London");
    expect(iso).toBe("2026-01-15T12:30:00.000Z");
  });

  it("maps London summer noon to 11:00Z (BST)", () => {
    const iso = wallTimeInTimeZoneToUtcIso("2026-08-07T12:30:00", "Europe/London");
    expect(iso).toBe("2026-08-07T11:30:00.000Z");
  });

  it("keeps explicit offsets", () => {
    const iso = wallTimeInTimeZoneToUtcIso("2026-08-07T12:30:00+01:00", "UTC");
    expect(iso).toBe("2026-08-07T11:30:00.000Z");
  });

  it("reinterprets trailing Z as London wall clock (not absolute UTC)", () => {
    // Agent said 19:16Z but meant 19:16 BST → 18:16Z
    const iso = wallTimeInTimeZoneToUtcIso("2026-08-13T19:16:00.000Z", "Europe/London");
    expect(iso).toBe("2026-08-13T18:16:00.000Z");
  });

  it("treats trailing Z as absolute when user is UTC", () => {
    const iso = wallTimeInTimeZoneToUtcIso("2026-08-13T19:16:00.000Z", "UTC");
    expect(iso).toBe("2026-08-13T19:16:00.000Z");
  });
});

describe("formatInTimeZone", () => {
  it("shows London local label", () => {
    const label = formatInTimeZone("2026-08-07T11:30:00.000Z", "Europe/London", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    expect(label.toLowerCase()).toContain("12:30");
  });
});
