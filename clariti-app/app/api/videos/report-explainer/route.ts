import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildVideoScenes, claritiVideoAnalysisSchema, formatHumanVideoError, normalizeHumanVideoDuration } from "@/lib/ai/clariti-video";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const bodySchema = z.object({
  analysis: claritiVideoAnalysisSchema,
  sessionId: z.string().uuid().optional(),
  durationSeconds: z.coerce.number().optional().default(30),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "Sign in before generating document videos." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Supabase auth is required for video generation jobs." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "A saved Clariti document analysis is required." }, { status: 400 });
  }

  const { analysis, durationSeconds, sessionId } = parsed.data;

  const supabase = await getSupabaseSessionClient();
  if (sessionId) {
    const { data: session, error } = await supabase
      .from("clariti_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error || !session) {
      return NextResponse.json({ ok: false, error: "Clariti could not find this saved session." }, { status: 404 });
    }
  }

  const pipeline = process.env.CLARITI_VIDEO_PIPELINE === "shotstack" && process.env.SHOTSTACK_API_KEY
    ? "ai-video-scenes-shotstack"
    : "ai-video-job-single-render";
  const requestedDurationSeconds = pipeline === "ai-video-scenes-shotstack" ? durationSeconds : normalizeHumanVideoDuration(durationSeconds);
  const model = process.env.CLARITI_VIDEO_MODEL ?? "google/veo-3.1-generate-001";
  const scenes = buildVideoScenes(analysis, requestedDurationSeconds);

  const { data: job, error: insertError } = await supabase
    .from("clariti_video_generations")
    .insert({
      owner_id: user.id,
      session_id: sessionId ?? null,
      status: "queued",
      progress: 5,
      provider: "vercel-ai-gateway",
      model,
      duration_seconds: requestedDurationSeconds,
      pipeline,
      analysis,
      scenes,
    })
    .select("id, status, progress, provider, model, duration_seconds, pipeline, scenes, created_at, updated_at")
    .single();

  if (insertError || !job) {
    const rawMessage = insertError?.message ?? "Could not create the video job.";
    const setupHint = rawMessage.includes("clariti_video_generations")
      ? "Video jobs are not installed in Supabase yet. Apply supabase/migrations/0002_video_generations.sql, then retry."
      : rawMessage;
    return NextResponse.json({ ok: false, error: setupHint }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    job,
    message: "Video job queued. Poll the status endpoint to generate scenes and render the final explainer.",
  });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "Sign in before checking document videos." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Supabase auth is required for video generation jobs." }, { status: 503 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "A session ID is required." }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();
  const { data: session, error: sessionError } = await supabase
    .from("clariti_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ ok: false, error: "Clariti could not find this saved session." }, { status: 404 });
  }

  const { data: job, error } = await supabase
    .from("clariti_video_generations")
    .select("id, status, progress, provider, model, duration_seconds, pipeline, scenes, video_url, error_message, created_at, updated_at, completed_at")
    .eq("session_id", sessionId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    job: job ? {
      id: job.id,
      status: job.status,
      progress: job.progress,
      provider: job.provider,
      model: job.model,
      durationSeconds: Number(job.duration_seconds),
      pipeline: job.pipeline,
      scenes: job.scenes,
      videoUrl: job.video_url,
      error: formatHumanVideoError(job.error_message),
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
    } : null,
  });
}
