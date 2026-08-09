import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidTimeZone } from "@/lib/timezone";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const bodySchema = z.object({
  timezone: z.string().min(1).max(64),
});

/**
 * Persist the browser-reported IANA timezone.
 * Writes auth user_metadata always; also nura_profiles.timezone when the column exists.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) {
    return NextResponse.json({ ok: false, error: "invalid_timezone" }, { status: 400 });
  }

  const timezone = parsed.data.timezone.trim();
  const supabase = await getSupabaseSessionClient();

  const currentMeta = (user.user_metadata?.timezone as string | undefined) ?? null;
  if (currentMeta === timezone) {
    // Still try profile column in case metadata is ahead of the row.
    await supabase.from("nura_profiles").upsert({ id: user.id, timezone }, { onConflict: "id" }).then(() => null);
    return NextResponse.json({ ok: true, timezone, unchanged: true });
  }

  const { error: metaError } = await supabase.auth.updateUser({ data: { timezone } });
  if (metaError) {
    return NextResponse.json({ ok: false, error: metaError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("nura_profiles")
    .upsert({ id: user.id, timezone }, { onConflict: "id" });

  return NextResponse.json({
    ok: true,
    timezone,
    profileSynced: !profileError,
  });
}
