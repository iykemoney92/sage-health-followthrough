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

  if (job.status !== "queued" && !isStaleJob(job)) {
    return NextResponse.json({ ok: true, job: publicJob(job) });
  }

  const processed = await processJob(job);
  return NextResponse.json({ ok: true, job: publicJob(processed) });
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

    const completedScenes = rendered.scenes ?? markScenes(job.scenes, "completed", rendered.videoUrl);
    const { data, error } = await supabase
      .from("clariti_video_generations")
      .update({
        status: "completed",
        progress: 100,
        scenes: completedScenes,
        video_url: rendered.videoUrl,
        provider_response: rendered.providerResponse,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Could not save completed video job.");
    return data as VideoJobRecord;
  } catch (error) {
    const message = formatHumanVideoError(error);
    const { data } = await supabase
      .from("clariti_video_generations")
      .update({
        status: "failed",
        progress: Math.max(job.progress ?? 0, 20),
        error_message: message,
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

  const videoUrl = await uploadVideo(`${job.owner_id}/${job.id}.${extensionFor(video.mediaType)}`, video.base64, video.mediaType);
  return {
    videoUrl,
    providerResponse: { warnings, mediaType: video.mediaType, pipeline: "single-render" },
  };
}

async function renderExplainerVideo(job: VideoJobRecord, analysis: ClaritiVideoAnalysis): Promise<RenderedVideoResult> {
  if (job.pipeline !== "ai-video-scenes-shotstack" || !process.env.SHOTSTACK_API_KEY) {
    return generateSinglePresenterVideo(job, analysis);
  }

  try {
    return await generateScenesAndStitch(job);
  } catch (error) {
    const shotstackError = error instanceof Error ? error.message : "Shotstack stitching failed.";
    await updateJob(job.id, {
      status: "generating_scenes",
      progress: 88,
      provider_response: {
        shotstackError,
        fallback: "single-render",
      },
    });
    const rendered = await generateSinglePresenterVideo(job, analysis);
    return {
      ...rendered,
      providerResponse: {
        ...rendered.providerResponse,
        shotstackError,
        fallback: "single-render",
      },
    };
  }
}

async function generateScenesAndStitch(job: VideoJobRecord): Promise<RenderedVideoResult> {
  const completedScenes: ClaritiVideoScene[] = [];
  for (const scene of job.scenes ?? []) {
    await updateJob(job.id, {
      progress: 20 + Math.round((scene.sceneIndex / Math.max(job.scenes.length, 1)) * 55),
      scenes: [...completedScenes, { ...scene, status: "generating" }, ...job.scenes.slice(scene.sceneIndex + 1)],
    });

    const { video, warnings } = await generateVideo({
      model: job.model,
      prompt: scene.prompt,
      aspectRatio: "16:9",
      resolution: "1280x720",
      duration: Math.min(scene.durationSeconds, 8),
      generateAudio: true,
    });
    const scenePath = `${job.owner_id}/${job.id}/scene-${scene.sceneIndex}.${extensionFor(video.mediaType)}`;
    const sceneUrl = await uploadVideo(scenePath, video.base64, video.mediaType);
    completedScenes.push({ ...scene, status: "completed", videoUrl: sceneUrl });

    await updateJob(job.id, {
      progress: 25 + Math.round(((scene.sceneIndex + 1) / Math.max(job.scenes.length, 1)) * 50),
      scenes: [...completedScenes, ...job.scenes.slice(scene.sceneIndex + 1)],
      provider_response: { lastSceneWarnings: warnings },
    });
  }

  await updateJob(job.id, { status: "stitching", progress: 82, scenes: completedScenes });
  const stitchedUrl = await stitchWithShotstack(job.id, completedScenes);
  const storedUrl = await copyRemoteVideoToStorage(stitchedUrl, `${job.owner_id}/${job.id}.mp4`);
  return {
    videoUrl: storedUrl,
    scenes: completedScenes,
    providerResponse: { pipeline: "scene-render-shotstack", sceneCount: completedScenes.length, shotstackUrl: stitchedUrl },
  };
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const supabase = await getSupabaseSessionClient();
  await supabase
    .from("clariti_video_generations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function uploadVideo(path: string, base64: string, mediaType: string) {
  const supabase = await getSupabaseSessionClient();
  const buffer = Buffer.from(base64, "base64");
  const { error } = await supabase.storage
    .from("clariti-videos")
    .upload(path, buffer, { contentType: mediaType, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("clariti-videos").getPublicUrl(path);
  return data.publicUrl;
}

async function copyRemoteVideoToStorage(remoteUrl: string, path: string) {
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Could not download Shotstack render: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.storage
    .from("clariti-videos")
    .upload(path, buffer, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("clariti-videos").getPublicUrl(path);
  return data.publicUrl;
}

async function stitchWithShotstack(jobId: string, scenes: ClaritiVideoScene[]) {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error("SHOTSTACK_API_KEY is required for scene stitching.");
  const baseUrl = (process.env.SHOTSTACK_BASE_URL ?? "https://api.shotstack.io/edit/v1").replace(/\/$/, "");
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

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 10000 : 5000));
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
  return Date.now() - updatedAt > 3 * 60 * 1000;
}
