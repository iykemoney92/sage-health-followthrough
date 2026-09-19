import { experimental_generateVideo as generateVideo } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { getShotstackApiKey, getShotstackBaseUrl } from "@/lib/integrations/shotstack";
import {
  buildFluxSegmentPrompt,
  buildHumanPresenterPrompt,
  claritiVideoAnalysisSchema,
  classifyContinuation,
  FLUX_MAX_CHAINED_SEGMENTS,
  formatHumanVideoError,
  isFluxVideoModel,
  normalizeVideoDuration,
  readReportedDuration,
  videoResolutionFor,
  type ClaritiChainedSegmentShape,
  type ClaritiVideoAnalysis,
  type ClaritiVideoPipeline,
  type ClaritiVideoScene,
} from "@/lib/ai/clariti-video";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";

export const dynamic = "force-dynamic";
// Enough for a single clip with room to spare. A chained run is sequential by
// necessity, and four segments do not fit here — so the chain does not try to
// finish in one request. It renders what fits, writes the finished segments to
// the row, and hands the job back as `queued`; the next claim picks up from the
// last completed segment. Raising this makes a chain finish in fewer requests
// rather than making it possible at all, so it can stay at the value every plan
// allows.
export const maxDuration = 300;

/**
 * How long one claim may spend rendering before it hands the job back. The
 * remainder of `maxDuration` pays for claiming the row, uploading the last clip
 * and writing it — none of which may be cut off, because a segment that is paid
 * for and not recorded is a segment the next claim pays for again.
 */
const CHAIN_CLAIM_BUDGET_MS = (maxDuration - 45) * 1000;

type VideoJobRecord = {
  id: string;
  owner_id: string;
  session_id: string | null;
  status: "queued" | "scripting" | "generating_scenes" | "stitching" | "completed" | "failed";
  progress: number;
  provider: string;
  model: string;
  duration_seconds: number;
  pipeline: string;
  scenes: ClaritiVideoScene[];
  analysis: unknown;
  video_url: string | null;
  provider_response: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type RenderedVideoResult = {
  videoUrl: string;
  scenes?: ClaritiVideoScene[];
  providerResponse: Record<string, unknown>;
};

type ChainedSegmentRecord = {
  sceneIndex: number;
  requestedSeconds: number;
  reportedSeconds: number | null;
  estimatedSeconds: number | null;
  cumulativeSeconds: number;
  byteSize: number;
  mediaType: string;
  /** What the provider's own reported duration says this clip holds. */
  reportedShape: ClaritiChainedSegmentShape;
  /** What the clip's size says, measured against the first segment's bitrate. */
  estimatedShape: ClaritiChainedSegmentShape;
  /** The verdict acted on, and why it was reached. */
  shape: ClaritiChainedSegmentShape;
  shapeEvidence: "agreed" | "reported-only" | "estimated-only" | "disagreed" | "none";
  storagePath: string;
  warnings: unknown;
};

/**
 * A chained run that rendered every segment but produced no single file to save.
 * Each segment has already been paid for and uploaded, so the failure path
 * records them on the row rather than blanking every scene URL.
 */
class ChainedSegmentsError extends Error {
  constructor(
    message: string,
    readonly scenes: ClaritiVideoScene[],
    readonly providerResponse: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ChainedSegmentsError";
  }
}

/**
 * A chained run that used up its claim without finishing. Everything rendered is
 * already uploaded and on the row, so the job goes back to 'queued' rather than
 * 'failed': the next claim resumes from the last completed segment instead of
 * paying for it a second time.
 */
class ChainedPausedError extends Error {
  constructor(
    readonly scenes: ClaritiVideoScene[],
    readonly providerResponse: Record<string, unknown>,
    readonly progress: number,
  ) {
    super("The video job ran out of time in this request and will continue on the next one.");
    this.name = "ChainedPausedError";
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "Sign in before checking video generation." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Supabase auth is required for video generation jobs." }, { status: 503 });
  }

  const { id } = await params;
  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_video_generations")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Video job not found." }, { status: 404 });
  }

  const job = data as VideoJobRecord;
  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json({ ok: true, job: publicJob(job) });
  }

  const shouldProcess = request.nextUrl.searchParams.get("process") === "1";
  if (!shouldProcess) {
    return NextResponse.json({ ok: true, job: publicJob(job) });
  }

  // This claim, not the enqueue, is the request that sends the analysis to Black
  // Forest Labs, so guideline 5.1.2(i) applies here too. Scoped to the process
  // branch: a reader who withdraws consent mid-render can still poll the job and
  // see what happened to it.
  if (!hasAiConsent(user)) {
    return aiConsentRequiredResponse();
  }

  const claimed = await claimJob(job);
  if (!claimed) {
    const { data: latest } = await supabase
      .from("clariti_video_generations")
      .select("*")
      .eq("id", job.id)
      .eq("owner_id", user.id)
      .single();
    return NextResponse.json({ ok: true, job: publicJob((latest as VideoJobRecord | null) ?? job) });
  }

  // This is the ceiling that bounds spend, and it is charged on its own windows
  // rather than the ones the enqueue route uses: a queued row is free, and a
  // claim is a render. A stale job can also be re-claimed any number of times,
  // and none of those pass through the enqueue route.
  //
  // A claim that resumes work already on the row is not charged again. A chained
  // job hands itself back as 'queued' when it runs out of request time, and a
  // renderer that resumes only ever renders what is still missing — so the
  // several claims one long explainer takes are one explainer's worth of spend,
  // already admitted by the enqueue ceiling and bounded by
  // FLUX_MAX_CHAINED_SEGMENTS. Charging each of them would stop the job partway
  // through and leave the segments already paid for with nothing to join them.
  if (!hasRenderedWork(job)) {
    const rateLimited = await enforceRateLimit(supabase, "videos", "videosDaily");
    if (rateLimited) {
      // Rolled back from the pre-claim record, not the claimed one: claiming
      // rewrites every scene to "generating", so `job` is the state to restore.
      await releaseJob(job);
      return rateLimited;
    }
  }

  const processed = await processJob(claimed);
  return NextResponse.json({ ok: true, job: publicJob(processed) });
}

