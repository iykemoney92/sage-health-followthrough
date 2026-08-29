import { experimental_generateVideo as generateVideo } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildHumanPresenterPrompt, claritiVideoAnalysisSchema, formatHumanVideoError, normalizeHumanVideoDuration, type ClaritiVideoAnalysis, type ClaritiVideoScene } from "@/lib/ai/clariti-video";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = formatHumanVideoError(error);
    const { data } = await supabase
      .from("clariti_video_generations")
      .update({
        status: "failed",
        progress: Math.max(job.progress ?? 0, 20),
        error_message: message,
        provider_response: {
          rawError: rawMessage.slice(0, 1200),
        },
        scenes: markScenes(job.scenes, "failed", undefined, message),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single();

    return (data as VideoJobRecord | null) ?? { ...job, status: "failed", error_message: message };
  }
}

async function generateSinglePresenterVideo(job: VideoJobRecord, analysis: ClaritiVideoAnalysis) {
  const durationSeconds = normalizeHumanVideoDuration(job.duration_seconds);
  const { video, warnings } = await generateVideo({
    model: job.model,
    prompt: buildHumanPresenterPrompt(analysis, durationSeconds),
    aspectRatio: "16:9",
    resolution: "1280x720",
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
  if (job.pipeline !== "ai-video-scenes-shotstack" || !process.env.SHOTSTACK_API_KEY) {
    return generateSinglePresenterVideo(job, analysis);
  }

  return generateScenesAndStitch(job);
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
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error("SHOTSTACK_API_KEY is required for scene stitching.");
  const baseUrl = (process.env.SHOTSTACK_BASE_URL ?? "https://api.shotstack.io/edit/v1").replace(/\/$/, "");
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

function markScenes(
  scenes: ClaritiVideoScene[] | null | undefined,
  status: ClaritiVideoScene["status"],
  videoUrl?: string,
  error?: string,
) {
  return (scenes ?? []).map((scene) => ({ ...scene, status, videoUrl, error }));
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

function isStaleJob(job: VideoJobRecord) {
  const updatedAt = new Date(job.updated_at).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt > 8 * 60 * 1000;
}
