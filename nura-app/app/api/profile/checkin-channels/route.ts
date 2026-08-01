import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  channels: z.array(z.enum(["whatsapp", "in_app", "voice"])).min(1),
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
  const preferred = profile?.preferred_checkin_channel as string | null;

  return NextResponse.json({
    ok: true,
    channels: channels.length > 0 ? channels : preferred === "whatsapp" || preferred === "in_app" || preferred === "voice" ? [preferred] : ["in_app"],
    preferred: preferred ?? null,
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

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.from("nura_profiles").upsert({
    id: user.id,
    preferred_checkin_channels: parsed.data.channels,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
