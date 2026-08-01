import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";

const requestSchema = z.object({
  planId: z.string().uuid(),
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

  const supabase = await getSupabaseSessionClient();
  const { planId } = parsed.data;

  const context = await buildVoiceCheckinContext(
    supabase,
    user.id,
    planId,
    (user.user_metadata?.display_name as string | undefined) ?? undefined,
  );

  if (!context) {
    return NextResponse.json({ ok: false, error: "Care plan not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    elevenLabs: context,
  });
}