async function claimJob(job: VideoJobRecord): Promise<VideoJobRecord | null> {
  if (job.status !== "queued" && !isStaleJob(job)) return null;

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_video_generations")
    .update({
      status: "generating_scenes",
      progress: Math.max(job.progress ?? 0, 15),
      scenes: markScenes(job.scenes, "generating"),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("owner_id", job.owner_id)
    .in("status", isStaleJob(job)
      ? ["queued", "scripting", "generating_scenes", "stitching"]
      : ["queued"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as VideoJobRecord | null) ?? null;
}

/**
 * Undo a claim that turned out not to be allowed to spend anything. The row goes
 * back to 'queued' rather than 'failed' so the same job is still there to run
 * once the window rolls over — being over a ceiling is not a broken job.
 */
async function releaseJob(job: VideoJobRecord) {
  const supabase = await getSupabaseSessionClient();
  await supabase
    .from("clariti_video_generations")
    .update({
      status: "queued",
      progress: job.progress ?? 8,
      // Written back verbatim rather than re-marked: any scene already rendered
      // has been paid for, and a rollback should not throw that away.
      scenes: job.scenes ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("owner_id", job.owner_id);
}

async function processJob(job: VideoJobRecord): Promise<VideoJobRecord> {
  const supabase = await getSupabaseSessionClient();
  const analysis = claritiVideoAnalysisSchema.parse(job.analysis);

  try {
    await updateJob(job.id, {
      status: "generating_scenes",
      progress: 20,
      scenes: markScenes(job.scenes, "generating"),
    });

    const rendered = await renderExplainerVideo(job, analysis);
    await assertStoredVideoReachable(rendered.videoUrl);

    const completedScenes = rendered.scenes ?? markScenes(job.scenes, "completed", rendered.videoUrl);
    const { data, error } = await supabase
      .from("clariti_video_generations")
      .update({
        status: "completed",
        progress: 100,
        scenes: completedScenes,
        video_url: rendered.videoUrl,
        provider_response: rendered.providerResponse,
        error_message: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Could not save completed video job.");
    return data as VideoJobRecord;
  } catch (error) {
    // Out of request time rather than broken. The row keeps every finished
    // segment and goes back to the state a claim starts from, so the next poll
    // continues the chain instead of restarting it.
    if (error instanceof ChainedPausedError) {
      const { data } = await supabase
        .from("clariti_video_generations")
        .update({
          status: "queued",
          progress: error.progress,
          scenes: error.scenes,
          provider_response: error.providerResponse,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .select("*")
        .single();
      return (data as VideoJobRecord | null) ?? { ...job, status: "queued" };
    }

    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = formatHumanVideoError(error);
    // A chained run that got every segment rendered still has real files in the
    // bucket. Marking the job failed is honest, but throwing away the URLs of
    // clips the reader has already been billed for is not.
    const partial = error instanceof ChainedSegmentsError ? error : null;
    const { data } = await supabase
      .from("clariti_video_generations")
      .update({
        status: "failed",
        progress: Math.max(job.progress ?? 0, 20),
        error_message: message,
        provider_response: {
          rawError: rawMessage.slice(0, 1200),
          ...(partial?.providerResponse ?? {}),
        },
        scenes: partial?.scenes ?? markScenes(job.scenes, "failed", undefined, message),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single();

    return (data as VideoJobRecord | null) ?? { ...job, status: "failed", error_message: message };
  }
}

async function generateSinglePresenterVideo(job: VideoJobRecord, analysis: ClaritiVideoAnalysis) {
  // Every path that is not one of the four known pipelines lands here, so the
  // length has to be rounded for the row's own model: Veo's 4/6/8 is a duration
  // Flux rejects outright.
  const model = job.model.trim();
  const durationSeconds = normalizeVideoDuration(model, job.duration_seconds);
  const { video, warnings } = await generateVideo({
    model: job.model,
    prompt: buildHumanPresenterPrompt(analysis, durationSeconds, { model }),
    aspectRatio: "16:9",
    resolution: videoResolutionFor(model),
    duration: durationSeconds,
    generateAudio: true,
  });

  if (!video?.base64) {
    throw new Error("The video model returned no file to save.");
  }

  const videoUrl = await uploadVideo(`${job.owner_id}/${job.id}.${extensionFor(video.mediaType)}`, video.base64, video.mediaType);
  return {
    videoUrl,
    providerResponse: { warnings, mediaType: video.mediaType, pipeline: "single-render", storagePath: `${job.owner_id}/${job.id}.${extensionFor(video.mediaType)}` },
  };
}

async function renderExplainerVideo(job: VideoJobRecord, analysis: ClaritiVideoAnalysis): Promise<RenderedVideoResult> {
  switch (job.pipeline as ClaritiVideoPipeline) {
    case "flux-single":
      return generateSingleFluxVideo(job, analysis);
    case "flux-chained":
      return generateChainedFluxVideo(job, analysis);
    case "ai-video-scenes-shotstack":
      // The stitch is a Veo workaround and nothing else, so the model decides as
      // well as the pipeline: a Flux row that somehow carries this pipeline
      // renders as one clip rather than paying for scenes it has no need of. The
      // key is re-checked rather than trusted from enqueue time, because a queued
      // row outlives the environment it was written in, and a Veo job with no
      // stitcher is better rendered as one clip than failed at the last step.
      return !isFluxVideoModel(job.model) && getShotstackApiKey()
        ? generateScenesAndStitch(job)
        : generateSinglePresenterVideo(job, analysis);
    default:
      return generateSinglePresenterVideo(job, analysis);
  }
}

/**
 * The whole explainer in one call. Flux renders up to twenty seconds natively,
 * which is what makes this the default: no storyboard, no five renders, no
 * stitch, and one file that is already the finished video.
 */
async function generateSingleFluxVideo(job: VideoJobRecord, analysis: ClaritiVideoAnalysis): Promise<RenderedVideoResult> {
  const model = job.model.trim();
  const scene = (job.scenes ?? [])[0];
  const durationSeconds = normalizeVideoDuration(model, scene?.durationSeconds ?? job.duration_seconds);
  const prompt = scene
    ? promptForSegment(analysis, { ...scene, durationSeconds })
    : buildHumanPresenterPrompt(analysis, durationSeconds, { model });

  const { video, warnings, providerMetadata } = await generateVideo({
    model,
    prompt,
    aspectRatio: "16:9",
    resolution: videoResolutionFor(model),
    duration: durationSeconds,
    fps: 24,
    generateAudio: true,
  });

  if (!video?.base64) {
    throw new Error("The video model returned no file to save.");
  }

  const storagePath = `${job.owner_id}/${job.id}.${extensionFor(video.mediaType)}`;
  const videoUrl = await uploadVideo(storagePath, video.base64, video.mediaType);
  return {
    videoUrl,
    providerResponse: {
      pipeline: "flux-single",
      warnings,
      mediaType: video.mediaType,
      requestedSeconds: durationSeconds,
      reportedSeconds: readReportedDuration(providerMetadata),
      byteSize: video.uint8Array.byteLength,
      storagePath,
    },
  };
}

/**
 * An explainer longer than one Flux clip, rendered as a chain.
 *
 * Strictly sequential, never pooled: segment N+1 is generated from segment N's
 * own bytes, so there is nothing to overlap. Four sequential renders do not fit
 * in one request, so the chain does not try to: it renders what its claim has
 * time for, leaves every finished segment on the row, and hands the job back as
 * 'queued'. The next claim skips the segments that already have a clip and reads
 * the last of them back out of storage for the reference it continues from, so a
 * request that is cut off costs at most the segment that was in flight.
 *
 * What a continued clip contains is not settled. `extend-video` may hand back
 * the whole video so far or only the new footage, and there is no way to learn
 * which without spending money on a call. So every segment is measured twice —
 * against the duration the provider reports and against its own size — and both
 * verdicts are written to `provider_response`. The finished video is saved only
 * when the last clip is plainly the whole piece. Anything else fails the job with
 * the segments kept: a truncated video saved as the explainer would be worse than
 * no video at all, and there is no stitcher on this path to join them.
 */
async function generateChainedFluxVideo(job: VideoJobRecord, analysis: ClaritiVideoAnalysis): Promise<RenderedVideoResult> {
  const model = job.model.trim();
  const resolution = videoResolutionFor(model);
  const plan = [...(job.scenes ?? [])].sort((a, b) => a.sceneIndex - b.sceneIndex);

  if (!plan.length) throw new Error("This video job has no segments to render.");
  // Re-checked here as well as at enqueue time, because a row can be claimed
  // long after it was written and an oversized plan should be refused before the
  // first call rather than after three of them.
  if (plan.length > FLUX_MAX_CHAINED_SEGMENTS) {
    throw new Error(`Clariti generates at most ${FLUX_MAX_CHAINED_SEGMENTS} video segments. Ask for a shorter explainer and try again.`);
  }

  const startedAt = Date.now();
  const completedByIndex = new Map<number, ClaritiVideoScene>();
  const records: ChainedSegmentRecord[] = [...readChainedSegmentRecords(job.provider_response)];
  const snapshot = () => plan.map((item) => completedByIndex.get(item.sceneIndex) ?? { ...item, status: "generating" as const });
  const progressFor = (done: number) => 20 + Math.round((done / plan.length) * 70);

  // Leading segments that already have a clip were paid for by an earlier claim.
  const resumeFrom = firstUnrenderedIndex(plan);
  let cumulativeSeconds = 0;
  for (const scene of plan.slice(0, resumeFrom)) {
    cumulativeSeconds += normalizeVideoDuration(model, scene.durationSeconds);
    completedByIndex.set(scene.sceneIndex, { ...scene, status: "completed" });
  }

  let previous: { bytes: Uint8Array; mediaType: string } | null = resumeFrom > 0
    ? await readSegmentForContinuation(plan[resumeFrom - 1])
    : null;
  // The first segment sets the bitrate every later one is measured against,
  // which is what makes a byte count readable as a length at all when the
  // provider reports no duration of its own. It survives a resume through the
  // records already on the row.
  let bytesPerSecond = firstSegmentBytesPerSecond(records);
  let slowestSegmentMs = 0;

  for (const [index, scene] of plan.entries()) {
    if (index < resumeFrom) continue;
    const durationSeconds = normalizeVideoDuration(model, scene.durationSeconds);
    cumulativeSeconds += durationSeconds;
    const segmentStartedAt = Date.now();

    const { video, warnings, providerMetadata } = await generateVideo({
      model,
      prompt: promptForSegment(analysis, { ...scene, durationSeconds }),
      aspectRatio: "16:9",
      resolution,
      duration: durationSeconds,
      fps: 24,
      generateAudio: true,
      ...(previous ? { inputReferences: [{ data: previous.bytes, mediaType: previous.mediaType }] } : {}),
    });

    // The reference has done its work. In the shape this path is built to save,
    // it holds the whole video so far, so it is released before the upload
    // allocates a copy of the new clip rather than after.
    previous = null;

    if (!video?.base64) throw new Error(`Segment ${scene.sceneIndex + 1} returned no video file to save.`);

    const storagePath = `${job.owner_id}/${job.id}/segment-${scene.sceneIndex}.${extensionFor(video.mediaType)}`;
    const videoUrl = await uploadVideo(storagePath, video.base64, video.mediaType);
    completedByIndex.set(scene.sceneIndex, { ...scene, durationSeconds, status: "completed", videoUrl });

    const byteSize = video.uint8Array.byteLength;
    if (bytesPerSecond <= 0) bytesPerSecond = byteSize / durationSeconds;
    const reportedSeconds = readReportedDuration(providerMetadata);
    const estimatedSeconds = bytesPerSecond > 0 ? byteSize / bytesPerSecond : null;
    records.push({
      sceneIndex: scene.sceneIndex,
      requestedSeconds: durationSeconds,
      reportedSeconds,
      estimatedSeconds,
      cumulativeSeconds,
      byteSize,
      mediaType: video.mediaType,
      ...(index === 0
        ? { reportedShape: "fresh" as const, estimatedShape: "fresh" as const, shape: "fresh" as const, shapeEvidence: "agreed" as const }
        : judgeContinuationShape(reportedSeconds, estimatedSeconds, durationSeconds, cumulativeSeconds)),
      storagePath,
      warnings,
    });

    await updateJob(job.id, {
      progress: progressFor(index + 1),
      scenes: snapshot(),
      provider_response: { pipeline: "flux-chained", segments: records },
    });

    const isLast = index === plan.length - 1;
    // The gateway accepts mp4 alone as a video input, so a clip that came back
    // as anything else cannot be continued from and there is no point spending
    // on a call that will be rejected.
    if (!isLast && !video.mediaType.toLowerCase().includes("mp4")) {
      throw new ChainedSegmentsError(
        "Clariti could not continue the video from the previous clip. The segments are saved individually.",
        snapshot(),
        { pipeline: "flux-chained", segments: records, outcome: "unsupported-reference-media-type" },
      );
    }

    slowestSegmentMs = Math.max(slowestSegmentMs, Date.now() - segmentStartedAt);
    // Measured against the slowest segment so far rather than the last one: a
    // request that starts a segment it cannot finish pays for a clip nobody
    // receives, which is the one outcome worth a whole extra round trip to avoid.
    if (!isLast && Date.now() + slowestSegmentMs > startedAt + CHAIN_CLAIM_BUDGET_MS) {
      throw new ChainedPausedError(
        snapshot(),
        { pipeline: "flux-chained", segments: records, outcome: "paused-for-next-claim" },
        progressFor(index + 1),
      );
    }

    previous = { bytes: video.uint8Array, mediaType: video.mediaType };
  }

  const finished = plan
    .map((scene) => completedByIndex.get(scene.sceneIndex))
    .filter((scene): scene is ClaritiVideoScene => Boolean(scene?.videoUrl));
  const last = records[records.length - 1];
  const isWholeExplainer = records.length === 1 || records.slice(1).every((record) => record.shape === "extended");

  if (!isWholeExplainer) {
    throw new ChainedSegmentsError(
      "Clariti generated each segment, but the continued clips did not include the earlier ones. The segments are saved individually.",
      finished,
      {
        pipeline: "flux-chained",
        segments: records,
        outcome: records.slice(1).some((record) => record.shapeEvidence === "disagreed")
          ? "continuation-shape-unclear"
          : "segments-not-cumulative",
      },
    );
  }

  return {
    // The last clip is the whole video, so it is saved as it stands. Copying it
    // to a second path would only duplicate the bytes.
    videoUrl: completedByIndex.get(last.sceneIndex)!.videoUrl!,
    scenes: finished,
    providerResponse: {
      pipeline: "flux-chained",
      segments: records,
      segmentCount: records.length,
      resolution,
      outcome: "extended-video",
    },
  };
}

/**
 * What the two independent readings of a continued clip agree on.
 *
 * The gateway publishes no schema for a video response's metadata, so a
 * duration found in it could as easily be the request echoed back — which for a
 * continued clip is exactly the length that reads as "the new footage alone".
 * Preferring it over the byte-size estimate would throw away a whole chain on the
 * shape of a payload. So each reading is taken on its own, and a verdict is acted
 * on only where they agree or where only one of them said anything at all.
 */
function judgeContinuationShape(
  reportedSeconds: number | null,
  estimatedSeconds: number | null,
  segmentSeconds: number,
  cumulativeSeconds: number,
) {
  const reportedShape = classifyContinuation(reportedSeconds, segmentSeconds, cumulativeSeconds);
  const estimatedShape = classifyContinuation(estimatedSeconds, segmentSeconds, cumulativeSeconds);

  if (reportedShape === "unknown" && estimatedShape === "unknown") {
    return { reportedShape, estimatedShape, shape: "unknown" as ClaritiChainedSegmentShape, shapeEvidence: "none" as const };
  }
  if (reportedShape === estimatedShape) {
    return { reportedShape, estimatedShape, shape: reportedShape, shapeEvidence: "agreed" as const };
  }
  if (estimatedShape === "unknown") {
    return { reportedShape, estimatedShape, shape: reportedShape, shapeEvidence: "reported-only" as const };
  }
  if (reportedShape === "unknown") {
    return { reportedShape, estimatedShape, shape: estimatedShape, shapeEvidence: "estimated-only" as const };
  }
  return { reportedShape, estimatedShape, shape: "unknown" as ClaritiChainedSegmentShape, shapeEvidence: "disagreed" as const };
}

/** The first segment with no clip yet. Everything before it is already paid for. */
function firstUnrenderedIndex(plan: ClaritiVideoScene[]) {
  const missing = plan.findIndex((scene) => !scene.videoUrl);
  return missing === -1 ? plan.length : missing;
}

function readChainedSegmentRecords(providerResponse: unknown): ChainedSegmentRecord[] {
  if (!providerResponse || typeof providerResponse !== "object") return [];
  const segments = (providerResponse as { segments?: unknown }).segments;
  return Array.isArray(segments) ? segments as ChainedSegmentRecord[] : [];
}

function firstSegmentBytesPerSecond(records: ChainedSegmentRecord[]) {
  const first = records.find((record) => record.sceneIndex === 0);
  if (!first?.byteSize || !first.requestedSeconds) return 0;
  return first.byteSize / first.requestedSeconds;
}

/**
 * The clip a resumed chain continues from. Its bytes are no longer in memory —
 * an earlier request rendered it — so they come back out of the private bucket.
 */
async function readSegmentForContinuation(scene: ClaritiVideoScene) {
  const supabase = await getSupabaseSessionClient();
  const path = pathForMediaUrl(scene.videoUrl!);
  const { data, error } = await supabase.storage.from("clariti-videos").download(path);
  if (error || !data) {
    throw new Error(`Could not read segment ${scene.sceneIndex + 1} back from storage: ${error?.message ?? "the file is missing"}`);
  }
  return {
    bytes: new Uint8Array(await data.arrayBuffer()),
    mediaType: path.endsWith(".webm") ? "video/webm" : "video/mp4",
  };
}

/**
 * The plan written at enqueue time already carries each segment's prompt, so it
 * is used as written; rebuilding is the fallback for a row queued before the
 * Flux pipeline existed, which would otherwise reach the model with nothing.
 */
function promptForSegment(analysis: ClaritiVideoAnalysis, scene: ClaritiVideoScene) {
  const stored = scene.prompt?.trim();
  if (stored) return stored;
  return buildFluxSegmentPrompt(analysis, scene, { isContinuation: scene.sceneIndex > 0 });
}

async function generateScenesAndStitch(job: VideoJobRecord): Promise<RenderedVideoResult> {
  const existingCompleted = (job.scenes ?? []).filter((scene) => scene.status === "completed" && scene.videoUrl);
  const pendingScenes = (job.scenes ?? []).filter(
    (scene) => !existingCompleted.some((done) => done.sceneIndex === scene.sceneIndex && done.videoUrl),
  );
  const totalScenes = Math.max((job.scenes ?? []).length, 1);
  const completedByIndex = new Map(existingCompleted.map((scene) => [scene.sceneIndex, scene]));

  await updateJob(job.id, {
    progress: 20,
    scenes: (job.scenes ?? []).map((scene) => (
      completedByIndex.has(scene.sceneIndex)
        ? completedByIndex.get(scene.sceneIndex)!
        : { ...scene, status: "generating" as const }
    )),
  });

  // Parallel with a small pool so wall-clock ≈ 2 Veo waves, not 5 sequential calls.
  await mapPool(pendingScenes, 3, async (scene) => {
    const { video, warnings } = await generateVideo({
      model: job.model.trim(),
      prompt: scene.prompt,
      aspectRatio: "16:9",
      resolution: "1280x720",
      duration: Math.min(scene.durationSeconds, 8),
      generateAudio: true,
    });
    if (!video?.base64) throw new Error(`Scene ${scene.sceneIndex + 1} returned no video file to save.`);

    const scenePath = `${job.owner_id}/${job.id}/scene-${scene.sceneIndex}.${extensionFor(video.mediaType)}`;
    const sceneUrl = await uploadVideo(scenePath, video.base64, video.mediaType);
    completedByIndex.set(scene.sceneIndex, { ...scene, status: "completed", videoUrl: sceneUrl });

    const snapshot = (job.scenes ?? [])
      .map((item) => completedByIndex.get(item.sceneIndex) ?? { ...item, status: "generating" as const })
      .sort((a, b) => a.sceneIndex - b.sceneIndex);
    await updateJob(job.id, {
      progress: 20 + Math.round((completedByIndex.size / totalScenes) * 55),
      scenes: snapshot,
      provider_response: { lastSceneWarnings: warnings, completedScenes: completedByIndex.size },
    });
  });

  const completedScenes = (job.scenes ?? [])
    .map((scene) => completedByIndex.get(scene.sceneIndex))
    .filter((scene): scene is ClaritiVideoScene => Boolean(scene?.videoUrl))
    .sort((a, b) => a.sceneIndex - b.sceneIndex);

  if (completedScenes.length < totalScenes) {
    throw new Error(`Only ${completedScenes.length} of ${totalScenes} explainer scenes were generated.`);
  }

  await updateJob(job.id, {
    status: "stitching",
    progress: 82,
    scenes: completedScenes,
  });

  const stitchedUrl = await stitchWithShotstack(job.id, await signedSceneSources(completedScenes), { retries: 1 });
  const storedUrl = await copyRemoteVideoToStorage(stitchedUrl, `${job.owner_id}/${job.id}.mp4`);
  return {
    videoUrl: storedUrl,
    scenes: completedScenes,
    providerResponse: { pipeline: "scene-render-shotstack", sceneCount: completedScenes.length, shotstackUrl: stitchedUrl },
  };
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase
    .from("clariti_video_generations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not update video job: ${error.message}`);
}

/**
 * How long a scene clip's signed URL has to stay valid for Shotstack to fetch it.
 * A five-scene stitch queues, renders, and downloads well inside this.
 */
const SHOTSTACK_FETCH_TTL_SECONDS = 60 * 60;

/** Storage path → the app-relative URL that /api/media resolves per request. */
function mediaUrlForPath(path: string) {
  return `/api/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function pathForMediaUrl(mediaUrl: string) {
  return mediaUrl.replace(/^\/api\/media\//, "").split("/").map(decodeURIComponent).join("/");
}

async function uploadVideo(path: string, base64: string, mediaType: string) {
  const supabase = await getSupabaseSessionClient();
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("Generated video file was empty, so Clariti could not save it.");

  const { error } = await supabase.storage
    .from("clariti-videos")
    .upload(path, buffer, { contentType: mediaType, upsert: true });
  if (error) throw new Error(`Could not save the video to storage: ${error.message}`);

  // The path, not a public URL: clariti-videos is a private bucket, because these
  // files are generated from someone's medical document. /api/media re-checks
  // ownership and mints a short-lived signed URL on each read.
  return mediaUrlForPath(path);
}

async function copyRemoteVideoToStorage(remoteUrl: string, path: string) {
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Could not download Shotstack render: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Downloaded Shotstack render was empty.");
  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.storage
    .from("clariti-videos")
    .upload(path, buffer, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Could not save stitched video to storage: ${error.message}`);
  return mediaUrlForPath(path);
}

/**
 * Shotstack fetches each scene clip over the public internet, so it needs a real
 * URL rather than the app-relative one the app stores. Signing per render keeps
 * the bucket private: the URL Shotstack receives is unguessable and expires.
 */
async function signedSceneSources(scenes: ClaritiVideoScene[]) {
  const supabase = await getSupabaseSessionClient();
  const paths = scenes.map((scene) => pathForMediaUrl(scene.videoUrl!));
  const { data, error } = await supabase.storage
    .from("clariti-videos")
    .createSignedUrls(paths, SHOTSTACK_FETCH_TTL_SECONDS);

  if (error) throw new Error(`Could not prepare the scene clips for stitching: ${error.message}`);

  return scenes.map((scene, index) => {
    const signed = data?.[index]?.signedUrl;
    if (!signed) throw new Error(`Scene ${scene.sceneIndex + 1} could not be prepared for stitching.`);
    return { ...scene, videoUrl: signed };
  });
}

/**
 * Confirms the finished file is actually in the bucket before the job is marked
 * completed. It used to HEAD the public URL; with a private bucket the object
 * listing is the equivalent check and needs no round trip through the CDN.
 */
async function assertStoredVideoReachable(mediaUrl: string) {
  const path = pathForMediaUrl(mediaUrl);
  const lastSlash = path.lastIndexOf("/");
  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase.storage
    .from("clariti-videos")
    .list(path.slice(0, lastSlash), { search: path.slice(lastSlash + 1), limit: 1 });

  if (error) throw new Error(`Clariti could not confirm the saved video: ${error.message}`);
  if (!data?.length) throw new Error("The finished video was not found in storage after saving.");
}

async function stitchWithShotstack(jobId: string, scenes: ClaritiVideoScene[], options?: { retries?: number }) {
  const apiKey = getShotstackApiKey();
  if (!apiKey) throw new Error("SHOTSTACK_API_KEY is required for scene stitching.");
  const baseUrl = getShotstackBaseUrl();
  const retries = options?.retries ?? 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      let start = 0;
      const clips = scenes.map((scene) => {
        const clip = {
          asset: { type: "video", src: scene.videoUrl },
          start,
          length: scene.durationSeconds,
        };
        start += scene.durationSeconds;
        return clip;
      });

      const renderResponse = await fetch(`${baseUrl}/render`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          timeline: { tracks: [{ clips }] },
          output: { format: "mp4", resolution: "hd" },
        }),
      });
      const renderPayload = await renderResponse.json().catch(() => null);
      if (!renderResponse.ok) throw new Error(formatProviderError("Shotstack render request failed", renderPayload));
      const renderId = renderPayload?.response?.id;
      if (!renderId) throw new Error("Shotstack did not return a render ID.");

      for (let poll = 0; poll < 48; poll += 1) {
        await new Promise((resolve) => setTimeout(resolve, poll === 0 ? 3000 : 2500));
        const statusResponse = await fetch(`${baseUrl}/render/${renderId}`, {
          headers: { "x-api-key": apiKey },
        });
        const statusPayload = await statusResponse.json().catch(() => null);
        if (!statusResponse.ok) throw new Error(formatProviderError("Shotstack status check failed", statusPayload));
        const status = statusPayload?.response?.status;
        if (status === "done" && statusPayload?.response?.url) return statusPayload.response.url as string;
        if (status === "failed") throw new Error(formatProviderError("Shotstack render failed", statusPayload));
      }

      throw new Error("Shotstack render timed out.");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Shotstack stitching failed.");
    }
  }

  throw lastError ?? new Error("Shotstack stitching failed.");
}

function formatProviderError(fallback: string, payload: unknown) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const response = typeof record.response === "object" && record.response ? record.response as Record<string, unknown> : null;
  const error = record.error ?? response?.error ?? record.message ?? response?.message;
  if (typeof error === "string" && error.trim()) return `${fallback}: ${error}`;
  return `${fallback}: ${JSON.stringify(payload).slice(0, 500)}`;
}

function extensionFor(mediaType: string) {
  return mediaType.includes("webm") ? "webm" : "mp4";
}

/**
 * Re-marks every scene, keeping any clip that is already rendered.
 *
 * Blanking `videoUrl` here is how a re-claimed chained job used to pay for its
 * whole chain a second time: claiming marks every scene "generating", and a
 * renderer that resumes has to be able to see what is already in the bucket.
 * `videoUrl` is an override for the finished-job case, where every scene points
 * at the one saved file.
 */
function markScenes(
  scenes: ClaritiVideoScene[] | null | undefined,
  status: ClaritiVideoScene["status"],
  videoUrl?: string,
  error?: string,
) {
  return (scenes ?? []).map((scene) => ({ ...scene, status, videoUrl: videoUrl ?? scene.videoUrl, error }));
}

function publicJob(job: VideoJobRecord) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    provider: job.provider,
    model: job.model,
    durationSeconds: job.duration_seconds,
    pipeline: job.pipeline,
    scenes: job.scenes,
    videoUrl: job.video_url,
    error: formatHumanVideoError(job.error_message),
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
  };
}

/** Whether this row already holds clips somebody has been billed for. */
function hasRenderedWork(job: VideoJobRecord) {
  return (job.scenes ?? []).some((scene) => Boolean(scene.videoUrl));
}

function isStaleJob(job: VideoJobRecord) {
  const updatedAt = new Date(job.updated_at).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt > 8 * 60 * 1000;
}
