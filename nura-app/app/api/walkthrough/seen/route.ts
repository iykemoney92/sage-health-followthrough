import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { hasSeenWalkthrough, WALKTHROUGH_SEEN_METADATA_KEY } from "@/lib/walkthrough";

/** Records that the welcome walkthrough has been shown, so it never pops up again for this account. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (hasSeenWalkthrough(user)) return NextResponse.json({ ok: true });

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.auth.updateUser({
    data: { [WALKTHROUGH_SEEN_METADATA_KEY]: new Date().toISOString() },
  });
  if (error) return NextResponse.json({ ok: false, error: "not_saved" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
