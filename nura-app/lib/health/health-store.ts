/**
 * Server-side reads of synced health data.
 *
 * Every path that uses health data goes through `listActiveHealthConnections`: rows
 * are only read from platforms with an active (unrevoked) connection, whatever exists.
 * Failures read as "no health data" — a missing table or a bad row must never
 * break a check-in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, buildHealthBrief, HEALTH_BRIEF_GUIDANCE, localDay } from "@/lib/health/health-brief";
import { HEALTH_METRICS, type HealthDailyRow, type HealthMetric, type HealthPlatform } from "@/lib/health/metrics";

/** Days of history kept and read: the 28-day baseline plus the recent window, with room to spare. */
export const HEALTH_RETENTION_DAYS = 90;
const READ_WINDOW_DAYS = 40;

export type HealthConnection = {
  id: string;
  owner_id: string;
  platform: HealthPlatform;
  consented_at: string;
  consent_version: string;
  metrics: HealthMetric[];
  last_synced_at: string | null;
  last_sync_status: "ok" | "no_data" | "error" | null;
  revoked_at: string | null;
};

/**
 * Every unrevoked connection, most recently synced first. Someone who uses Nura on an
 * iPhone and an Android phone has one per platform, and each device must only see and
 * sync its own.
 */
export async function listActiveHealthConnections(supabase: SupabaseClient, ownerId: string): Promise<HealthConnection[]> {
  const { data, error } = await supabase
    .from("nura_health_connections")
    .select("id, owner_id, platform, consented_at, consent_version, metrics, last_synced_at, last_sync_status, revoked_at")
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .order("last_synced_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data as HealthConnection[];
}

export type SourcedHealthRow = HealthDailyRow & { platform: HealthPlatform };

/**
 * With two phones connected, each metric comes from one of them only: whichever has more
 * days of it in the window (ties go to the newer data). Mixing them day by day would
 * compare an iPhone's step count with an Android phone's and read the gap as a change.
 */
export function pickOneSourcePerMetric(rows: SourcedHealthRow[]): SourcedHealthRow[] {
  const score = new Map<string, { days: number; newest: string }>();
  for (const row of rows) {
    const key = `${row.metric}|${row.platform}`;
    const current = score.get(key) ?? { days: 0, newest: "" };
    score.set(key, { days: current.days + 1, newest: row.day > current.newest ? row.day : current.newest });
  }
  const chosen = new Map<HealthMetric, HealthPlatform>();
  for (const [key, s] of score) {
    const [metric, platform] = key.split("|") as [HealthMetric, HealthPlatform];
    const best = chosen.get(metric);
    const bestScore = best ? score.get(`${metric}|${best}`)! : null;
    if (!bestScore || s.days > bestScore.days || (s.days === bestScore.days && s.newest > bestScore.newest)) {
      chosen.set(metric, platform);
    }
  }
  return rows.filter((row) => chosen.get(row.metric) === row.platform);
}

/** Daily rows since `sinceDay` from the given connected platforms, one source per metric. */
export async function loadHealthDailies(
  supabase: SupabaseClient,
  ownerId: string,
  sinceDay: string,
  platforms: HealthPlatform[],
): Promise<SourcedHealthRow[]> {
  if (platforms.length === 0) return [];
  const { data, error } = await supabase
    .from("nura_health_daily")
    .select("day, metric, value, value_secondary, sample_count, platform")
    .eq("owner_id", ownerId)
    .in("platform", platforms)
    .gte("day", sinceDay)
    .order("day", { ascending: true });
  if (error || !data) return [];
  return pickOneSourcePerMetric(
    data
      .filter((row) => (HEALTH_METRICS as readonly string[]).includes(row.metric as string))
      .map((row) => ({
        day: row.day as string,
        metric: row.metric as HealthMetric,
        value: Number(row.value),
        value_secondary: row.value_secondary == null ? null : Number(row.value_secondary),
        sample_count: (row.sample_count as number | null) ?? 1,
        platform: row.platform as HealthPlatform,
      })),
  );
}

/**
 * Plan ids that are about someone the owner cares for (nura_care_recipients). The owner's
 * health data says nothing about that person and must never reach a call to them, so
 * these plans get no health brief and no health-triggered check-ins.
 */
export async function plansAboutSomeoneElse(supabase: SupabaseClient, planIds: string[]): Promise<Set<string>> {
  if (planIds.length === 0) return new Set();
  const { data, error } = await supabase.from("nura_care_recipients").select("plan_id").in("plan_id", planIds);
  // Missing table (not yet migrated) means no such plans; any other failure fails closed.
  if (error) return error.code === "42P01" ? new Set() : new Set(planIds);
  return new Set((data ?? []).map((row) => row.plan_id as string));
}

/**
 * The health brief plus its usage guidance, ready to drop into a model's context for
 * this plan — or null when there is nothing current to say, or the plan is about
 * someone other than the owner.
 */
export async function healthContextForPlan(
  supabase: SupabaseClient,
  ownerId: string,
  plan: { id: string; category: string | null | undefined },
  timeZone: string,
  now = new Date(),
): Promise<string | null> {
  try {
    if ((await plansAboutSomeoneElse(supabase, [plan.id])).size > 0) return null;
    const connections = await listActiveHealthConnections(supabase, ownerId);
    if (connections.length === 0) return null;
    const rows = await loadHealthDailies(
      supabase,
      ownerId,
      addDays(localDay(now, timeZone), -READ_WINDOW_DAYS),
      connections.map((c) => c.platform),
    );
    const brief = buildHealthBrief({
      rows,
      category: plan.category,
      platforms: [...new Set(rows.map((r) => r.platform))],
      timeZone,
      now,
      // Most recently synced first, so this is the freshest of the phones.
      lastSyncedAt: connections[0].last_synced_at,
    });
    return brief ? `${brief}\n${HEALTH_BRIEF_GUIDANCE}` : null;
  } catch {
    return null;
  }
}

/**
 * Deletes what Nura has stored from a health connection. Used by disconnect. With a
 * platform, only that phone's daily rows go and the other phone's stay; signals are
 * derived from both, so they always go and are rebuilt from what remains.
 */
export async function deleteHealthData(supabase: SupabaseClient, ownerId: string, platform?: HealthPlatform) {
  let daily = supabase.from("nura_health_daily").delete().eq("owner_id", ownerId);
  if (platform) daily = daily.eq("platform", platform);
  const { error: dailyError } = await daily;
  if (dailyError) throw new Error(`Failed to delete nura_health_daily: ${dailyError.message}`);
  const { error } = await supabase.from("nura_health_signals").delete().eq("owner_id", ownerId);
  if (error) throw new Error(`Failed to delete nura_health_signals: ${error.message}`);
}
