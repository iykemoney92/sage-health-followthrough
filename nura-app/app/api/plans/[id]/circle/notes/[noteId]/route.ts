import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/**
 * The owner takes a pass-on note back. It stays in their own list marked as withdrawn, and the
 * circle stops seeing it immediately (their RLS policy excludes withdrawn notes).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  // owner_access RLS is the gate: a watcher's update matches no rows.
  const { data, error } = await supabase
    .from("nura_plan_circle_notes")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("plan_id", id)
    .eq("owner_id", user.id)
    .is("withdrawn_at", null)
    .select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
