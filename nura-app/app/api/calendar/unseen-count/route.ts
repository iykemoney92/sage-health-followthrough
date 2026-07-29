import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("calendar_last_viewed_at")
    .eq("id", user.id)
    .maybeSingle();

  const lastViewedAt = profile?.calendar_last_viewed_at as string | null | undefined;

  if (!lastViewedAt) {
    // First time we've ever checked - start the clock now instead of counting everything
    // that existed before the user ever knew this feature existed.
    await supabase.from("nura_profiles").upsert({ id: user.id, calendar_last_viewed_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, count: 0 });
  }

  const [{ count: eventCount }, { count: checkInCount }] = await Promise.all([
    supabase
      .from("nura_calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gt("created_at", lastViewedAt),
    supabase
      .from("nura_check_ins")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .is("completed_at", null)
      .gt("created_at", lastViewedAt),
  ]);

  return NextResponse.json({ ok: true, count: (eventCount ?? 0) + (checkInCount ?? 0) });
}
