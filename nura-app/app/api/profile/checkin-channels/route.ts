import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orderCheckinChannels, primaryCheckinChannel, type CheckinChannel } from "@/lib/domain/checkin-channel";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  channels: z.array(z.enum(["whatsapp", "in_app", "voice"])).min(1),
  /** Preferred mode among the allowed set — defaults to voice when allowed. */
  preferred: z.enum(["whatsapp", "in_app", "voice"]).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("preferred_checkin_channel, preferred_checkin_channels")
    .eq("id", user.id)
    .maybeSingle();

  const channels = ((profile?.preferred_checkin_channels as string[] | null) ?? []).filter(
    (c): c is "whatsapp" | "in_app" | "voice" => c === "whatsapp" || c === "in_app" || c === "voice",
  );
  const preferredRaw = profile?.preferred_checkin_channel as string | null;
  const resolvedChannels: CheckinChannel[] =
    channels.length > 0
      ? channels
      : preferredRaw === "whatsapp" || preferredRaw === "in_app" || preferredRaw === "voice"
        ? [preferredRaw]
        : ["in_app"];

  return NextResponse.json({
    ok: true,
    channels: resolvedChannels,
    preferred: primaryCheckinChannel([...resolvedChannels], preferredRaw),
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const preferred = primaryCheckinChannel(parsed.data.channels, parsed.data.preferred);
  const ordered = orderCheckinChannels(parsed.data.channels, preferred);

  const supabase = await getSupabaseSessionClient();
  const payload: Record<string, unknown> = {
    id: user.id,
    preferred_checkin_channels: ordered,
    preferred_checkin_channel: preferred,
  };

  let { error } = await supabase.from("nura_profiles").upsert(payload);
  if (error?.message?.includes("preferred_checkin_channel")) {
    const { preferred_checkin_channel: _ignored, ...withoutSingular } = payload;
    ({ error } = await supabase.from("nura_profiles").upsert(withoutSingular));
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, preferred, channels: ordered });
}
