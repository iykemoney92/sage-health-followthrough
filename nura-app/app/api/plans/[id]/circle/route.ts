import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlanAccess, listCircleMembers } from "@/lib/care-circle";
import { setCircleAlertPreference } from "@/lib/care-circle-alerts";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/** Who can see this Care plan besides its owner. Owner only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (access.role !== "owner") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const members = await listCircleMembers(supabase, id);
  return NextResponse.json({ ok: true, members });
}

const patchSchema = z.object({ alertMissed: z.boolean() });

/** Owner preference: whether the circle is told about missed check-ins on this plan. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (access.role !== "owner") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const alertMissed = await setCircleAlertPreference(supabase, id, parsed.data.alertMissed);
  if (alertMissed === null) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, alertMissed });
}
