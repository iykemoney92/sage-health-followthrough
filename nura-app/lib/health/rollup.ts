/**
 * Rolls raw Health samples up into the daily summaries Nura stores.
 *
 * Runs on the device (lib/health/native-health.ts) and is kept pure so it can be
 * tested without a phone. Days are the device's local calendar days — the clock the
 * person actually slept and walked by.
 */

import type { HealthDailyRow } from "@/lib/health/metrics";
import { isPlausibleHealthValue } from "@/lib/health/metrics";

/** The fields of a plugin sample this module reads. */
export type RawSample = {
  value: number;
  startDate: string;
  endDate: string;
  sleepState?: string;
  stages?: { startDate: string; endDate: string; stage: string }[];
  systolic?: number;
  diastolic?: number;
};

export type RawAggregate = { startDate: string; value: number };

const ASLEEP_STATES = new Set(["asleep", "rem", "deep", "light"]);

/** Local YYYY-MM-DD of an instant, in the runtime's timezone (or the one given, for tests). */
export function deviceDay(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

/** Daily buckets from queryAggregated (steps, resting HR, weight). Empty buckets are skipped. */
export function rollupAggregates(
  metric: "steps" | "resting_hr" | "weight_kg",
  buckets: RawAggregate[],
  timeZone?: string,
): HealthDailyRow[] {
  const rows: HealthDailyRow[] = [];
  for (const bucket of buckets) {
    if (!Number.isFinite(bucket.value)) continue;
    // A day with no steps recorded is "no data", not "zero steps" — the phone may have been off.
    if (metric === "steps" && bucket.value <= 0) continue;
    const value = metric === "steps" ? Math.round(bucket.value) : Math.round(bucket.value * 10) / 10;
    if (!isPlausibleHealthValue(metric, value, null)) continue;
    rows.push({ day: deviceDay(bucket.startDate, timeZone), metric, value, value_secondary: null, sample_count: 1 });
  }
  return rows;
}

type Interval = { start: number; end: number };

function asleepIntervals(samples: RawSample[]): Interval[] {
  const intervals: Interval[] = [];
  for (const sample of samples) {
    if (sample.stages && sample.stages.length > 0) {
      for (const stage of sample.stages) {
        if (ASLEEP_STATES.has(stage.stage)) {
          intervals.push({ start: Date.parse(stage.startDate), end: Date.parse(stage.endDate) });
        }
      }
      continue;
    }
    // A session with no state (some Health Connect sources) counts as asleep for its length.
    if (!sample.sleepState || ASLEEP_STATES.has(sample.sleepState)) {
      intervals.push({ start: Date.parse(sample.startDate), end: Date.parse(sample.endDate) });
    }
  }
  return intervals.filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start);
}

/** Union of overlapping intervals, so a watch and a phone logging the same night count once. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

/**
 * Minutes asleep per night, filed under the local day the sleep ended (the morning
 * after). Naps count toward the day they end on.
 */
export function rollupSleep(samples: RawSample[], timeZone?: string): HealthDailyRow[] {
  const byDay = new Map<string, number>();
  for (const interval of mergeIntervals(asleepIntervals(samples))) {
    const day = deviceDay(new Date(interval.end).toISOString(), timeZone);
    byDay.set(day, (byDay.get(day) ?? 0) + (interval.end - interval.start) / 60_000);
  }
  const rows: HealthDailyRow[] = [];
  for (const [day, minutes] of byDay) {
    const value = Math.round(minutes);
    if (value < 30 || !isPlausibleHealthValue("sleep_minutes", value, null)) continue;
    rows.push({ day, metric: "sleep_minutes", value, value_secondary: null, sample_count: 1 });
  }
  return rows.sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** The last blood-pressure reading of each day, with how many readings that day had. */
export function rollupBloodPressure(samples: RawSample[], timeZone?: string): HealthDailyRow[] {
  const byDay = new Map<string, { at: number; systolic: number; diastolic: number; count: number }>();
  for (const sample of samples) {
    const systolic = sample.systolic ?? sample.value;
    const diastolic = sample.diastolic;
    if (diastolic == null || !isPlausibleHealthValue("blood_pressure", systolic, diastolic)) continue;
    const at = Date.parse(sample.startDate);
    if (!Number.isFinite(at)) continue;
    const day = deviceDay(sample.startDate, timeZone);
    const existing = byDay.get(day);
    if (!existing) byDay.set(day, { at, systolic, diastolic, count: 1 });
    else {
      existing.count += 1;
      if (at > existing.at) Object.assign(existing, { at, systolic, diastolic });
    }
  }
  return [...byDay.entries()]
    .map(([day, r]) => ({
      day,
      metric: "blood_pressure" as const,
      value: Math.round(r.systolic),
      value_secondary: Math.round(r.diastolic),
      sample_count: r.count,
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}
