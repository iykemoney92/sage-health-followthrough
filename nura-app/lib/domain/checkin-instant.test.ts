import { describe, expect, it } from "vitest";
import { checkInAccessGuidance, checkInInstantIso } from "@/lib/domain/message-intake";
import { wallTimeInTimeZoneToUtcIso } from "@/lib/timezone";

// The chat path: classifyWithClaude turns the model's local time into UTC, then applyNextCheckIn
// turns that into the stored instant. Until 9 Nov 2026 the second step converted again.
function storedInstant(modelWhen: string, tz: string) {
  return checkInInstantIso(wallTimeInTimeZoneToUtcIso(modelWhen, tz), tz);
}

describe("chat-booked check-in time", () => {
  it("keeps 06:00 in India at 06:00 (the 7 Nov bug stored 00:30)", () => {
    expect(storedInstant("2026-11-08T06:00:00+05:30", "Asia/Kolkata")).toBe("2026-11-08T00:30:00.000Z");
    expect(storedInstant("2026-11-08T06:00:00", "Asia/Kolkata")).toBe("2026-11-08T00:30:00.000Z");
  });

  it("keeps a Toronto evening time", () => {
    expect(storedInstant("2026-11-10T18:00:00-05:00", "America/Toronto")).toBe("2026-11-10T23:00:00.000Z");
    expect(storedInstant("2026-11-10T18:00:00", "America/Toronto")).toBe("2026-11-10T23:00:00.000Z");
  });

  it("keeps London summer time", () => {
    expect(storedInstant("2026-07-01T09:00:00", "Europe/London")).toBe("2026-07-01T08:00:00.000Z");
  });

  it("reads a bare wall time in the user's zone", () => {
    expect(checkInInstantIso("2026-11-08T06:00", "Asia/Kolkata")).toBe("2026-11-08T00:30:00.000Z");
  });

  it("treats a Z or offset as already absolute", () => {
    expect(checkInInstantIso("2026-11-08T00:30:00.000Z", "Asia/Kolkata")).toBe("2026-11-08T00:30:00.000Z");
    expect(checkInInstantIso("2026-11-08T06:00:00+05:30", "Europe/London")).toBe("2026-11-08T00:30:00.000Z");
  });
});

describe("check-in access guidance", () => {
  it("says nothing for Plus or unknown access", () => {
    expect(checkInAccessGuidance(null)).toBe("");
    expect(checkInAccessGuidance({ hasPlus: true, freeCheckInUsed: true })).toBe("");
  });

  it("tells the model the first one is free", () => {
    expect(checkInAccessGuidance({ hasPlus: false, freeCheckInUsed: false })).toContain("FIRST scheduled check-in is free");
  });

  it("tells the model nothing more goes out once the free one is used", () => {
    expect(checkInAccessGuidance({ hasPlus: false, freeCheckInUsed: true })).toContain("will NOT be sent");
  });
});
