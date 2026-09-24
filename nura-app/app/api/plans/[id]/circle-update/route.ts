import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getPlanAccess } from "@/lib/care-circle";
import {
  CIRCLE_UPDATE_REUSE_HOURS,
  getLatestCircleUpdate,
  isOlderThanHours,
  writeCircleUpdate,
} from "@/lib/care-circle-updates";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The latest circle update, for anyone the plan is visible to. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const update = await getLatestCircleUpdate(supabase, id);
  return NextResponse.json({ ok: true, update });
}

/**
 * Asks Nura for a fresh update. Owners and watchers may both ask; an update younger than a day
 * is handed back instead of regenerated unless the owner insists. Facts are always gathered
 * through the requester's own session, so a watcher's request can only ever draw on what RLS
 * already lets them read.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const rateLimit = await checkRateLimit(supabase, user.id, "circle-update", 6, 60 * 60);
  if (rateLimit.limited) return rateLimitedResponse(rateLimit.retryAfterSeconds);

  const body = (await request.json().catch(() => null)) as { force?: boolean } | null;
  const force = access.role === "owner" && body?.force === true;

  const latest = await getLatestCircleUpdate(supabase, id);
  if (latest && !force && !isOlderThanHours(latest.createdAt, CIRCLE_UPDATE_REUSE_HOURS)) {
    return NextResponse.json({ ok: true, update: latest, reused: true });
  }

  try {
    const writeClient = access.role === "owner" ? supabase : getSupabaseAdminClient();
    const update = await writeCircleUpdate(supabase, writeClient, id, access.role === "owner" ? "owner" : "member");
    if (!update) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, update, reused: false });
  } catch (error) {
    console.error("[circle-update] write failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't write an update just now." }, { status: 500 });
  }
}
