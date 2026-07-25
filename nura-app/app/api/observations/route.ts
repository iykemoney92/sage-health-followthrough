import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  planId: z.string().uuid(),
  note: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { planId, note } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const { data: plan, error: planError } = await supabase
    .from("nura_plans")
    .select("id")
    .eq("id", planId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (planError || !plan) {
    return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("nura_observations")
    .insert({ owner_id: user.id, plan_id: planId, label: "note", value: note, recorded_at: now });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("nura_plans")
    .update({ updated_at: now })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
