import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { isWithinQuietHours, pickIdleChannel } from "@/lib/domain/idle-wellness";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";
import { addDays, detectHealthSignals, healthSignalCheckInPrompt, HEALTH_STALE_AFTER_DAYS, localDay } from "@/lib/health/health-brief";
import { loadHealthDailies, plansAboutSomeoneElse } from "@/lib/health/health-store";
import { metricsForCategory, type HealthPlatform } from "@/lib/health/metrics";
import { readProfileSettings } from "@/lib/profile-settings";

/** At most one health-triggered check-in per person in this window. */
export const HEALTH_SIGNAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** No health trigger if Nura already reached out this recently, for any reason. */
const RECENT_CONTACT_MS = 2 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 8;

export function healthSignalsEnabled() {
  return process.env.HEALTH_SIGNALS_ENABLED === "true";
}

/**
 * Starts a gentle check-in when someone's shared sleep or activity has dropped well
 * below their own normal (see detectHealthSignals). Runs from the check-in dispatcher
 * after idle-wellness, behind HEALTH_SIGNALS_ENABLED, with the same guards idle-wellness
 * uses: Plus only, nothing already open, quiet hours, preferred channel.
 */
export async function scheduleHealthSignalCheckIns(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ scheduled: string[]; skipped: number }> {
  const scheduled: string[] = [];
  let skipped = 0;
  if (!healthSignalsEnabled()) return { scheduled, skipped };

  const freshSince = new Date(now.getTime() - HEALTH_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: connections } = await supabase
    .from("nura_health_connections")
    .select("owner_id, platform, last_synced_at")
    .is("revoked_at", null)
    .gte("last_synced_at", freshSince)
    .limit(400);
  const platformsByOwner = new Map<string, HealthPlatform[]>();
  for (const c of connections ?? []) {
    platformsByOwner.set(c.owner_id as string, [...(platformsByOwner.get(c.owner_id as string) ?? []), c.platform as HealthPlatform]);
  }
  const ownerIds = [...platformsByOwner.keys()];
  if (ownerIds.length === 0) return { scheduled, skipped };

  const cooldownCutoff = new Date(now.getTime() - HEALTH_SIGNAL_COOLDOWN_MS).toISOString();
  const contactCutoff = new Date(now.getTime() - RECENT_CONTACT_MS).toISOString();
  const [{ data: recentSignals }, { data: openRows }, { data: recentTriggers }, { data: plans }, { data: profiles }] = await Promise.all([
    supabase.from("nura_health_signals").select("owner_id").in("owner_id", ownerIds).gte("created_at", cooldownCutoff),
    supabase.from("nura_check_ins").select("owner_id").in("owner_id", ownerIds).is("completed_at", null).is("triggered_at", null),
    supabase.from("nura_check_ins").select("owner_id").in("owner_id", ownerIds).gte("triggered_at", contactCutoff),
    supabase
      .from("nura_plans")
      .select("id, owner_id, title, category, updated_at")
      .in("owner_id", ownerIds)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    supabase.from("nura_profiles").select("id, phone, preferred_checkin_channel, preferred_checkin_channels").in("id", ownerIds),
  ]);

  const blocked = new Set<string>([
    ...(recentSignals ?? []).map((r) => r.owner_id as string),
    ...(openRows ?? []).map((r) => r.owner_id as string),
    ...(recentTriggers ?? []).map((r) => r.owner_id as string),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  // A plan about someone the owner cares for would ring that person, not the owner.
  const otherPersonPlans = await plansAboutSomeoneElse(supabase, (plans ?? []).map((p) => p.id as string));
  const ownPlans = (plans ?? []).filter((p) => !otherPersonPlans.has(p.id as string));

  for (const ownerId of ownerIds) {
    if (scheduled.length >= BATCH_LIMIT) break;
    const profile = profileById.get(ownerId);
    const ownerPlans = ownPlans.filter((p) => p.owner_id === ownerId);
    if (blocked.has(ownerId) || !profile || ownerPlans.length === 0) {
      skipped += 1;
      continue;
    }

    try {
      if (!(await getSubscriptionAccess(supabase, ownerId)).hasPlus) {
        skipped += 1;
        continue;
      }

      const { data: authData } = await supabase.auth.admin.getUserById(ownerId);
      const metadata = (authData?.user?.user_metadata ?? null) as Record<string, unknown> | null;
      const timeZone = await resolveUserTimeZone(supabase, ownerId, { phoneDigits: profile.phone as string | null, authMetadata: metadata });
      if (isWithinQuietHours(now, readProfileSettings(metadata).quietHours, timeZone)) {
        skipped += 1;
        continue;
      }

      const today = localDay(now, timeZone);
      const rows = await loadHealthDailies(supabase, ownerId, addDays(today, -40), platformsByOwner.get(ownerId) ?? []);

      // The most recently active plan whose category this kind of signal fits.
      let match: { plan: (typeof ownerPlans)[number]; signal: ReturnType<typeof detectHealthSignals>[number] } | null = null;
      for (const plan of ownerPlans) {
        const [signal] = detectHealthSignals(rows, today, metricsForCategory(plan.category as string | null));
        if (signal) {
          match = { plan, signal };
          break;
        }
      }
      if (!match) {
        skipped += 1;
        continue;
      }

      // Claim the signal first: the unique key keeps two dispatcher ticks from both calling.
      const { data: signalRow, error: signalError } = await supabase
        .from("nura_health_signals")
        .insert({
          owner_id: ownerId,
          plan_id: match.plan.id,
          signal: match.signal.signal,
          window_start: match.signal.windowStart,
          detail: match.signal.detail,
        })
        .select("id")
        .maybeSingle();
      if (signalError || !signalRow?.id) {
        skipped += 1;
        continue;
      }

      const { data: inserted, error } = await supabase
        .from("nura_check_ins")
        .insert({
          owner_id: ownerId,
          plan_id: match.plan.id,
          prompt: healthSignalCheckInPrompt(match.plan.title as string),
          scheduled_for: now.toISOString(),
          channel: pickIdleChannel(
            profile.preferred_checkin_channels as string[] | null,
            profile.preferred_checkin_channel as string | null,
          ),
          contact_phone: profile.phone,
        })
        .select("id")
        .maybeSingle();
      if (error || !inserted?.id) {
        skipped += 1;
        continue;
      }

      await supabase.from("nura_health_signals").update({ check_in_id: inserted.id }).eq("id", signalRow.id);
      scheduled.push(inserted.id as string);
    } catch {
      skipped += 1;
    }
  }

  return { scheduled, skipped };
}
