import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { primaryCheckinChannel, type CheckinChannel } from "@/lib/domain/checkin-channel";
import { readProfileSettings, type QuietHoursSettings } from "@/lib/profile-settings";
import { getZonedParts, wallTimeInTimeZoneToUtcIso } from "@/lib/timezone";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";

/** Minimum silence before Nura invents a wellness check-in (no open Care-plan check-in). */
export const IDLE_WELLNESS_GAP_MS = 3 * 24 * 60 * 60 * 1000;

/** Cap per dispatcher tick so a backlog of quiet users does not flood outbound channels. */
export const IDLE_WELLNESS_BATCH_LIMIT = 8;

type PlanRow = {
  id: string;
  owner_id: string;
  title: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  phone: string | null;
  preferred_checkin_channel: string | null;
  preferred_checkin_channels: string[] | null;
};

/**
 * Quiet-hours window using the user's wall-clock timezone (not server UTC).
 * Overnight ranges (e.g. 22:00–07:00) are supported.
 */
export function isWithinQuietHours(
  now: Date,
  quiet: QuietHoursSettings,
  timeZone = "UTC",
): boolean {
  if (!quiet.enabled) return false;

  const startMins = parseHmToMinutes(quiet.start);
  const endMins = parseHmToMinutes(quiet.end);
  if (startMins === null || endMins === null) return false;

  const parts = getZonedParts(now, timeZone);
  const nowMins = parts.hour * 60 + parts.minute;
  if (startMins === endMins) return true;
  if (startMins < endMins) return nowMins >= startMins && nowMins < endMins;
  return nowMins >= startMins || nowMins < endMins;
}

function parseHmToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * If `when` falls inside the quiet-hours window, pushes it forward to the window's end boundary
 * (in the user's timezone) instead of just leaving it be. Used to reschedule a voice/WhatsApp
 * check-in that would otherwise fire overnight, rather than silently skipping it.
 */
export function nextTimeOutsideQuietHours(when: Date, quiet: QuietHoursSettings, timeZone = "UTC"): Date {
  if (!isWithinQuietHours(when, quiet, timeZone)) return when;

  const startMins = parseHmToMinutes(quiet.start);
  const endMins = parseHmToMinutes(quiet.end);
  if (startMins === null || endMins === null) return when;

  const parts = getZonedParts(when, timeZone);
  const nowMins = parts.hour * 60 + parts.minute;

  // Same-day window (start < end): the end boundary is later the same day.
  // Overnight window (start >= end): being inside it after `start` means the end boundary is
  // tomorrow; being inside it before `end` (the early-morning tail) means it's later today.
  const dayOffset = startMins < endMins ? 0 : nowMins >= startMins ? 1 : 0;

  const boundaryDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  const y = boundaryDate.getUTCFullYear();
  const m = String(boundaryDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(boundaryDate.getUTCDate()).padStart(2, "0");
  return new Date(wallTimeInTimeZoneToUtcIso(`${y}-${m}-${d}T${quiet.end}:00`, timeZone));
}

export function isIdleLongEnough(lastContactAt: Date | null, now: Date, gapMs = IDLE_WELLNESS_GAP_MS): boolean {
  if (!lastContactAt) return true;
  return now.getTime() - lastContactAt.getTime() >= gapMs;
}

export function idleWellnessPrompt(planTitle: string): string {
  const title = planTitle.trim() || "their Care plan";
  return (
    `Gentle wellness check-in — nothing was scheduled and their calendar is quiet. ` +
    `Ask how they're doing with ${title} and if anything has been on their mind lately.`
  );
}

export function pickIdleChannel(
  preferredChannels: string[] | null | undefined,
  preferredChannel: string | null | undefined,
): CheckinChannel {
  const allowed = ((preferredChannels?.length ? preferredChannels : null) ?? ["in_app"]).filter(
    (c): c is CheckinChannel => c === "whatsapp" || c === "in_app" || c === "voice",
  );
  return primaryCheckinChannel(allowed.length > 0 ? allowed : ["in_app"], preferredChannel);
}

/**
 * Finds Plus users with an active Care plan, no open check-ins, and no recent contact,
 * then inserts a due wellness check-in so the normal dispatcher can deliver it this tick.
 */
export async function scheduleIdleWellnessCheckIns(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ scheduled: string[]; skipped: number }> {
  const scheduled: string[] = [];
  let skipped = 0;

  const { data: plans, error: plansError } = await supabase
    .from("nura_plans")
    .select("id, owner_id, title, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(400);

  if (plansError || !plans?.length) {
    return { scheduled, skipped };
  }

  const planByOwner = new Map<string, PlanRow>();
  for (const plan of plans as PlanRow[]) {
    if (!planByOwner.has(plan.owner_id)) planByOwner.set(plan.owner_id, plan);
  }
  const ownerIds = Array.from(planByOwner.keys());

  const { data: openRows } = await supabase
    .from("nura_check_ins")
    .select("owner_id")
    .in("owner_id", ownerIds)
    .is("completed_at", null)
    .is("triggered_at", null);

  const busyOwners = new Set((openRows ?? []).map((row) => row.owner_id as string));
  const idleOwnerIds = ownerIds.filter((id) => !busyOwners.has(id));
  if (idleOwnerIds.length === 0) return { scheduled, skipped };

  const plusFlags = new Map<string, boolean>();
  await Promise.all(
    idleOwnerIds.slice(0, 60).map(async (ownerId) => {
      plusFlags.set(ownerId, (await getSubscriptionAccess(supabase, ownerId)).hasPlus);
    }),
  );

  const plusIdleOwners = idleOwnerIds.filter((id) => plusFlags.get(id));
  if (plusIdleOwners.length === 0) return { scheduled, skipped };

  const gapCutoff = new Date(now.getTime() - IDLE_WELLNESS_GAP_MS).toISOString();

  const [{ data: recentMessages }, { data: recentTriggers }, { data: profiles }] = await Promise.all([
    supabase
      .from("nura_messages")
      .select("owner_id, created_at")
      .in("owner_id", plusIdleOwners)
      .gte("created_at", gapCutoff)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("nura_check_ins")
      .select("owner_id, triggered_at")
      .in("owner_id", plusIdleOwners)
      .not("triggered_at", "is", null)
      .gte("triggered_at", gapCutoff)
      .order("triggered_at", { ascending: false })
      .limit(500),
    supabase
      .from("nura_profiles")
      .select("id, phone, preferred_checkin_channel, preferred_checkin_channels")
      .in("id", plusIdleOwners),
  ]);

  const recentlyContacted = new Set<string>();
  for (const row of recentMessages ?? []) recentlyContacted.add(row.owner_id as string);
  for (const row of recentTriggers ?? []) recentlyContacted.add(row.owner_id as string);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p as ProfileRow]));

  const candidates = plusIdleOwners.filter((id) => !recentlyContacted.has(id));

  for (const ownerId of candidates) {
    if (scheduled.length >= IDLE_WELLNESS_BATCH_LIMIT) break;

    const plan = planByOwner.get(ownerId);
    const profile = profileById.get(ownerId);
    if (!plan || !profile) {
      skipped += 1;
      continue;
    }

    try {
      const { data: authData } = await supabase.auth.admin.getUserById(ownerId);
      const settings = readProfileSettings(
        (authData?.user?.user_metadata ?? null) as Record<string, unknown> | null,
      );
      const timeZone = await resolveUserTimeZone(supabase, ownerId, {
        phoneDigits: profile.phone,
        authMetadata: (authData?.user?.user_metadata ?? null) as Record<string, unknown> | null,
      });
      // Idle wellness is never "urgent" — always respect quiet hours when enabled.
      if (isWithinQuietHours(now, settings.quietHours, timeZone)) {
        skipped += 1;
        continue;
      }
    } catch {
      // If auth metadata cannot be loaded, still allow a gentle check-in.
    }

    const channel = pickIdleChannel(profile.preferred_checkin_channels, profile.preferred_checkin_channel);
    const { data: inserted, error } = await supabase
      .from("nura_check_ins")
      .insert({
        owner_id: ownerId,
        plan_id: plan.id,
        prompt: idleWellnessPrompt(plan.title),
        scheduled_for: now.toISOString(),
        channel,
        contact_phone: profile.phone,
      })
      .select("id")
      .maybeSingle();

    if (error || !inserted?.id) {
      skipped += 1;
      continue;
    }
    scheduled.push(inserted.id as string);
  }

  return { scheduled, skipped };
}
