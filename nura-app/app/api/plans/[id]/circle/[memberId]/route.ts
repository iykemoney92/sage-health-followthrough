import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/**
 * Removes someone from a Care plan's circle. The update runs under the owner_manages_circle
 * policy, so a caller who isn't the plan owner simply matches zero rows - there is no
 * separate ownership check to get out of sync with the database.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("nura_plan_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("plan_id", id)
    .eq("member_id", memberId)
    .is("revoked_at", null)
    .select("id");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
