import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import {
  CIRCLE_UPDATE_SCHEDULE_DAYS,
  getLatestCircleUpdate,
  isOlderThanHours,
  writeCircleUpdate,
} from "@/lib/care-circle-updates";
import { sendPushToOwner } from "@/lib/integrations/push";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Plans handled per run - the daily cron catches up over a few days if there are more. */
const BATCH_LIMIT = 20;

function isAuthorized(request: NextRequest) {
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (agentSecret && request.headers.get("x-agent-secret") === agentSecret) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  return false;
}

/**
 * Weekly circle updates. For every active plan that has at least one watcher, write a fresh
 * update once the latest one is a week old, then nudge each watcher so they don't have to
 * remember to look. Runs daily; each plan only advances when it is due.
 */
async function run(request: NextRequest) {
  if (!process.env.AGENT_TOOL_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "cron is not configured" }, { status: 503 });
  }
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: memberships, error } = await admin
    .from("nura_plan_members")
    .select("plan_id, member_id")
    .is("revoked_at", null);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const membersByPlan = new Map<string, string[]>();
  for (const row of memberships ?? []) {
    const list = membersByPlan.get(row.plan_id as string) ?? [];
    list.push(row.member_id as string);
    membersByPlan.set(row.plan_id as string, list);
  }
  const planIds = Array.from(membersByPlan.keys());
  if (planIds.length === 0) return NextResponse.json({ ok: true, considered: 0, written: 0, notified: 0 });

  const { data: plans } = await admin.from("nura_plans").select("id, status").in("id", planIds).neq("status", "archived");

  let written = 0;
  let notified = 0;
  const results: Record<string, unknown>[] = [];

  for (const plan of (plans ?? []).slice(0, BATCH_LIMIT)) {
    const planId = plan.id as string;
    const latest = await getLatestCircleUpdate(admin, planId);
    if (latest && !isOlderThanHours(latest.createdAt, CIRCLE_UPDATE_SCHEDULE_DAYS * 24)) {
      results.push({ planId, status: "fresh" });
      continue;
    }
    try {
      const update = await writeCircleUpdate(admin, admin, planId, "schedule");
      if (!update) continue;
      written += 1;
      const { data: ownerName } = await admin.rpc("nura_circle_owner_name", { target_plan: planId });
      const firstName = ((ownerName as string | null) ?? "").trim().split(/\s+/)[0] || "Someone";
      for (const memberId of membersByPlan.get(planId) ?? []) {
        const push = await sendPushToOwner(memberId, {
          title: `How ${firstName} is getting on`,
          body: update.body.slice(0, 140),
          url: `/plans/${planId}`,
        }).catch(() => null);
        if (push && push.sent > 0) notified += 1;
      }
      results.push({ planId, status: "written" });
    } catch (err) {
      results.push({ planId, status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, considered: plans?.length ?? 0, written, notified, results });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
