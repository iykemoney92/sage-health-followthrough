import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const patchSchema = z.object({ enabled: z.boolean() });

/** A watcher turns this plan's circle emails on or off for themselves. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const supabase = await getSupabaseSessionClient();
  // The function only touches the caller's own active membership, so there is nothing to check here.
  const { data: changed, error } = await supabase.rpc("nura_set_circle_email_updates", {
    target_plan: id,
    enabled: parsed.data.enabled,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!changed) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
