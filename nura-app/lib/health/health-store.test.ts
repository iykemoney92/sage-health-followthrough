import { describe, expect, it } from "vitest";
import { pickOneSourcePerMetric, type SourcedHealthRow } from "./health-store";

function row(day: string, metric: SourcedHealthRow["metric"], platform: SourcedHealthRow["platform"], value: number): SourcedHealthRow {
  return { day, metric, platform, value, value_secondary: null, sample_count: 1 };
}

describe("pickOneSourcePerMetric", () => {
  it("never mixes two phones within one metric", () => {
    const rows = [
      row("2026-10-20", "steps", "apple_health", 9000),
      row("2026-10-21", "steps", "apple_health", 8800),
      row("2026-10-21", "steps", "health_connect", 1200),
    ];
    expect(pickOneSourcePerMetric(rows).map((r) => r.platform)).toEqual(["apple_health", "apple_health"]);
  });

  it("chooses per metric, so each phone can supply what it actually tracks", () => {
    const rows = [
      row("2026-10-20", "steps", "apple_health", 9000),
      row("2026-10-20", "sleep_minutes", "health_connect", 420),
      row("2026-10-21", "sleep_minutes", "health_connect", 400),
    ];
    const picked = pickOneSourcePerMetric(rows);
    expect(picked.find((r) => r.metric === "steps")?.platform).toBe("apple_health");
    expect(picked.filter((r) => r.metric === "sleep_minutes").every((r) => r.platform === "health_connect")).toBe(true);
  });

  it("breaks a tie in favour of the newer data", () => {
    const rows = [row("2026-10-20", "steps", "apple_health", 9000), row("2026-10-22", "steps", "health_connect", 7000)];
    expect(pickOneSourcePerMetric(rows).map((r) => r.platform)).toEqual(["health_connect"]);
  });
});
