import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildVideoScenes,
  claritiVideoAnalysisSchema,
  designExplainerStoryboard,
  FLUX_MAX_CHAINED_SEGMENTS,
  FLUX_MAX_CLIP_SECONDS,
  FLUX_MIN_CLIP_SECONDS,
  FLUX_VIDEO_MODEL,
  formatHumanVideoError,
  isFluxVideoModel,
  normalizeVideoDuration,
  planFluxSegments,
  type ClaritiVideoPipeline,
} from "@/lib/ai/clariti-video";
import { enforceFreeLimit, FREE_VIDEO_LIMIT } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";
import { shotstackIsUsable } from "@/lib/integrations/shotstack";
import { enforceRateLimit } from "@/lib/rate-limit";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";

export const maxDuration = 60;

const bodySchema = z.object({
  analysis: claritiVideoAnalysisSchema,
  sessionId: z.string().uuid().nullish(),
  durationSeconds: z.coerce.number().optional().default(30),
});

const MAX_CHAINED_SECONDS = FLUX_MAX_CHAINED_SEGMENTS * FLUX_MAX_CLIP_SECONDS;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "Sign in before generating document videos." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Supabase auth is required for video generation jobs." }, { status: 503 });
  }
  if (!hasAiConsent(user)) {
    return aiConsentRequiredResponse();
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

  // Which pipeline a job runs is settled by the model. Flux 3 renders up to
  // twenty seconds in one call, so one clip is the whole explainer and there is
  // nothing left for Shotstack to stitch. Resolved here, ahead of the ceiling
  // below, because nothing in it costs anything: the Shotstack probe is the one
  // expensive part and it only runs on the Veo branch further down.
  const model = (process.env.CLARITI_VIDEO_MODEL ?? FLUX_VIDEO_MODEL).trim();
  const pipelineChoice = (process.env.CLARITI_VIDEO_PIPELINE ?? "").trim();
  const isFlux = isFluxVideoModel(model);
  const wantsChain = isFlux && pipelineChoice === "chained";

  // Refused rather than clamped: a chained segment bills at roughly 2.4x a
  // fresh clip, and quietly trimming a five-minute request to eighty seconds
  // would charge someone for a video they did not ask for.
  const chainedTotalSeconds = Math.max(FLUX_MIN_CLIP_SECONDS, Math.round(durationSeconds));
  if (wantsChain && chainedTotalSeconds > MAX_CHAINED_SECONDS) {
    return NextResponse.json({
      ok: false,
      error: `Clariti generates up to ${MAX_CHAINED_SECONDS} seconds of video. Ask for a shorter explainer and try again.`,
    }, { status: 400 });
  }

  // The free-tier gate stops at hasPlus, which left a subscriber with no ceiling
  // at all on the most expensive thing Clariti does. The duplicate-job guard
  // above is no substitute: it is scoped to one session, so the cheap loop of
  // "new session, new job" walks straight past it. Charged after the ownership,
  // free-tier and resume checks, so neither a malformed request nor a client
  // polling an already-running job burns somebody's quota.
  //
  // The queue windows, not the claim ones: a queued row costs nothing, and
  // sharing a budget with the claim would let queued jobs banked in one window
  // be cashed in the next. What this ceiling is for is telling an honest client
  // "not this hour" before it has a job to wait on.
  const rateLimited = await enforceRateLimit(supabase, "videosQueue", "videosQueueDaily");
  if (rateLimited) return rateLimited;

  // Shotstack only ever existed to work around Veo's eight-second ceiling, so
  // it stays reachable for the Veo models and nothing else. It now has to be
  // asked for by name as well as have a key that answers: a dead key used to
  // get as far as paying for five Veo scenes before failing at the stitch.
  const plannedPipeline: ClaritiVideoPipeline = isFlux
    ? wantsChain ? "flux-chained" : "flux-single"
    : pipelineChoice === "shotstack" && (await shotstackIsUsable())
      ? "ai-video-scenes-shotstack"
      : "ai-video-job-single-render";

  // A single Flux clip is one call against one prompt, so it does not need the
  // five-scene storyboard — and should not pay an LLM call to design one.
  const storyboard = plannedPipeline === "flux-chained" || plannedPipeline === "ai-video-scenes-shotstack"
    ? await designExplainerStoryboard(analysis)
    : analysis.videoScenes;
  const analysisWithStoryboard = {
    ...analysis,
    videoScenes: storyboard ?? analysis.videoScenes,
  };

  // The client's default of thirty seconds lands on Flux's twenty-second
  // ceiling, which is the product default for a single clip: one call in place
  // of the five Veo renders and a stitch it replaces.
  const legacyDurationSeconds = plannedPipeline === "ai-video-scenes-shotstack"
    ? 30
    : normalizeVideoDuration(model, durationSeconds);
  const scenes = plannedPipeline === "flux-single"
    ? planFluxSegments(analysisWithStoryboard, normalizeVideoDuration(model, durationSeconds))
    : plannedPipeline === "flux-chained"
      ? planFluxSegments(analysisWithStoryboard, chainedTotalSeconds)
      : buildVideoScenes(analysisWithStoryboard, legacyDurationSeconds);
  // `chained` is a ceiling on how long an explainer may run, not an instruction
  // to segment one that already fits in a single clip. A plan of one segment is
  // a single render, so the row says so — otherwise every reader of it, the
  // worker and the progress copy included, has to explain a chain of one.
  const pipeline: ClaritiVideoPipeline = plannedPipeline === "flux-chained" && scenes.length === 1
    ? "flux-single"
    : plannedPipeline;
  // Stored from the plan rather than from the request, so the row says how long
  // the video Clariti will actually render is.
  const requestedDurationSeconds = isFlux
    ? scenes.reduce((total, scene) => total + scene.durationSeconds, 0)
    : legacyDurationSeconds;

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
    message: pipeline === "flux-chained"
      ? `Video job queued. Clariti will generate ${scenes.length} segments in order, each continuing the one before it.`
      : pipeline === "ai-video-scenes-shotstack"
        ? "Video job queued. Clariti will generate 5 explainer scenes, then stitch them."
        : `Video job queued. Clariti will generate one ${requestedDurationSeconds}-second clip and save it to storage.`,
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
