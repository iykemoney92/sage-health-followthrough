/**
 * Turns synced daily health summaries into the few lines a check-in may use.
 *
 * Pure on purpose: no Supabase, no clock, so the thresholds and the wording rules
 * are pinned by tests. The brief reports only what has changed against the
 * person's own normal (the 28 days before), dates itself, and stays silent when
 * the data is stale — without background sync, old numbers are the main way this
 * could mislead a call.
 */

import { getZonedParts } from "@/lib/timezone";
import {
  HEALTH_PLATFORM_LABELS,
  metricsForCategory,
  type HealthDailyRow,
  type HealthMetric,
  type HealthPlatform,
} from "@/lib/health/metrics";

/** Data older than this is treated as missing. */
export const HEALTH_STALE_AFTER_DAYS = 3;
/** Days of history needed before comparing against "usual". */
export const HEALTH_MIN_BASELINE_DAYS = 14;
const BASELINE_DAYS = 28;

/** Instructions that travel with a brief into any model prompt. */
export const HEALTH_BRIEF_GUIDANCE = [
  "How to use the health data above: bring it up at most once, as a gentle question rather than a finding",
  '(e.g. "I noticed your sleep\'s been shorter lately — how have the nights been?").',
  "Device data can be wrong (a watch not worn, a phone left at home); if the user says it's off, believe them and move on.",
  "Never call a number normal, abnormal, good, bad or dangerous, and never diagnose from it.",
  "If they don't want to talk about it, drop it. Never repeat these numbers to anyone else or offer to pass them on,",
  "and never copy them into Care plan fields, roadmap steps, check-in prompts or reminders — the Care circle can see those.",
].join(" ");

