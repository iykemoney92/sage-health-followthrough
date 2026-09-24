import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { runCircleAlerts } from "@/lib/care-circle-alerts";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (agentSecret && request.headers.get("x-agent-secret") === agentSecret) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  return false;
}

/** Daily sweep: tell each opted-in plan's circle about check-ins missed since yesterday. */
async function run(request: NextRequest) {
  if (!process.env.AGENT_TOOL_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "cron is not configured" }, { status: 503 });
  }
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const result = await runCircleAlerts(getSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
