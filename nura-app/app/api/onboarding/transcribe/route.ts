import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/** Voice intake during setup — no Plus gate (trial starts after onboarding completes). */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (user.user_metadata?.onboarding_complete === true) {
    return NextResponse.json(
      { ok: false, error: "Use the workspace voice note after setup." },
      { status: 403 },
    );
  }

  const supabase = await getSupabaseSessionClient();
  const rateLimit = await checkRateLimit(supabase, user.id, "onboarding-voice-transcribe", 12, 300);
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
  upstream.append("file", audio, audio.name || "onboarding-voice.webm");
  upstream.append("model_id", "scribe_v1");

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[onboarding/transcribe] ElevenLabs error:", response.status, detail);
      return NextResponse.json(
        { ok: false, error: "Couldn't transcribe that. Please try again or type it in." },
        { status: 502 },
      );
    }

    const data = await response.json();
    const text = (data.text as string | undefined)?.trim();
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Didn't catch any speech. Try again or type it in." },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json({ ok: false, error: "transcription service unreachable" }, { status: 502 });
  }
}
