import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildVideoScenes, claritiVideoAnalysisSchema, designExplainerStoryboard, formatHumanVideoError, normalizeHumanVideoDuration } from "@/lib/ai/clariti-video";
import { enforceFreeLimit, FREE_VIDEO_LIMIT } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

export const maxDuration = 60;

const bodySchema = z.object({
  analysis: claritiVideoAnalysisSchema,
  sessionId: z.string().uuid().nullish(),
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
  if (!sessionId) {
    return NextResponse.json({
      ok: false,
      error: "This chat isn’t saved yet. Wait for Clariti to finish analyzing, then try Generate again.",
    }, { status: 400 });
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

  const limitResponse = await enforceFreeLimit(supabase, user.id, "videos", FREE_VIDEO_LIMIT);
  if (limitResponse) return limitResponse;

  const { data: activeJob } = await supabase
    .from("clariti_video_generations")
    .select("id, status, progress, provider, model, duration_seconds, pipeline, scenes, video_url, error_message, created_at, updated_at, completed_at")
    .eq("session_id", sessionId)
    .eq("owner_id", user.id)
    .in("status", ["queued", "scripting", "generating_scenes", "stitching"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeJob && !isStaleRow(activeJob.updated_at)) {
    return NextResponse.json({
      ok: true,
      job: publicJob(activeJob),
      message: "A video job is already running for this chat. Clariti will keep polling it.",
      resumed: true,
    });
  }

  // Multi-scene Shotstack is the product default whenever the stitch key is present.
  // Set CLARITI_VIDEO_PIPELINE=single only to force the short one-clip path.
  const pipeline = process.env.SHOTSTACK_API_KEY && process.env.CLARITI_VIDEO_PIPELINE !== "single"
    ? "ai-video-scenes-shotstack"
    : "ai-video-job-single-render";
  const requestedDurationSeconds = pipeline === "ai-video-scenes-shotstack"
    ? 30
    : normalizeHumanVideoDuration(durationSeconds);
  const model = (process.env.CLARITI_VIDEO_MODEL ?? "google/veo-3.1-generate-001").trim();

  const storyboard = pipeline === "ai-video-scenes-shotstack"
    ? await designExplainerStoryboard(analysis)
    : analysis.videoScenes;
  const analysisWithStoryboard = {
    ...analysis,
    videoScenes: storyboard ?? analysis.videoScenes,
  };
  const scenes = buildVideoScenes(analysisWithStoryboard, requestedDurationSeconds);

  const { data: job, error: insertError } = await supabase
    .from("clariti_video_generations")
    .insert({
      owner_id: user.id,
      session_id: sessionId,
      status: "queued",
      progress: 8,
      provider: "vercel-ai-gateway",
      model,
      duration_seconds: requestedDurationSeconds,
      pipeline,
      analysis: analysisWithStoryboard,
      scenes,
    })
    .select("id, status, progress, provider, model, duration_seconds, pipeline, scenes, video_url, error_message, created_at, updated_at, completed_at")
    .single();

  if (insertError || !job) {
    const rawMessage = insertError?.message ?? "Could not create the video job.";
    const setupHint = /clariti_video_generations|relation .* does not exist/i.test(rawMessage)
      ? "Video jobs are not installed in Supabase yet. Apply supabase/migrations/0002_video_generations.sql, then retry."
      : rawMessage;
    return NextResponse.json({ ok: false, error: setupHint }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    job: publicJob(job),
    message: pipeline === "ai-video-scenes-shotstack"
      ? "Video job queued. Clariti will generate 5 explainer scenes, then stitch them."
      : "Video job queued. Clariti will generate it and save the file to storage.",
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

  const { data: jobs, error } = await supabase
    .from("clariti_video_generations")
    .select("id, status, progress, provider, model, duration_seconds, pipeline, scenes, video_url, error_message, created_at, updated_at, completed_at")
    .eq("session_id", sessionId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const list = jobs ?? [];
  const completed = list.find((job) => job.status === "completed" && job.video_url);
  const active = list.find((job) => ["queued", "scripting", "generating_scenes", "stitching"].includes(job.status));
  const job = active && !isStaleRow(active.updated_at)
    ? active
    : completed ?? active ?? list[0] ?? null;

  return NextResponse.json({
    ok: true,
    job: job ? publicJob(job) : null,
    completedJob: completed ? publicJob(completed) : null,
  });
}

function publicJob(job: {
  id: string;
  status: string;
  progress: number;
  provider: string;
  model: string;
  duration_seconds: number;
  pipeline: string;
  scenes: unknown;
  video_url?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    provider: job.provider,
    model: job.model,
    durationSeconds: Number(job.duration_seconds),
    pipeline: job.pipeline,
    scenes: job.scenes,
    videoUrl: job.video_url ?? null,
    error: formatHumanVideoError(job.error_message),
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at ?? null,
  };
}

function isStaleRow(updatedAt: string | null | undefined) {
  if (!updatedAt) return true;
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp > 8 * 60 * 1000;
}
