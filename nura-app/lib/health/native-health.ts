"use client";

import { Capacitor } from "@capacitor/core";
import { Health, type HealthDataType } from "@capgo/capacitor-health";
import { addDays } from "@/lib/health/health-brief";
import { HEALTH_METRICS, type HealthDailyRow, type HealthMetric, type HealthPlatform } from "@/lib/health/metrics";
import { deviceDay, rollupAggregates, rollupBloodPressure, rollupSleep } from "@/lib/health/rollup";

/**
 * The device half of the health connection: permission, reading and sync.
 *
 * The app is a remote-URL shell, so this code ships with the website while the
 * plugin ships with the binary. Every entry point checks the plugin is actually in
 * this binary first — an older install simply reports "update the app".
 */

/** Plugin data types Nura reads, per metric. Read-only: Nura never writes to Health. */
const PLUGIN_TYPE: Record<HealthMetric, HealthDataType> = {
  steps: "steps",
  sleep_minutes: "sleep",
  resting_hr: "restingHeartRate",
  weight_kg: "weight",
  blood_pressure: "bloodPressure",
};

export const READ_TYPES: HealthDataType[] = HEALTH_METRICS.map((m) => PLUGIN_TYPE[m]);

/** First sync reads 30 days: Health Connect's default history window, no extra permission. */
const FIRST_SYNC_DAYS = 30;
/** Later syncs re-read a couple of days so late-arriving sleep and readings land. */
const RESYNC_OVERLAP_DAYS = 2;
const SYNC_THROTTLE_MS = 6 * 60 * 60 * 1000;
const LAST_SYNC_KEY = "nura_health_last_sync_at";

export function nativeHealthPlatform(): HealthPlatform | null {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "apple_health";
  if (platform === "android") return "health_connect";
  return null;
}

/** True when this binary includes the health plugin (builds from 2026-10 onwards). */
export function isHealthPluginPresent() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Health");
}

export type HealthAvailability =
  | { state: "ready"; platform: HealthPlatform }
  | { state: "web" }
  | { state: "update_app"; platform: HealthPlatform }
  | { state: "unavailable"; platform: HealthPlatform; reason?: string };

export async function checkHealthAvailability(): Promise<HealthAvailability> {
  const platform = nativeHealthPlatform();
  if (!platform) return { state: "web" };
  if (!isHealthPluginPresent()) return { state: "update_app", platform };
  try {
    const result = await Health.isAvailable();
    return result.available ? { state: "ready", platform } : { state: "unavailable", platform, reason: result.reason };
  } catch (error) {
    return { state: "unavailable", platform, reason: error instanceof Error ? error.message : undefined };
  }
}

/** Shows the OS permission sheet. Call only after the person agreed on Nura's consent screen. */
export async function requestHealthPermission() {
  return Health.requestAuthorization({ read: READ_TYPES });
}

export async function openHealthSettings() {
  if (Capacitor.getPlatform() === "android") await Health.openHealthConnectSettings();
}

async function readMetric(metric: HealthMetric, startDate: string, endDate: string): Promise<HealthDailyRow[]> {
  const dataType = PLUGIN_TYPE[metric];
  switch (metric) {
    case "steps": {
      const { samples } = await Health.queryAggregated({ dataType, startDate, endDate, bucket: "day", aggregation: "sum" });
      return rollupAggregates(metric, samples);
    }
    case "resting_hr": {
      const { samples } = await Health.queryAggregated({ dataType, startDate, endDate, bucket: "day", aggregation: "average" });
      return rollupAggregates(metric, samples);
    }
    case "weight_kg": {
      const { samples } = await Health.queryAggregated({ dataType, startDate, endDate, bucket: "day", aggregation: "max" });
      return rollupAggregates(metric, samples);
    }
    case "sleep_minutes": {
      // Start the read the evening before, so the first night isn't cut in half.
      const from = new Date(Date.parse(startDate) - 12 * 60 * 60 * 1000).toISOString();
      const { samples } = await Health.readSamples({ dataType, startDate: from, endDate, limit: 5000, ascending: true });
      return rollupSleep(samples).filter((row) => row.day >= deviceDay(startDate));
    }
    case "blood_pressure": {
      const { samples } = await Health.readSamples({ dataType, startDate, endDate, limit: 1000, ascending: true });
      return rollupBloodPressure(samples);
    }
  }
}

function localMidnight(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/**
 * Reads the device's health data since the last sync and sends daily summaries to Nura.
 * A metric the person denied (or has no data for) just comes back empty — HealthKit
 * never says which reads were refused, so an empty read is not an error.
 */
export async function syncHealthData(options: { lastSyncedAt: string | null; force?: boolean }) {
  const platform = nativeHealthPlatform();
  if (!platform || !isHealthPluginPresent()) return { ok: false as const, reason: "unavailable" };

  const now = new Date();
  if (!options.force) {
    try {
      const last = Number(window.localStorage.getItem(LAST_SYNC_KEY) ?? 0);
      if (now.getTime() - last < SYNC_THROTTLE_MS) return { ok: true as const, skipped: true };
    } catch {
      // Storage can throw in private contexts; sync anyway.
    }
  }

  const today = deviceDay(now.toISOString());
  const lastDay = options.lastSyncedAt ? deviceDay(options.lastSyncedAt) : null;
  const fromDay = lastDay ? addDays(lastDay, -RESYNC_OVERLAP_DAYS) : addDays(today, -FIRST_SYNC_DAYS);
  const startDate = localMidnight(fromDay);
  const endDate = now.toISOString();

  const days: HealthDailyRow[] = [];
  for (const metric of HEALTH_METRICS) {
    try {
      days.push(...(await readMetric(metric, startDate, endDate)));
    } catch {
      // One unreadable type (denied, unsupported on this device) must not block the rest.
    }
  }

  const response = await fetch("/api/health/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, days }),
  }).catch(() => null);
  if (!response?.ok) return { ok: false as const, reason: "server" };

  try {
    window.localStorage.setItem(LAST_SYNC_KEY, String(now.getTime()));
  } catch {
    // Throttle is a convenience only.
  }
  const body = (await response.json().catch(() => ({}))) as { stored?: number };
  return { ok: true as const, stored: body.stored ?? 0 };
}

export function clearHealthSyncThrottle() {
  try {
    window.localStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    // ignore
  }
}
