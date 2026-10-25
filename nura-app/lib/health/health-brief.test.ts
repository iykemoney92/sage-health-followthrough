import { describe, expect, it } from "vitest";
import {
  addDays,
  buildHealthBrief,
  detectHealthSignals,
  formatMinutes,
  healthSignalCheckInPrompt,
  localDay,
} from "./health-brief";
import { metricsForCategory, type HealthDailyRow, type HealthMetric } from "./metrics";

const NOW = new Date("2026-10-24T09:00:00.000Z");
const TODAY = "2026-10-24";
const SYNCED = "2026-10-24T08:10:00.000Z";

/** `count` consecutive days ending `endOffset` days before TODAY, all with `value`. */
function series(metric: HealthMetric, value: number, count: number, endOffset = 0, secondary: number | null = null) {
  return Array.from({ length: count }, (_, i): HealthDailyRow => ({
    day: addDays(TODAY, -endOffset - i),
    metric,
    value,
    value_secondary: secondary,
  }));
}

function brief(rows: HealthDailyRow[], category = "mental_wellbeing", overrides: Partial<Parameters<typeof buildHealthBrief>[0]> = {}) {
  return buildHealthBrief({
    rows,
    category,
    platforms: ["apple_health"],
    timeZone: "Europe/London",
    now: NOW,
    lastSyncedAt: SYNCED,
    ...overrides,
  });
}

describe("day helpers", () => {
  it("reads the local date in the user's timezone", () => {
    expect(localDay(new Date("2026-10-24T23:30:00.000Z"), "Asia/Tokyo")).toBe("2026-10-25");
    expect(localDay(new Date("2026-10-24T23:30:00.000Z"), "America/New_York")).toBe("2026-10-24");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats minutes to the nearest five", () => {
    expect(formatMinutes(312)).toBe("5h 10m");
    expect(formatMinutes(419)).toBe("7h");
    expect(formatMinutes(40)).toBe("40m");
  });
});

describe("buildHealthBrief", () => {
  it("reports a sleep drop against the person's own normal", () => {
    const rows = [...series("sleep_minutes", 310, 3), ...series("sleep_minutes", 420, 28, 3)];
    const text = brief(rows)!;
    expect(text).toContain("Apple Health");
    expect(text).toContain("Sleep has averaged 5h 10m over the last 3 nights; usually about 7h.");
  });

  it("says nothing notable when the data is fresh but steady", () => {
    const rows = [...series("sleep_minutes", 415, 31), ...series("steps", 8000, 35, 1)];
    expect(brief(rows)).toContain("Nothing notable has changed recently.");
  });

  it("stays silent when the last sync is more than three days old", () => {
    const rows = [...series("sleep_minutes", 310, 3), ...series("sleep_minutes", 420, 28, 3)];
    expect(brief(rows, "mental_wellbeing", { lastSyncedAt: "2026-10-20T08:00:00.000Z" })).toBeNull();
  });

  it("stays silent when the newest relevant day is old, even after a recent sync", () => {
    expect(brief(series("sleep_minutes", 420, 28, 5))).toBeNull();
  });

  it("stays silent without a sync at all", () => {
    expect(brief(series("sleep_minutes", 420, 30), "mental_wellbeing", { lastSyncedAt: null })).toBeNull();
  });

  it("does not compare until there are 14 days of history", () => {
    const rows = [...series("sleep_minutes", 300, 3), ...series("sleep_minutes", 450, 10, 3)];
    expect(brief(rows)).toContain("Nothing notable");
  });

  it("never mentions weight on a wellbeing or postpartum plan", () => {
    const rows = [...series("weight_kg", 82, 20), ...series("sleep_minutes", 420, 31)];
    expect(brief(rows, "mental_wellbeing")).not.toMatch(/weight/i);
    expect(brief(rows, "postpartum_aftercare")).not.toMatch(/weight/i);
    expect(brief(rows, "gp_follow_up")).toContain("Latest weight reading: 82.0 kg");
  });

  it("gives the latest weight and blood pressure on a GP follow-up plan", () => {
    const rows = [
      ...series("weight_kg", 82.4, 1),
      { day: addDays(TODAY, -1), metric: "blood_pressure" as const, value: 138, value_secondary: 88, sample_count: 2 },
    ];
    const text = brief(rows, "gp_follow_up")!;
    expect(text).toContain("Latest weight reading: 82.4 kg on Sat 24 Oct.");
    expect(text).toContain("Latest blood pressure reading: 138/88 on Fri 23 Oct. 2 readings logged this past week.");
  });

  it("reports a large step drop with rounded numbers, skipping today's partial count", () => {
    const rows = [
      { day: TODAY, metric: "steps" as const, value: 200, value_secondary: null },
      ...series("steps", 3900, 7, 1),
      ...series("steps", 9000, 28, 8),
    ];
    expect(brief(rows, "recovery_aftercare")).toContain(
      "Steps are about 55% below their usual level this past week (around 3,900 a day; usually 9,000).",
    );
  });
});

describe("detectHealthSignals", () => {
  it("flags three short nights against a 28-night baseline", () => {
    const rows = [...series("sleep_minutes", 300, 3), ...series("sleep_minutes", 420, 28, 3)];
    expect(detectHealthSignals(rows, TODAY, metricsForCategory("mental_wellbeing"))).toEqual([
      { signal: "sleep_drop", windowStart: "2026-10-22", detail: { recent_minutes: 300, usual_minutes: 420, nights: 3 } },
    ]);
  });

  it("needs all three nights, not two", () => {
    const rows = [...series("sleep_minutes", 300, 2), ...series("sleep_minutes", 420, 28, 3)];
    expect(detectHealthSignals(rows, TODAY, ["sleep_minutes"])).toEqual([]);
  });

  it("ignores a drop smaller than 90 minutes", () => {
    const rows = [...series("sleep_minutes", 340, 3), ...series("sleep_minutes", 420, 28, 3)];
    expect(detectHealthSignals(rows, TODAY, ["sleep_minutes"])).toEqual([]);
  });

  it("flags a week under half of usual steps", () => {
    const rows = [...series("steps", 3000, 7, 1), ...series("steps", 8000, 28, 8)];
    const [signal] = detectHealthSignals(rows, TODAY, ["steps"]);
    expect(signal.signal).toBe("activity_drop");
    expect(signal.windowStart).toBe("2026-10-17");
  });

  it("only looks at metrics the plan allows", () => {
    const rows = [...series("steps", 3000, 7, 1), ...series("steps", 8000, 28, 8)];
    expect(detectHealthSignals(rows, TODAY, [])).toEqual([]);
  });
});

describe("healthSignalCheckInPrompt", () => {
  it("never carries numbers or metric names, because the Care circle can read check-ins", () => {
    const prompt = healthSignalCheckInPrompt("Sleep rhythm");
    expect(prompt).not.toMatch(/\d/);
    expect(prompt).not.toMatch(/sleep has|steps|heart|weight|blood/i);
  });
});
