import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToOwner } from "@/lib/integrations/push";

/**
 * "Tell my circle if I miss a check-in."
 *
 * Off by default and set per plan by the owner. A check-in counts as missed once it is still
 * not done a day after it was due - whichever channel it went out on - except ones Nura never
 * actually delivered (a paywall skip, or a call folded into another), which would be unfair
 * to report as the owner's miss. Each missed check-in is reported exactly once: the check-in
 * row is stamped, an alert row is written for the plan (the owner and the circle both read it),
 * and every watcher is nudged by push.
 */

/** How long after `scheduled_for` an undone check-in becomes a missed one. */
export const MISSED_AFTER_HOURS = 24;
/** Don't dredge up misses older than this on the first run after the toggle is switched on. */
const LOOKBACK_DAYS = 14;
/** Delivery outcomes that mean the check-in never reached the owner in the first place. */
const NOT_THE_OWNERS_MISS = new Set(["skipped_plus_required", "missed_consolidated", "processing", "placed", "redial_pending"]);

export type CircleAlert = {
  id: string;
  kind: "missed_check_in";
  body: string;
  scheduledFor: string;
  createdAt: string;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function missedCheckInBody(firstName: string, planTitle: string, scheduledFor: string) {
  return (
    `${firstName} didn't get to their check-in about "${planTitle}" on ${formatWhen(scheduledFor)}. ` +
    "On its own that's nothing to worry about - a gentle message asking how they're doing might be just the thing."
  );
}

/** Alerts the plan's circle has been sent, newest first. */
export async function listCircleAlerts(supabase: SupabaseClient, planId: string, limit = 3): Promise<CircleAlert[]> {
  const { data } = await supabase
    .from("nura_plan_circle_alerts")
    .select("id, kind, body, scheduled_for, created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as CircleAlert["kind"],
    body: row.body as string,
    scheduledFor: row.scheduled_for as string,
    createdAt: row.created_at as string,
  }));
}

/** Owner-only preference flip; the update runs under the owner's own RLS. */
export async function setCircleAlertPreference(supabase: SupabaseClient, planId: string, enabled: boolean) {
  const { data, error } = await supabase
    .from("nura_plans")
    .update({ circle_alert_missed: enabled })
    .eq("id", planId)
    .select("id, circle_alert_missed")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? Boolean(data.circle_alert_missed) : null;
}

export type CircleAlertRun = {
  considered: number;
  alerted: number;
  notified: number;
  results: Record<string, unknown>[];
};

/** The scheduled sweep. Runs with the service role; every read is scoped to opted-in plans. */
export async function runCircleAlerts(admin: SupabaseClient, now = new Date()): Promise<CircleAlertRun> {
  const results: Record<string, unknown>[] = [];

  const { data: plans, error: plansError } = await admin
    .from("nura_plans")
    .select("id, title, owner_id")
    .eq("circle_alert_missed", true)
    .neq("status", "archived");
  if (plansError) throw new Error(plansError.message);
  if (!plans || plans.length === 0) return { considered: 0, alerted: 0, notified: 0, results };

  const planIds = plans.map((p) => p.id as string);
  const { data: memberships } = await admin
    .from("nura_plan_members")
    .select("plan_id, member_id")
    .in("plan_id", planIds)
    .is("revoked_at", null);
  const membersByPlan = new Map<string, string[]>();
  for (const row of memberships ?? []) {
    const list = membersByPlan.get(row.plan_id as string) ?? [];
    list.push(row.member_id as string);
    membersByPlan.set(row.plan_id as string, list);
  }

  const missedBefore = new Date(now.getTime() - MISSED_AFTER_HOURS * 60 * 60_000).toISOString();
  const notBefore = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString();
  const { data: missed } = await admin
    .from("nura_check_ins")
    .select("id, plan_id, scheduled_for, call_status")
    .in("plan_id", planIds)
    .is("completed_at", null)
    .is("circle_alerted_at", null)
    .lt("scheduled_for", missedBefore)
    .gt("scheduled_for", notBefore)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  const ownerIds = Array.from(new Set(plans.map((p) => p.owner_id as string)));
  const { data: profiles } = await admin.from("nura_profiles").select("id, display_name").in("id", ownerIds);
  const firstNameByOwner = new Map(
    (profiles ?? []).map((p) => [p.id as string, ((p.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "They"]),
  );
  const planById = new Map(plans.map((p) => [p.id as string, p]));

  let alerted = 0;
  let notified = 0;

  for (const checkIn of missed ?? []) {
    const planId = checkIn.plan_id as string;
    const members = membersByPlan.get(planId) ?? [];
    if (NOT_THE_OWNERS_MISS.has((checkIn.call_status as string) || "")) {
      // Still stamp it so the sweep doesn't re-evaluate it every day.
      await admin.from("nura_check_ins").update({ circle_alerted_at: now.toISOString() }).eq("id", checkIn.id);
      results.push({ checkInId: checkIn.id, status: "not_delivered_skip" });
      continue;
    }
    if (members.length === 0) {
      results.push({ checkInId: checkIn.id, status: "no_members" });
      continue;
    }

    const plan = planById.get(planId)!;
    const firstName = firstNameByOwner.get(plan.owner_id as string) ?? "They";
    const body = missedCheckInBody(firstName, plan.title as string, checkIn.scheduled_for as string);

    // Stamp first: if anything below fails we would rather under-report than nag twice.
    const { data: stamped } = await admin
      .from("nura_check_ins")
      .update({ circle_alerted_at: now.toISOString() })
      .eq("id", checkIn.id)
      .is("circle_alerted_at", null)
      .select("id");
    if (!stamped || stamped.length === 0) continue;

    const { error: alertError } = await admin.from("nura_plan_circle_alerts").insert({
      plan_id: planId,
      check_in_id: checkIn.id,
      kind: "missed_check_in",
      body,
      scheduled_for: checkIn.scheduled_for,
    });
    if (alertError) {
      results.push({ checkInId: checkIn.id, status: "failed", error: alertError.message });
      continue;
    }
    alerted += 1;

    for (const memberId of members) {
      const push = await sendPushToOwner(memberId, {
        title: `${firstName} missed a check-in`,
        body: body.slice(0, 160),
        url: `/plans/${planId}`,
      }).catch(() => null);
      if (push && push.sent > 0) notified += 1;
    }
    results.push({ checkInId: checkIn.id, planId, status: "alerted", members: members.length });
  }

  return { considered: missed?.length ?? 0, alerted, notified, results };
}
