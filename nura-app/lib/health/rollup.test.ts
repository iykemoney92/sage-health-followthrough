import { describe, expect, it } from "vitest";
import { rollupAggregates, rollupBloodPressure, rollupSleep } from "./rollup";

const TZ = "Europe/London";

describe("rollupSleep", () => {
  it("counts overlapping watch and phone samples once and files them under the wake-up day", () => {
    const rows = rollupSleep(
      [
        { value: 420, startDate: "2026-10-22T22:30:00Z", endDate: "2026-10-23T05:30:00Z", sleepState: "asleep" },
        { value: 360, startDate: "2026-10-22T23:00:00Z", endDate: "2026-10-23T05:00:00Z", sleepState: "asleep" },
        { value: 30, startDate: "2026-10-23T05:30:00Z", endDate: "2026-10-23T06:00:00Z", sleepState: "awake" },
        { value: 480, startDate: "2026-10-22T22:00:00Z", endDate: "2026-10-23T06:00:00Z", sleepState: "inBed" },
      ],
      TZ,
    );
    expect(rows).toEqual([{ day: "2026-10-23", metric: "sleep_minutes", value: 420, value_secondary: null, sample_count: 1 }]);
  });

  it("uses stage segments when a session has them", () => {
    const rows = rollupSleep(
      [
        {
          value: 480,
          startDate: "2026-10-23T22:00:00Z",
          endDate: "2026-10-24T06:00:00Z",
          stages: [
            { startDate: "2026-10-23T22:00:00Z", endDate: "2026-10-24T01:00:00Z", stage: "light" },
            { startDate: "2026-10-24T01:00:00Z", endDate: "2026-10-24T02:00:00Z", stage: "awake" },
            { startDate: "2026-10-24T02:00:00Z", endDate: "2026-10-24T06:00:00Z", stage: "deep" },
          ],
        },
      ],
      TZ,
    );
    expect(rows[0]).toMatchObject({ day: "2026-10-24", value: 420 });
  });

  it("drops fragments under half an hour", () => {
    expect(
      rollupSleep([{ value: 20, startDate: "2026-10-23T13:00:00Z", endDate: "2026-10-23T13:20:00Z", sleepState: "asleep" }], TZ),
    ).toEqual([]);
  });
});

describe("rollupAggregates", () => {
  it("skips empty step days rather than storing zero", () => {
    const rows = rollupAggregates(
      "steps",
      [
        { startDate: "2026-10-22T23:00:00Z", value: 0 },
        { startDate: "2026-10-23T23:00:00Z", value: 8123.4 },
      ],
      TZ,
    );
    expect(rows).toEqual([{ day: "2026-10-24", metric: "steps", value: 8123, value_secondary: null, sample_count: 1 }]);
  });

  it("drops implausible readings", () => {
    expect(rollupAggregates("resting_hr", [{ startDate: "2026-10-23T23:00:00Z", value: 400 }], TZ)).toEqual([]);
  });
});

describe("rollupBloodPressure", () => {
  it("keeps the day's latest reading and counts the rest", () => {
    const rows = rollupBloodPressure(
      [
        { value: 130, systolic: 130, diastolic: 85, startDate: "2026-10-23T07:00:00Z", endDate: "2026-10-23T07:00:00Z" },
        { value: 124, systolic: 124, diastolic: 80, startDate: "2026-10-23T19:00:00Z", endDate: "2026-10-23T19:00:00Z" },
        { value: 120, startDate: "2026-10-23T20:00:00Z", endDate: "2026-10-23T20:00:00Z" },
      ],
      TZ,
    );
    expect(rows).toEqual([{ day: "2026-10-23", metric: "blood_pressure", value: 124, value_secondary: 80, sample_count: 2 }]);
  });
});
