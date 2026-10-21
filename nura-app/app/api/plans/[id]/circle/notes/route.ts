import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getPlanAccess } from "@/lib/care-circle";
import {
  CIRCLE_NOTE_MAX_CHARS,
  createCircleNote,
  listCircleNotes,
  planOwnerFirstName,
  pushCircleNote,
} from "@/lib/care-circle-notes";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

/** Recent pass-on notes. The owner also sees the ones they withdrew; RLS hides those from watchers. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const notes = await listCircleNotes(supabase, id, { includeWithdrawn: access.role === "owner" });
  return NextResponse.json({ ok: true, notes });
}

const postSchema = z.object({ body: z.string().min(1).max(CIRCLE_NOTE_MAX_CHARS * 2) });

/** The owner passes something on to their circle in their own words. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (access.role !== "owner") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const result = await createCircleNote(supabase, { planId: id, body: parsed.data.body, source: "owner_app" });
  if (!result.ok) {
    if (result.error === "empty") return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    if (result.error === "limit") return NextResponse.json({ ok: false, error: "limit" }, { status: 429 });
    console.error("[circle-notes] insert failed", result.message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }

  if (!result.duplicate) {
    const admin = getSupabaseAdminClient();
    await pushCircleNote(admin, id, await planOwnerFirstName(admin, id), result.note).catch((error) =>
      console.error("[circle-notes] push failed", error),
    );
  }
  return NextResponse.json({ ok: true, note: result.note });
}
