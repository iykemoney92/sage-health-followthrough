import { NextResponse } from "next/server";
import { getPlanAccess, listCircleMembers } from "@/lib/care-circle";
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