export function localDay(now: Date, timeZone: string): string {
  const p = getZonedParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Inclusive day range [from, to]. Day strings compare correctly as strings. */
function valuesBetween(rows: HealthDailyRow[], metric: HealthMetric, from: string, to: string) {
  return rows.filter((r) => r.metric === metric && r.day >= from && r.day <= to);
}

/**
 * Recent windows per metric. Sleep is filed under the morning it ended, so "today"
 * holds last night. Today's steps are still being counted, so the step window ends
 * yesterday.
 */
function recentWindow(metric: HealthMetric, today: string): { from: string; to: string } {
  switch (metric) {
    case "sleep_minutes":
      return { from: addDays(today, -2), to: today };
    case "steps":
      return { from: addDays(today, -7), to: addDays(today, -1) };
    default:
      return { from: addDays(today, -6), to: today };
  }
}

type Comparison = { recent: number; baseline: number; recentDays: number; baselineDays: number; windowStart: string };

export function compareToUsual(rows: HealthDailyRow[], metric: HealthMetric, today: string): Comparison | null {
  const { from, to } = recentWindow(metric, today);
  const recentRows = valuesBetween(rows, metric, from, to);
  const baselineRows = valuesBetween(rows, metric, addDays(from, -BASELINE_DAYS), addDays(from, -1));
  const recent = mean(recentRows.map((r) => r.value));
  const baseline = median(baselineRows.map((r) => r.value));
  if (recent == null || baseline == null || baselineRows.length < HEALTH_MIN_BASELINE_DAYS) return null;
  return { recent, baseline, recentDays: recentRows.length, baselineDays: baselineRows.length, windowStart: from };
}

export function formatMinutes(total: number): string {
  const rounded = Math.round(total / 5) * 5;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function formatDayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function latestRow(rows: HealthDailyRow[], metric: HealthMetric, since: string) {
  return rows
    .filter((r) => r.metric === metric && r.day >= since)
    .sort((a, b) => (a.day < b.day ? 1 : -1))[0];
}

function lineFor(metric: HealthMetric, rows: HealthDailyRow[], today: string): string | null {
  switch (metric) {
    case "sleep_minutes": {
      const c = compareToUsual(rows, metric, today);
      if (!c || c.recentDays < 2 || Math.abs(c.recent - c.baseline) < 60) return null;
      return `Sleep has averaged ${formatMinutes(c.recent)} over the last ${c.recentDays} nights; usually about ${formatMinutes(c.baseline)}.`;
    }
    case "steps": {
      const c = compareToUsual(rows, metric, today);
      if (!c || c.recentDays < 4 || c.baseline < 500) return null;
      const ratio = c.recent / c.baseline;
      if (ratio > 0.65 && ratio < 1.5) return null;
      const pct = roundTo(Math.abs(1 - ratio) * 100, 5);
      const direction = ratio < 1 ? "below" : "above";
      return `Steps are about ${pct}% ${direction} their usual level this past week (around ${roundTo(c.recent, 100).toLocaleString("en-GB")} a day; usually ${roundTo(c.baseline, 100).toLocaleString("en-GB")}).`;
    }
    case "resting_hr": {
      const c = compareToUsual(rows, metric, today);
      if (!c || c.recentDays < 3 || Math.abs(c.recent - c.baseline) < 5) return null;
      return `Resting heart rate has averaged ${Math.round(c.recent)} bpm this past week; usually about ${Math.round(c.baseline)} bpm.`;
    }
    case "weight_kg": {
      const latest = latestRow(rows, metric, addDays(today, -14));
      if (!latest) return null;
      const earlier = rows
        .filter((r) => r.metric === metric && r.day < addDays(latest.day, -14) && r.day >= addDays(latest.day, -BASELINE_DAYS - 14))
        .sort((a, b) => (a.day < b.day ? -1 : 1))[0];
      const change = earlier ? latest.value - earlier.value : 0;
      const changeText = earlier && Math.abs(change) >= 2 ? ` (${change > 0 ? "up" : "down"} about ${Math.round(Math.abs(change))} kg from ${formatDayLabel(earlier.day)})` : "";
      return `Latest weight reading: ${latest.value.toFixed(1)} kg on ${formatDayLabel(latest.day)}${changeText}.`;
    }
    case "blood_pressure": {
      const latest = latestRow(rows, metric, addDays(today, -14));
      if (!latest || latest.value_secondary == null) return null;
      const readingsThisWeek = valuesBetween(rows, metric, addDays(today, -6), today).reduce(
        (sum, r) => sum + (r.sample_count ?? 1),
        0,
      );
      const countText = readingsThisWeek > 0 ? ` ${readingsThisWeek} reading${readingsThisWeek === 1 ? "" : "s"} logged this past week.` : "";
      return `Latest blood pressure reading: ${Math.round(latest.value)}/${Math.round(latest.value_secondary)} on ${formatDayLabel(latest.day)}.${countText}`;
    }
  }
}

export type HealthBriefInput = {
  rows: HealthDailyRow[];
  category: string | null | undefined;
  /** Every platform the rows came from; two phones can each contribute metrics. */
  platforms: HealthPlatform[];
  timeZone: string;
  now: Date;
  lastSyncedAt: string | null;
};

/**
 * The health lines for a check-in on a plan of this category, or null when there is
 * nothing current to say (no data, stale data, or none of it fits this plan).
 */
export function buildHealthBrief(input: HealthBriefInput): string | null {
  const { rows, category, platforms, timeZone, now, lastSyncedAt } = input;
  if (!lastSyncedAt) return null;
  const syncedAt = new Date(lastSyncedAt);
  if (Number.isNaN(syncedAt.getTime())) return null;
  if (now.getTime() - syncedAt.getTime() > HEALTH_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) return null;

  const today = localDay(now, timeZone);
  const allowed = metricsForCategory(category);
  const relevant = rows.filter((r) => allowed.includes(r.metric));
  const newest = relevant.reduce<string | null>((max, r) => (max == null || r.day > max ? r.day : max), null);
  if (!newest || newest < addDays(today, -HEALTH_STALE_AFTER_DAYS)) return null;

  const lines = allowed.map((metric) => lineFor(metric, relevant, today)).filter((line): line is string => Boolean(line));
  const syncedLabel = syncedAt.toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return [
    `Health data the user chose to share from ${platforms.map((p) => HEALTH_PLATFORM_LABELS[p]).join(" and ")} (last synced ${syncedLabel}):`,
    ...(lines.length > 0 ? lines : ["Nothing notable has changed recently."]).map((line) => `- ${line}`),
  ].join("\n");
}

export type HealthSignalKind = "sleep_drop" | "activity_drop";

export type HealthSignal = {
  signal: HealthSignalKind;
  windowStart: string;
  detail: Record<string, number>;
};

/** Minutes below usual that makes three short nights worth a check-in. */
export const SLEEP_DROP_MINUTES = 90;
/** Fraction of usual steps below which a week counts as an activity drop. */
export const ACTIVITY_DROP_RATIO = 0.5;

/**
 * Wellness signals that may start a check-in. Only sleep and activity: resting heart
 * rate and blood pressure are context, never triggers, so Nura does not drift into
 * acting on readings like a medical device.
 */
export function detectHealthSignals(rows: HealthDailyRow[], today: string, allowed: HealthMetric[]): HealthSignal[] {
  const signals: HealthSignal[] = [];

  if (allowed.includes("sleep_minutes")) {
    const c = compareToUsual(rows, "sleep_minutes", today);
    if (c && c.recentDays === 3 && c.baseline - c.recent >= SLEEP_DROP_MINUTES) {
      signals.push({
        signal: "sleep_drop",
        windowStart: c.windowStart,
        detail: { recent_minutes: Math.round(c.recent), usual_minutes: Math.round(c.baseline), nights: c.recentDays },
      });
    }
  }

  if (allowed.includes("steps")) {
    const c = compareToUsual(rows, "steps", today);
    if (c && c.recentDays >= 5 && c.baseline >= 2000 && c.recent < c.baseline * ACTIVITY_DROP_RATIO) {
      signals.push({
        signal: "activity_drop",
        windowStart: c.windowStart,
        detail: { recent_steps: Math.round(c.recent), usual_steps: Math.round(c.baseline), days: c.recentDays },
      });
    }
  }

  return signals;
}

/**
 * The objective stored on a health-triggered check-in.
 *
 * Deliberately says nothing about which metric moved or by how much: nura_check_ins is
 * readable by the plan's Care circle (0025), and push/WhatsApp openers are composed from
 * this prompt. The specifics reach the call only through the health brief, which is
 * built per call from owner-only tables.
 */
export function healthSignalCheckInPrompt(planTitle: string): string {
  const title = planTitle.trim() || "their Care plan";
  return (
    `Gentle wellness check-in — nothing was scheduled. Ask how the last few days have been and how they're ` +
    `doing with ${title}. If health data is in the context, it is why Nura reached out; follow its guidance.`
  );
}
