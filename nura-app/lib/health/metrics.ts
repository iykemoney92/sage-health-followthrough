/**
 * Shared vocabulary for health data read from Apple Health / Health Connect.
 *
 * Safe to import from client and server. Health data is the person's, not a Care
 * plan's, and never reaches a Care circle — see supabase/migrations/0031_health_data.sql.
 */

import type { PlanCategory } from "@/lib/domain/journey-naming";

export const HEALTH_METRICS = ["steps", "sleep_minutes", "resting_hr", "weight_kg", "blood_pressure"] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const HEALTH_PLATFORMS = ["apple_health", "health_connect"] as const;
export type HealthPlatform = (typeof HEALTH_PLATFORMS)[number];

/** Bump when the consent screen's copy changes in substance; stored on the connection row. */
export const HEALTH_CONSENT_VERSION = "2026-10-24";

export const HEALTH_METRIC_LABELS: Record<HealthMetric, string> = {
  steps: "Steps",
  sleep_minutes: "Sleep",
  resting_hr: "Resting heart rate",
  weight_kg: "Weight",
  blood_pressure: "Blood pressure",
};

export const HEALTH_PLATFORM_LABELS: Record<HealthPlatform, string> = {
  apple_health: "Apple Health",
  health_connect: "Health Connect",
};

/** One day's summary for one metric, as synced from the device and stored in nura_health_daily. */
export type HealthDailyRow = {
  /** Local calendar date, YYYY-MM-DD. */
  day: string;
  metric: HealthMetric;
  /** Systolic for blood_pressure. */
  value: number;
  /** Diastolic for blood_pressure; null otherwise. */
  value_secondary: number | null;
  sample_count?: number;
};

/**
 * Which metrics the agent may bring up for a Care plan of this category.
 *
 * Weight is only ever raised for GP and medication follow-up: in wellbeing,
 * postpartum and stress contexts talking about weight can do harm, so it stays
 * out of those briefs even when the person has shared it.
 */
const METRICS_BY_CATEGORY: Record<PlanCategory, HealthMetric[]> = {
  gp_follow_up: ["blood_pressure", "weight_kg", "resting_hr", "steps"],
  medication_follow_through: ["blood_pressure", "weight_kg", "resting_hr", "steps"],
  symptom_monitoring: ["sleep_minutes", "steps", "resting_hr"],
  mental_wellbeing: ["sleep_minutes", "steps", "resting_hr"],
  sleep_energy: ["sleep_minutes", "steps", "resting_hr"],
  recovery_aftercare: ["steps", "sleep_minutes", "resting_hr"],
  postpartum_aftercare: ["sleep_minutes", "steps"],
  occupational_stress: ["sleep_minutes", "steps", "resting_hr"],
  therapy_follow_through: ["sleep_minutes", "steps", "resting_hr"],
  caregiver_support: ["sleep_minutes", "steps"],
  personal_hygiene: ["sleep_minutes", "steps"],
  general_health: ["sleep_minutes", "steps"],
};

export function metricsForCategory(category: string | null | undefined): HealthMetric[] {
  return METRICS_BY_CATEGORY[(category ?? "general_health") as PlanCategory] ?? METRICS_BY_CATEGORY.general_health;
}

/**
 * Plausible ranges for a daily summary. Anything outside is dropped at sync rather
 * than stored, so a mis-entered reading never ends up in a check-in.
 */
export const HEALTH_VALUE_RANGES: Record<HealthMetric, { min: number; max: number; secondary?: { min: number; max: number } }> = {
  steps: { min: 0, max: 100_000 },
  sleep_minutes: { min: 0, max: 1_080 },
  resting_hr: { min: 25, max: 220 },
  weight_kg: { min: 20, max: 400 },
  blood_pressure: { min: 50, max: 260, secondary: { min: 30, max: 160 } },
};

export function isPlausibleHealthValue(metric: HealthMetric, value: number, secondary: number | null | undefined) {
  const range = HEALTH_VALUE_RANGES[metric];
  if (!Number.isFinite(value) || value < range.min || value > range.max) return false;
  if (range.secondary) {
    if (secondary == null || !Number.isFinite(secondary)) return false;
    if (secondary < range.secondary.min || secondary > range.secondary.max) return false;
  }
  return true;
}
