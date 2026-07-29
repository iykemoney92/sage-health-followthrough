import { NextRequest, NextResponse } from "next/server";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const paywall = await requirePlusAccess(supabase, user.id, "voice");
  if (paywall) return paywall;

  const rateLimit = await checkRateLimit(supabase, user.id, "voice-transcribe", 10, 300);
  if (rateLimit.limited) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "voice transcription is not configured" }, { status: 503 });
  }

  const incoming = await request.formData().catch(() => null);
  const audio = incoming?.get("audio");
  if (!audio || !(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ ok: false, error: "no audio provided" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "voice-note.webm");
  upstream.append("model_id", "scribe_v1");

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[voice/transcribe] ElevenLabs error:", response.status, detail);
      return NextResponse.json({ ok: false, error: "Couldn't transcribe that voice note. Please try again." }, { status: 502 });
    }

    const data = await response.json();
    const text = (data.text as string | undefined)?.trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: "couldn't hear anything in that recording" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json({ ok: false, error: "transcription service unreachable" }, { status: 502 });
  }
}
