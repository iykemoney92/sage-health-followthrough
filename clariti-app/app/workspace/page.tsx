"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileDown,
  FileHeart,
  FileText,
  Flag,
  FlaskConical,
  FolderOpen,
  History,
  Hospital,
  Image as ImageIcon,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Pill,
  Play,
  Plus,
  RefreshCw,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { claritiAnalysisSchema, type ClaritiAnalysis, type ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { formatHumanVideoError } from "@/lib/ai/clariti-video";
import { getClaritiKindMeta, inferKindFromTitleText, isClaritiAnalysisKind } from "@/lib/domain/clariti-document-kinds";
import type { ProgressionComparison } from "@/lib/domain/clariti-progression";
import { trendToSeverityToken } from "@/lib/domain/clariti-severity";
import { track } from "@/lib/analytics";
import { FlagCard } from "@/components/clariti/flag-card";
import { MetricChip } from "@/components/clariti/metric-chip";
import { KeyPointList } from "@/components/clariti/key-point-list";
import { AnalysisTeaserCard } from "@/components/clariti/analysis-teaser-card";
import { buildFallbackAnalysis, inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";

type Drawer = "chats" | "documents" | "history";
type CanvasTab = "summary" | "detail" | "actions";
type Sheet = "followup" | "source" | null;
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
  attachment?: {
    name: string;
    previewUrl?: string | null;
    label?: string;
  };
};
type GeneratedVideo = {
  url: string;
  createdAt: number;
  jobId?: string;
};
type GeneratedIllustration = {
  url: string;
  sceneIndex: number;
  createdAt: number;
  sourceAnchor?: string | null;
};
type ChatTimelineItem =
  | { type: "message"; id: string; sortAt: number; message: ChatMessage; messageIndex: number }
  | { type: "video"; id: string; sortAt: number; video: GeneratedVideo }
  | { type: "comparison"; id: string; sortAt: number; comparison: ProgressionComparison };
type FollowUpDraft = {
  action: string;
  email?: string;
  timingText?: string;
};
function isPlusRequiredPayload(payload: unknown): payload is { error: "plus_required"; message?: string; upgradeUrl?: string } {
  return Boolean(payload) && typeof payload === "object" && (payload as { error?: unknown }).error === "plus_required";
}

type ClaritiRequest = {
  kind: ClaritiAnalysisKind;
  question: string;
  documentText: string;
  fileName?: string;
  documentId?: string;
  requestId?: string;
  createdAt?: number;
  status?: "pending" | "analyzing" | "done";
  analysis?: ClaritiAnalysis;
  persisted?: unknown;
};
type WorkspaceSession = {
  id: string;
  kind: ClaritiAnalysisKind;
  dbSessionId?: string;
  title: string;
  meta: string;
  preview: string;
  tag: string;
  fileName: string;
};
type RecentWorkspaceSession = {
  id: string;
  kind: ClaritiAnalysisKind;
  title: string;
  meta: string;
  preview: string;
  fileName: string;
  pending?: boolean;
  request?: ClaritiRequest;
  parentId?: string | null;
  createdAt?: number;
};
type DbWorkspaceSession = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  documents: Array<{
    id: string;
    file_name: string;
    kind: string;
    status: string;
    extracted_text?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    title: string;
    summary: string;
    payload: unknown;
    created_at: string;
  }>;
};

const STORAGE_KEY = "clariti-active-request";
const BOOT_LOCK_KEY = "clariti-boot-lock";
const ACTIVE_SESSION_KEY = "clariti-active-session-id";
let localMessageCounter = 0;
let localTimestampCounter = 0;

function createLocalId(prefix: string) {
  localMessageCounter += 1;
  return `${prefix}-${localMessageCounter}`;
}

function createLocalTimestamp() {
  localTimestampCounter += 1;
  return Date.now() + localTimestampCounter;
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceContent />
    </Suspense>
  );
}

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState<ClaritiAnalysisKind>("medical_bill");
  const [activeRequest, setActiveRequest] = useState<ClaritiRequest | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentWorkspaceSession[]>([]);
  const [pendingSessions, setPendingSessions] = useState<RecentWorkspaceSession[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("summary");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<ClaritiAnalysis | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpText, setFollowUpText] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoScene, setVideoScene] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedIllustrations, setGeneratedIllustrations] = useState<Record<number, GeneratedIllustration>>({});
  const [expandedIllustration, setExpandedIllustration] = useState<GeneratedIllustration | null>(null);
  const [illustrationGenerating, setIllustrationGenerating] = useState(false);
  const [illustrationError, setIllustrationError] = useState<string | null>(null);
  const [followAction, setFollowAction] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpDraft | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [compareAvailable, setCompareAvailable] = useState(false);
  const [comparisonCards, setComparisonCards] = useState<Array<{ id: string; createdAt: number; comparison: ProgressionComparison }>>([]);
  const [replacingDocument, setReplacingDocument] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    name: string;
    previewUrl: string | null;
  } | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentUrlRef = useRef<string | null>(null);
  const activeRequestRef = useRef<ClaritiRequest | null>(null);
  const dbSessionIdRef = useRef<string | null>(null);
  const analyzeInFlightRef = useRef<string | null>(null);
  const bootHandledRef = useRef<string | null>(null);
  const videoGeneratingRef = useRef(false);
  const handleVideoGeneratedRef = useRef<((url: string, jobId?: string, createdAt?: number) => void) | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = useMemo(() => activeRequest ? toWorkspaceSession(activeRequest) : null, [activeRequest]);
  const sidebarSessions = useMemo(() => {
    const combined = [
      ...pendingSessions,
      ...recentSessions.filter((recent) => !pendingSessions.some((pending) => pending.id === recent.id)),
    ];
    if (!session) return combined;
    const activeId = dbSessionId ?? session.id;
    const alreadyIncluded = combined.some((item) => item.id === activeId);
    return alreadyIncluded ? combined : [{ ...session, id: activeId }, ...combined];
  }, [dbSessionId, pendingSessions, recentSessions, session]);
  const activeSidebarId = dbSessionId ?? session?.id ?? null;
  const sidebarGroups = useMemo(
    () => groupSidebarSessions(sidebarSessions, activeSidebarId),
    [sidebarSessions, activeSidebarId],
  );
  const analysis = useMemo(() => {
    if (activeAnalysis) return activeAnalysis;
    if (!activeRequest || loading || booting) return null;
    return buildFallbackAnalysis({
      kind: activeRequest.kind,
      question: activeRequest.question,
      documentText: activeRequest.documentText,
    });
  }, [activeAnalysis, activeRequest, booting, loading]);
  const artifact = useMemo(() => analysis ? toArtifactMeta(analysis) : null, [analysis]);
  const analysisPending = loading && !activeAnalysis;
  const chatTimeline = useMemo<ChatTimelineItem[]>(() => {
    const messageItems = chatMessages.map((message, index) => ({
      type: "message" as const,
      id: message.id,
      sortAt: message.createdAt ?? index,
      message,
      messageIndex: index,
    }));
    const videoItems = generatedVideo
      ? [{
        type: "video" as const,
        id: generatedVideo.jobId ?? `generated-video-${generatedVideo.createdAt}`,
        sortAt: generatedVideo.createdAt,
        video: generatedVideo,
      }]
      : [];
    const latestMessageAt = messageItems.reduce((max, item) => Math.max(max, item.sortAt), 0);
    const comparisonItems = comparisonCards.map((card, index) => ({
      type: "comparison" as const,
      id: card.id,
      // Always keep progression cards after the related chat bubbles.
      sortAt: Math.max(card.createdAt, latestMessageAt + 1 + index),
      comparison: card.comparison,
    }));
    return [...messageItems, ...videoItems, ...comparisonItems].sort((a, b) => {
      if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt;
      // Stable preference: messages → videos → comparison cards
      const rank = { message: 0, video: 1, comparison: 2 } as const;
      return rank[a.type] - rank[b.type];
    });
  }, [chatMessages, comparisonCards, generatedVideo]);

  useEffect(() => {
    activeRequestRef.current = activeRequest;
  }, [activeRequest]);

  useEffect(() => {
    dbSessionIdRef.current = dbSessionId;
  }, [dbSessionId]);

  useEffect(() => {
    return () => {
      if (pendingAttachmentUrlRef.current) {
        URL.revokeObjectURL(pendingAttachmentUrlRef.current);
        pendingAttachmentUrlRef.current = null;
      }
    };
  }, []);

  const clearPendingAttachment = useCallback(() => {
    if (pendingAttachmentUrlRef.current) {
      URL.revokeObjectURL(pendingAttachmentUrlRef.current);
      pendingAttachmentUrlRef.current = null;
    }
    setPendingAttachment(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  }, []);

  const stageChatAttachment = useCallback((file: File) => {
    if (pendingAttachmentUrlRef.current) {
      URL.revokeObjectURL(pendingAttachmentUrlRef.current);
      pendingAttachmentUrlRef.current = null;
    }
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    pendingAttachmentUrlRef.current = previewUrl;
    setPendingAttachment({ file, name: file.name, previewUrl });
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  }, []);

  const injectComposerPrompt = useCallback((prompt: string) => {
    setFollowUpText(prompt);
    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;
      if (!input) return;
      input.focus();
      const cursor = prompt.length;
      input.setSelectionRange(cursor, cursor);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!alive) return;
        const email = typeof payload?.user?.email === "string" ? payload.user.email.trim().toLowerCase() : null;
        setAccountEmail(email);
      })
      .catch(() => {
        if (alive) setAccountEmail(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const redirectToUpgrade = useCallback((message?: string) => {
    showToast(message ?? "That is a Clariti Plus feature.");
    track("plus_upgrade_redirect", { source: "workspace" });
    window.setTimeout(() => router.push("/billing"), 900);
  }, [router, showToast]);

  const resetVideoState = useCallback(() => {
    videoGeneratingRef.current = false;
    setGeneratedVideo(null);
    setVideoGenerating(false);
    setVideoStatus(null);
    setVideoProgress(0);
    setVideoError(null);
    setVideoScene(0);
    setGeneratedIllustrations({});
    setExpandedIllustration(null);
    setIllustrationGenerating(false);
    setIllustrationError(null);
  }, []);

  const hydrateGeneratedVideo = useCallback(async (sessionId: string) => {
    const payload = await fetchLatestVideoJob(sessionId).catch(() => null);
    if (dbSessionIdRef.current !== sessionId) return;
    if (!payload) {
      resetVideoState();
      return;
    }

    const job = payload.job;
    const completedJob = payload.completedJob ?? (job?.status === "completed" && job.videoUrl ? job : null);

    if (completedJob?.videoUrl) {
      setVideoStatus("completed");
      setVideoProgress(100);
      setVideoError(null);
      setGeneratedVideo((current) => current?.jobId === completedJob.id
        ? current
        : { url: completedJob.videoUrl!, jobId: completedJob.id, createdAt: videoJobCreatedAt(completedJob) });
    } else {
      setGeneratedVideo(null);
    }

    if (!job) {
      if (!completedJob) resetVideoState();
      return;
    }

    const inFlight = ["queued", "scripting", "generating_scenes", "stitching"].includes(job.status);
    setVideoStatus(job.status);
    setVideoProgress(job.progress ?? 0);
    setVideoError(job.status === "failed" ? formatHumanVideoError(job.error ?? "The video job failed.") : null);

    if (inFlight && !videoGeneratingRef.current) {
      videoGeneratingRef.current = true;
      setVideoGenerating(true);
      void pollSceneVideoJob(job.id, (status, progress) => {
        if (dbSessionIdRef.current !== sessionId) return;
        setVideoStatus(status);
        setVideoProgress(progress);
      })
        .then((completed) => {
          if (dbSessionIdRef.current !== sessionId) return;
          if (!completed.videoUrl) throw new Error("The video job completed without a video URL.");
          handleVideoGeneratedRef.current?.(completed.videoUrl, completed.id, videoJobCreatedAt(completed));
        })
        .catch((error) => {
          if (dbSessionIdRef.current !== sessionId) return;
          const message = formatHumanVideoError(error);
          setVideoError(message);
          showToast(message);
        })
        .finally(() => {
          videoGeneratingRef.current = false;
          if (dbSessionIdRef.current === sessionId) setVideoGenerating(false);
        });
    }
  }, [resetVideoState, showToast]);

  const analyzeRequest = useCallback(async (request: ClaritiRequest) => {
    const fingerprint = requestFingerprint(request);
    if (analyzeInFlightRef.current === fingerprint) return;
    analyzeInFlightRef.current = fingerprint;

    setLoading(true);
    const pendingKey = pendingSessionKey(request);
    setPendingSessions((current) => {
      const pendingSession = toPendingWorkspaceSession(request);
      return current.some((item) => item.id === pendingSession.id) ? current : [pendingSession, ...current];
    });
    const requestDocumentId = request.documentId ?? null;
    const requestFileName = request.fileName ?? null;
    const stillCurrentRequest = (current: ClaritiRequest | null) => {
      if (!current) return false;
      return current.kind === request.kind &&
        (requestDocumentId ? current.documentId === requestDocumentId : current.fileName === requestFileName);
    };

    writeStoredRequest({ ...request, status: "analyzing" });
    try {
      window.sessionStorage.setItem(BOOT_LOCK_KEY, fingerprint);
      window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // ignore sessionStorage failures
    }

    try {
      const documentText = request.documentText.trim();
      if (!documentText) throw new Error("Missing document text");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90000);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...request, documentText }),
      });
      window.clearTimeout(timeout);
      const payload = await response.json();
      if (response.status === 402 && isPlusRequiredPayload(payload)) {
        setPendingSessions((current) => current.filter((item) => item.id !== pendingKey));
        if (stillCurrentRequest(activeRequestRef.current)) {
          redirectToUpgrade(payload.message);
          setLoading(false);
        }
        return;
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Analysis failed");
      const analysis = payload.analysis as ClaritiAnalysis;
      const savedSessionId = payload.persisted?.session?.id as string | undefined;
      track("analysis_completed", { kind: analysis.kind, reused: Boolean(payload.reused) });
      setPendingSessions((current) => current.filter((item) => item.id !== pendingKey));
      if (savedSessionId) {
        setRecentSessions((current) => {
          const saved = toRecentWorkspaceSessionFromAnalysis(request, analysis, payload.persisted);
          return [saved, ...current.filter((item) => item.id !== saved.id)];
        });
      }
      if (!stillCurrentRequest(activeRequestRef.current)) {
        showToast("Clariti finished that analysis. It is now in Recent chats.");
        return;
      }
      setActiveAnalysis(analysis);
      setActiveRequest((current) => current ? { ...current, analysis, persisted: payload.persisted, status: "done" } : current);
      clearStoredRequest();
      if (savedSessionId) {
        dbSessionIdRef.current = savedSessionId;
        setDbSessionId(savedSessionId);
        try {
          window.sessionStorage.setItem(ACTIVE_SESSION_KEY, savedSessionId);
          window.sessionStorage.setItem(BOOT_LOCK_KEY, fingerprint);
        } catch {
          // ignore
        }
        bootHandledRef.current = `session:${savedSessionId}`;
        window.history.replaceState(null, "", `/workspace?sessionId=${savedSessionId}`);
      }
      setChatMessages((current) => current.some((message) => message.role === "assistant")
        ? current
        : [...current, { id: createLocalId("analysis-assistant"), role: "assistant", content: buildInitialAnalysisReply(analysis), createdAt: createLocalTimestamp() }]);
      showToast(payload.reused ? "Clariti restored your existing analysis." : "Clariti generated a source-grounded analysis.");
    } catch {
      const fallbackAnalysis = buildFallbackAnalysis({ ...request, documentText: request.documentText });
      // Persist the fallback so video/illustration can attach to a real session.
      let persistedSessionId: string | undefined;
      try {
        const persistResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...request,
            documentText: request.documentText,
            persistOnly: true,
            analysis: fallbackAnalysis,
          }),
        });
        const persistPayload = await persistResponse.json().catch(() => null);
        if (persistResponse.ok && persistPayload?.ok) {
          persistedSessionId = persistPayload.persisted?.session?.id as string | undefined;
        }
      } catch {
        // Ignore persist failures; analysis UI can still show local fallback.
      }
      setPendingSessions((current) => current.filter((item) => item.id !== pendingKey));
      if (!stillCurrentRequest(activeRequestRef.current)) {
        showToast("Clariti could not finish that background analysis. Please try again from Home.");
        return;
      }
      setActiveAnalysis(fallbackAnalysis);
      setActiveRequest((current) => current ? { ...current, analysis: fallbackAnalysis, status: "done" } : current);
      if (persistedSessionId) {
        clearStoredRequest();
        dbSessionIdRef.current = persistedSessionId;
        setDbSessionId(persistedSessionId);
        try {
          window.sessionStorage.setItem(ACTIVE_SESSION_KEY, persistedSessionId);
          window.sessionStorage.setItem(BOOT_LOCK_KEY, fingerprint);
        } catch {
          // ignore
        }
        bootHandledRef.current = `session:${persistedSessionId}`;
        window.history.replaceState(null, "", `/workspace?sessionId=${persistedSessionId}`);
      } else {
        writeStoredRequest({ ...request, analysis: fallbackAnalysis, status: "done" });
      }
      setChatMessages((current) => current.some((message) => message.role === "assistant")
        ? current
        : [...current, { id: createLocalId("fallback-assistant"), role: "assistant", content: buildInitialAnalysisReply(fallbackAnalysis), createdAt: createLocalTimestamp() }]);
      showToast(persistedSessionId
        ? "Clariti saved a quick local analysis while the full AI pass finishes."
        : "Using a quick local analysis for now — try again if you need the full AI pass.");
    } finally {
      if (analyzeInFlightRef.current === fingerprint) analyzeInFlightRef.current = null;
      if (stillCurrentRequest(activeRequestRef.current)) setLoading(false);
    }
  }, [redirectToUpgrade, showToast]);

  useEffect(() => {
    let alive = true;

    async function hydrateFromDbSession(sessionPayload: DbWorkspaceSession) {
      const dbRequest = requestFromDbSession(sessionPayload);
      if (!dbRequest || !alive) return false;
      dbSessionIdRef.current = sessionPayload.id;
      setDbSessionId(sessionPayload.id);
      activeRequestRef.current = dbRequest;
      setActiveRequest(dbRequest);
      setActive(dbRequest.kind);
      setCanvasTab("summary");
      setChatMessages(messagesFromDbSession(sessionPayload));
      void hydrateGeneratedVideo(sessionPayload.id);
      setActiveAnalysis(dbRequest.analysis ?? null);
      setLoading(false);
      try {
        window.sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionPayload.id);
      } catch {
        // ignore
      }
      bootHandledRef.current = `session:${sessionPayload.id}`;
      if (typeof window !== "undefined" && !window.location.search.includes(`sessionId=${sessionPayload.id}`)) {
        window.history.replaceState(null, "", `/workspace?sessionId=${sessionPayload.id}`);
      }
      clearStoredRequest();
      return true;
    }

    async function loadWorkspace() {
      const requestedSessionId = searchParams.get("sessionId");
      const isNewRequest = searchParams.get("new") === "1";
      const pendingRequest = parseStoredRequest(window.localStorage.getItem(STORAGE_KEY));
      const fingerprint = pendingRequest ? requestFingerprint(pendingRequest) : null;
      let bootLock: string | null = null;
      let lockedSessionId: string | null = null;
      try {
        bootLock = window.sessionStorage.getItem(BOOT_LOCK_KEY);
        lockedSessionId = window.sessionStorage.getItem(ACTIVE_SESSION_KEY);
      } catch {
        // ignore
      }

      const bootKey = requestedSessionId
        ? `session:${requestedSessionId}`
        : isNewRequest && fingerprint
          ? `new:${fingerprint}`
          : fingerprint && bootLock === fingerprint
            ? `pending:${fingerprint}`
            : `default:${requestedSessionId ?? "latest"}`;

      // Skip destructive reboot when the same boot intent is already handled
      // (e.g. URL cleanup after claiming ?new=1, or analyze finishing with replaceState).
      if (bootHandledRef.current === bootKey && !isNewRequest) {
        return;
      }
      if (
        !requestedSessionId &&
        fingerprint &&
        bootHandledRef.current === `new:${fingerprint}` &&
        analyzeInFlightRef.current === fingerprint
      ) {
        return;
      }

      setBooting(true);
      if (alive) setLoadError(null);
      resetVideoState();

      try {
        const listResponse = await fetch("/api/sessions", { cache: "no-store" });
        const listPayload = listResponse.ok ? await listResponse.json() : null;
        const accountSessions = listPayload?.ok ? listPayload.sessions?.map(toRecentWorkspaceSession) ?? [] : [];
        if (alive) setRecentSessions(accountSessions);

        if (requestedSessionId) {
          if (bootHandledRef.current === `session:${requestedSessionId}` && dbSessionIdRef.current === requestedSessionId) {
            return;
          }
          // A specific saved session was requested (e.g. a reload of /workspace?sessionId=...).
          // Retry once before giving up — the very first fetch right after a hard reload can
          // race the auth cookie and come back unauthorized even for a valid, owned session.
          let payload: { ok?: boolean; session?: DbWorkspaceSession; error?: string } | null = null;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(requestedSessionId)}`, { cache: "no-store" });
            if (response.ok) {
              payload = await response.json().catch(() => null);
              if (payload?.ok) break;
            } else if (response.status !== 401 && response.status !== 404) {
              // Non-auth, non-missing failures (5xx, network hiccups) are also worth one retry.
            } else if (response.status === 404) {
              payload = { ok: false, error: "not_found" };
              break;
            }
            if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
          }

          if (payload?.ok && payload.session && alive) {
            await hydrateFromDbSession(payload.session as DbWorkspaceSession);
            return;
          }

          // Do not fall through to "most recent session" or a blank state — that silently
          // swaps in the wrong report or hides a saved one. Surface a real error instead.
          if (alive) {
            setLoadError(
              payload?.error === "not_found"
                ? "This saved report could not be found. It may have been deleted."
                : "Could not load this saved report. Check your connection and try again.",
            );
          }
          return;
        }

        // Prefer restoring a session already locked for this pending request.
        if (!requestedSessionId && fingerprint && bootLock === fingerprint && lockedSessionId) {
          const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(lockedSessionId)}`);
          const payload = response.ok ? await response.json() : null;
          if (payload?.ok && payload.session && alive) {
            await hydrateFromDbSession(payload.session as DbWorkspaceSession);
            return;
          }
        }

        // Pending new analysis path (?new=1 or fresh localStorage request).
        if (!requestedSessionId && pendingRequest && (isNewRequest || isFreshPendingRequest(pendingRequest) || bootLock === fingerprint)) {
          // Consume ?new=1 immediately so a reload of the same URL can't look like a fresh submit.
          if (isNewRequest) {
            window.history.replaceState(null, "", "/workspace");
          }

          if (alive) {
            activeRequestRef.current = pendingRequest;
            setActiveRequest(pendingRequest);
            setActive(pendingRequest.kind);
            setCanvasTab("summary");
            setChatMessages(messagesFromRequest(pendingRequest));
          }

          if (pendingRequest.analysis) {
            if (alive) {
              setActiveAnalysis(pendingRequest.analysis);
              setLoading(false);
            }
            const existingSessionId = getPersistedSessionId(pendingRequest) ?? lockedSessionId;
            if (existingSessionId) {
              bootHandledRef.current = `session:${existingSessionId}`;
              dbSessionIdRef.current = existingSessionId;
              setDbSessionId(existingSessionId);
              window.history.replaceState(null, "", `/workspace?sessionId=${existingSessionId}`);
              clearStoredRequest();
            } else {
              bootHandledRef.current = fingerprint ? `new:${fingerprint}` : bootKey;
            }
            return;
          }

          // If this document already has a saved session, restore it instead of regenerating.
          if (pendingRequest.documentId) {
            const byDocResponse = await fetch(`/api/sessions?documentId=${encodeURIComponent(pendingRequest.documentId)}`);
            const byDocPayload = byDocResponse.ok ? await byDocResponse.json() : null;
            if (byDocPayload?.ok && byDocPayload.session && alive) {
              await hydrateFromDbSession(byDocPayload.session as DbWorkspaceSession);
              return;
            }
          }

          bootHandledRef.current = fingerprint ? `new:${fingerprint}` : bootKey;
          if (fingerprint && analyzeInFlightRef.current === fingerprint) {
            if (alive) setLoading(true);
            return;
          }

          // Claim once per request fingerprint for this tab.
          if (fingerprint) {
            try {
              window.sessionStorage.setItem(BOOT_LOCK_KEY, fingerprint);
            } catch {
              // ignore
            }
          }

          if (alive) {
            setActiveAnalysis(null);
            setLoading(true);
            void analyzeRequest({ ...pendingRequest, status: "analyzing" });
          }
          return;
        }

        // Default: open the most recent account session.
        const resolvedSessionId = listPayload?.ok ? listPayload.sessions?.[0]?.id ?? null : null;
        if (resolvedSessionId) {
          const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(resolvedSessionId)}`);
          const payload = response.ok ? await response.json() : null;
          if (payload?.ok && payload.session && alive) {
            await hydrateFromDbSession(payload.session as DbWorkspaceSession);
            return;
          }
        }

        // Stale pending request with analysis only — show it, never re-run LLM blindly.
        if (pendingRequest && alive) {
          activeRequestRef.current = pendingRequest;
          setActiveRequest(pendingRequest);
          setActive(pendingRequest.kind);
          setCanvasTab("summary");
          setChatMessages(messagesFromRequest(pendingRequest));
          setActiveAnalysis(pendingRequest.analysis ?? null);
          setLoading(false);
          bootHandledRef.current = fingerprint ? `pending:${fingerprint}` : "empty";
        } else if (alive) {
          setActiveRequest(null);
          setActiveAnalysis(null);
          setChatMessages([]);
          setDbSessionId(null);
          dbSessionIdRef.current = null;
          bootHandledRef.current = "empty";
        }
      } finally {
        if (alive) setBooting(false);
      }
    }

    window.localStorage.removeItem("clariti-demo-request");
    void loadWorkspace();

    return () => {
      alive = false;
    };
  }, [analyzeRequest, hydrateGeneratedVideo, resetVideoState, searchParams]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [active, analysis, chatMessages, generatedVideo, loading, sendingFollowUp]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (generatedVideo?.url.startsWith("blob:")) URL.revokeObjectURL(generatedVideo.url);
    };
  }, [generatedVideo?.url]);

  const selectSession = (item: RecentWorkspaceSession | WorkspaceSession) => {
    setComparisonCards([]);
    if ("pending" in item && item.pending && item.request) {
      dbSessionIdRef.current = null;
      setDbSessionId(null);
      activeRequestRef.current = item.request;
      setActiveRequest(item.request);
      setActive(item.kind);
      setActiveAnalysis(item.request.analysis ?? null);
      setChatMessages(messagesFromRequest(item.request));
      resetVideoState();
      setLoading(!item.request.analysis);
      setCanvasTab("summary");
      setDrawer(null);
      setCanvasOpen(false);
      return;
    }
    if (item.id !== dbSessionId) {
      bootHandledRef.current = null;
      router.push(`/workspace?sessionId=${encodeURIComponent(item.id)}`);
    }
    setActive(item.kind);
    setCanvasTab("summary");
    setDrawer(null);
    setCanvasOpen(false);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openSheet = (nextSheet: Sheet) => {
    setToast(null);
    setSheet(nextSheet);
  };

  const handleVideoGenerated = (url: string, jobId?: string, createdAt = createLocalTimestamp()) => {
    setGeneratedVideo((current) => {
      if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url);
      return { url, jobId, createdAt };
    });
    setVideoStatus("completed");
    setVideoProgress(100);
    setVideoError(null);
    setCanvasOpen(false);
    showToast("Video explanation saved and added to the chat.");
    track("video_generated", { kind: activeRequestRef.current?.kind });
  };

  useEffect(() => {
    handleVideoGeneratedRef.current = handleVideoGenerated;
  });

  const generateHumanVideo = async (durationSeconds: number) => {
    if (!analysis) return;
    let sessionId = dbSessionId;
    if (!sessionId && activeRequest) {
      showToast("Saving this chat first so Clariti can attach the video…");
      try {
        const persistResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...activeRequest,
            documentText: activeRequest.documentText,
            persistOnly: true,
            analysis,
          }),
        });
        const persistPayload = await persistResponse.json().catch(() => null);
        sessionId = (persistPayload?.persisted?.session?.id as string | undefined) ?? null;
        if (sessionId) {
          dbSessionIdRef.current = sessionId;
          setDbSessionId(sessionId);
          window.history.replaceState(null, "", `/workspace?sessionId=${sessionId}`);
        }
      } catch {
        // fall through to explicit error below
      }
    }
    if (!sessionId) {
      const message = "This chat isn’t saved yet. Wait for Clariti to finish analyzing, then try Generate again.";
      setVideoError(message);
      showToast(message);
      return;
    }
    if (videoGeneratingRef.current) return;
    videoGeneratingRef.current = true;
    setVideoGenerating(true);
    setVideoError(null);
    setVideoStatus("queued");
    setVideoProgress(5);
    setCanvasOpen(false);
    try {
      const job = await createSceneVideoJob(analysis, durationSeconds, sessionId);
      setVideoStatus(job.status);
      setVideoProgress(job.progress ?? 5);
      const completed = await pollSceneVideoJob(job.id, (status, progress) => {
        setVideoStatus(status);
        setVideoProgress(progress);
      });
      if (!completed.videoUrl) throw new Error("The video job completed without a video URL.");
      handleVideoGenerated(completed.videoUrl, completed.id, videoJobCreatedAt(completed));
    } catch (error) {
      if (error instanceof Error && "plusRequired" in error) {
        setCanvasOpen(false);
        redirectToUpgrade(error.message);
      } else {
        const message = formatHumanVideoError(error);
        setVideoError(message);
        showToast(message);
      }
    } finally {
      videoGeneratingRef.current = false;
      setVideoGenerating(false);
    }
  };

  const generateIllustration = async (sceneIndex: number) => {
    if (!analysis) return;
    setVideoScene(sceneIndex);
    setIllustrationGenerating(true);
    setIllustrationError(null);
    try {
      const illustration = await createIllustration(analysis, sceneIndex, dbSessionId);
      setGeneratedIllustrations((current) => ({
        ...current,
        [sceneIndex]: {
          ...illustration,
          createdAt: createLocalTimestamp(),
        },
      }));
      showToast("Illustration generated for this scene.");
      track("illustration_generated", { kind: analysis.kind });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clariti could not generate the illustration.";
      setIllustrationError(message);
      showToast(message);
    } finally {
      setIllustrationGenerating(false);
    }
  };

  const sendMessageToAgent = async (
    content: string,
    options?: {
      clearInput?: boolean;
      toast?: string;
      followUpDraftOverride?: FollowUpDraft;
      skipFollowUpCapture?: boolean;
    },
  ) => {
    if (!content || !analysis) return;

    const sentAt = createLocalTimestamp();
    const userMessage: ChatMessage = { id: createLocalId("local-user"), role: "user", content, createdAt: sentAt };
    let pendingDraft = inferFollowUpDraftFromThread({
      analysis,
      currentDraft: options?.followUpDraftOverride ?? followUpDraft,
      latestContent: content,
      messages: chatMessages,
    });
    if (options?.clearInput ?? true) setFollowUpText("");
    setSendingFollowUp(true);
    setChatMessages((current) => [...current, userMessage]);

    try {
      if (!dbSessionId) throw new Error("Missing saved session");
      if (pendingDraft && !options?.skipFollowUpCapture) {
        const captured = await maybeCaptureFollowUpDetails(content, pendingDraft);
        if (captured === "scheduled") {
          if (options?.toast) showToast(options.toast);
          return;
        }
        if (captured === "captured") {
          pendingDraft = inferFollowUpDraftFromThread({
            analysis,
            currentDraft: pendingDraft,
            latestContent: content,
            messages: [...chatMessages, userMessage],
          });
        }
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: dbSessionId, content, analysis, followUpDraft: pendingDraft }),
      });
      const payload = await response.json();
      if (response.status === 402 && isPlusRequiredPayload(payload)) {
        setChatMessages((current) => current.filter((message) => message.id !== userMessage.id));
        redirectToUpgrade(payload.message);
        return;
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not send message");

      const savedMessages = Array.isArray(payload.messages)
        ? payload.messages.map((message: { id: string; role: string; content: string; created_at?: string }, index: number) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" as const : "user" as const,
          content: message.content,
          createdAt: timestampFromIso(message.created_at) ?? sentAt + index,
        }))
        : [
          userMessage,
          { id: createLocalId("local-assistant"), role: "assistant" as const, content: payload.assistant as string, createdAt: sentAt + 1 },
      ];
      setChatMessages((current) => [...current.filter((message) => message.id !== userMessage.id), ...savedMessages]);
      if (options?.toast) showToast(options.toast);
    } catch {
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-assistant"),
          role: "assistant",
          content: buildLocalFollowUp(content, analysis),
          createdAt: createLocalTimestamp(),
        },
      ]);
      showToast("Follow-up answered locally; it could not be saved.");
    } finally {
      setSendingFollowUp(false);
    }
  };

  const sendFollowUp = async () => {
    const text = followUpText.trim();
    const attachment = pendingAttachment;
    if (attachment) {
      await processAttachedDocument(attachment, text);
      return;
    }
    if (!text) return;
    await sendMessageToAgent(text);
  };

  useEffect(() => {
    let alive = true;

    async function loadCompareAvailability() {
      if (!analysis || !dbSessionId) {
        if (alive) setCompareAvailable(false);
        return;
      }
      const params = new URLSearchParams({ kind: analysis.kind, excludeSessionId: dbSessionId, limit: "1" });
      try {
        const response = await fetch(`/api/documents/history?${params.toString()}`, { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;
        if (alive) setCompareAvailable(Boolean(payload?.ok && payload.history?.length));
      } catch {
        if (alive) setCompareAvailable(false);
      }
    }

    void loadCompareAvailability();
    return () => {
      alive = false;
    };
  }, [analysis, dbSessionId]);

  const processAttachedDocument = async (
    attachment: { file: File; name: string; previewUrl: string | null },
    userMessage: string,
  ) => {
    if (replacingDocument) return;
    const file = attachment.file;
    const previousAnalysis = analysis;
    const previousSessionId = dbSessionId;
    const question = userMessage.trim()
      || (previousAnalysis
        ? `Please explain this newer ${getClaritiKindMeta(previousAnalysis.kind).documentNoun} in plain English and note what changed from my earlier report.`
        : "Please explain this health document in plain English.");

    const uploadedAt = createLocalTimestamp();
    const userMessageId = createLocalId("upload-user");
    const cleanUserText = userMessage.trim();
    // Keep a filename mention for the agent/API; the chat bubble renders a thumbnail chip instead.
    const userContentForAgent = cleanUserText
      ? `${cleanUserText}\n\nAttached: ${file.name}`
      : `Please read this document: ${file.name}`;
    const messagePreviewUrl = attachment.previewUrl;
    if (pendingAttachmentUrlRef.current === messagePreviewUrl) {
      pendingAttachmentUrlRef.current = null;
    }
    clearPendingAttachment();
    setFollowUpText("");
    setReplacingDocument(true);
    setSendingFollowUp(true);

    setChatMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: cleanUserText || "Please review this attached document.",
        createdAt: uploadedAt,
        attachment: {
          name: file.name,
          previewUrl: messagePreviewUrl,
          label: fileTypeLabel(file.name),
        },
      },
    ]);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const extractResponse = await fetch("/api/documents/extract", { method: "POST", body: formData });
      const extractPayload = await extractResponse.json().catch(() => null);
      const extractedText = String(extractPayload?.extractedText ?? extractPayload?.text ?? "");
      if (!extractResponse.ok || !extractPayload?.ok || !extractedText.trim()) {
        throw new Error(extractPayload?.error ?? "Could not read that document.");
      }
      const documentText = extractedText;
      const inferredKind = inferClaritiKind({
        kind: "unknown",
        question,
        documentText,
        fileName: file.name,
      });
      const kind = inferredKind !== "unknown"
        ? inferredKind
        : previousAnalysis?.kind && previousAnalysis.kind !== "unknown"
          ? previousAnalysis.kind
          : inferredKind;

      let documentId: string | undefined;
      try {
        const uploadForm = new FormData();
        uploadForm.set("file", file);
        uploadForm.set("kind", kind);
        uploadForm.set("extractedText", documentText);
        const uploadResponse = await fetch("/api/documents/upload", { method: "POST", body: uploadForm });
        const uploadPayload = await uploadResponse.json().catch(() => null);
        if (uploadResponse.ok && uploadPayload?.ok && uploadPayload.document?.id) {
          documentId = String(uploadPayload.document.id);
        }
      } catch {
        // Upload is best-effort; analysis can still proceed from extracted text.
      }

      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          question,
          documentText,
          fileName: file.name,
          documentId,
          previousSessionId: previousSessionId ?? undefined,
        }),
      });
      const analyzePayload = await analyzeResponse.json().catch(() => null);
      if (analyzeResponse.status === 402 && isPlusRequiredPayload(analyzePayload)) {
        redirectToUpgrade(analyzePayload.message);
        return;
      }
      if (!analyzeResponse.ok || !analyzePayload?.ok || !analyzePayload.analysis) {
        throw new Error(analyzePayload?.error ?? "Could not analyze that document.");
      }

      const nextAnalysis = analyzePayload.analysis as ClaritiAnalysis;
      const savedSessionId = analyzePayload.persisted?.session?.id as string | undefined;
      track("follow_up_report_added", { kind: nextAnalysis.kind });
      const nextRequest: ClaritiRequest = {
        kind: nextAnalysis.kind,
        question,
        documentText,
        fileName: file.name,
        documentId,
        analysis: nextAnalysis,
        status: "done",
        persisted: analyzePayload.persisted,
      };

      // Newest uploaded report becomes the active right-panel analysis.
      activeRequestRef.current = nextRequest;
      setActiveRequest(nextRequest);
      setActiveAnalysis(nextAnalysis);
      setActive(nextAnalysis.kind);
      resetVideoState();
      setComparisonCards([]);
      if (savedSessionId) {
        dbSessionIdRef.current = savedSessionId;
        setDbSessionId(savedSessionId);
        window.history.replaceState(null, "", `/workspace?sessionId=${savedSessionId}`);
        setRecentSessions((current) => {
          const saved = toRecentWorkspaceSessionFromAnalysis(nextRequest, nextAnalysis, analyzePayload.persisted);
          return [saved, ...current.filter((item) => item.id !== saved.id)];
        });
      }

      const relatedToCurrentTrend = Boolean(
        previousAnalysis
        && previousAnalysis.kind !== "unknown"
        && previousAnalysis.kind === nextAnalysis.kind,
      );

      let comparison: ProgressionComparison | null = null;
      if (relatedToCurrentTrend) {
        const compareResponse = await fetch("/api/compare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            analysis: nextAnalysis,
            sessionId: savedSessionId,
            compareSessionId: previousSessionId ?? undefined,
          }),
        });
        const comparePayload = await compareResponse.json().catch(() => null);
        if (compareResponse.status === 402 && isPlusRequiredPayload(comparePayload)) {
          redirectToUpgrade(comparePayload.message);
        } else if (compareResponse.ok && comparePayload?.ok && comparePayload.comparison) {
          comparison = comparePayload.comparison as ProgressionComparison;
          track("compare_documents", { kind: nextAnalysis.kind, trend: comparison.trend });
        }
      }

      const replyAt = createLocalTimestamp();
      const fallbackAssistant = comparison
        ? `I read ${file.name} and updated the analysis panel.\n\n${comparison.headline}\n\n${comparison.plainEnglish}`
        : `I read ${file.name} and updated the analysis panel.\n\n${buildInitialAnalysisReply(nextAnalysis)}`;

      const sessionForReply = savedSessionId ?? dbSessionIdRef.current;
      if (sessionForReply) {
        try {
          const response = await fetch("/api/messages", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId: sessionForReply,
              content: userContentForAgent,
              analysis: nextAnalysis,
            }),
          });
          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.ok) {
            const savedMessages = Array.isArray(payload.messages)
              ? payload.messages.map((message: { id: string; role: string; content: string; created_at?: string }, index: number) => {
                const role = message.role === "assistant" ? "assistant" as const : "user" as const;
                if (role === "user") {
                  const parsed = parseMessageAttachment(message.content);
                  return {
                    id: message.id,
                    role,
                    content: parsed.text || "Please review this attached document.",
                    createdAt: timestampFromIso(message.created_at) ?? replyAt + index,
                    attachment: parsed.fileName
                      ? {
                        name: parsed.fileName,
                        previewUrl: messagePreviewUrl,
                        label: fileTypeLabel(parsed.fileName),
                      }
                      : {
                        name: file.name,
                        previewUrl: messagePreviewUrl,
                        label: fileTypeLabel(file.name),
                      },
                  };
                }
                return {
                  id: message.id,
                  role,
                  content: message.content,
                  createdAt: timestampFromIso(message.created_at) ?? replyAt + index,
                };
              })
              : [
                {
                  id: createLocalId("upload-user-saved"),
                  role: "user" as const,
                  content: cleanUserText || "Please review this attached document.",
                  createdAt: uploadedAt,
                  attachment: {
                    name: file.name,
                    previewUrl: messagePreviewUrl,
                    label: fileTypeLabel(file.name),
                  },
                },
                {
                  id: createLocalId("upload-assistant"),
                  role: "assistant" as const,
                  content: typeof payload.assistant === "string" ? payload.assistant : fallbackAssistant,
                  createdAt: replyAt,
                },
              ];

            // Keep the progression card AFTER the user + assistant bubbles in the timeline.
            const comparisonAt = Math.max(
              replyAt + 1,
              ...savedMessages.map((message: { createdAt?: number }) => message.createdAt ?? 0),
            ) + 1;
            if (comparison) {
              setComparisonCards([{ id: createLocalId("comparison"), createdAt: comparisonAt, comparison }]);
              showToast("Newest report is active — comparison card added.");
            } else {
              setComparisonCards([]);
              showToast("Newest report is now the active analysis.");
            }

            setChatMessages((current) => [
              ...current.filter((message) => message.id !== userMessageId),
              ...savedMessages,
            ]);
            return;
          }
        } catch {
          // Fall through to local reply.
        }
      }

      if (comparison) {
        setComparisonCards([{ id: createLocalId("comparison"), createdAt: replyAt + 1, comparison }]);
        showToast("Newest report is active — comparison card added.");
      } else {
        setComparisonCards([]);
        showToast("Newest report is now the active analysis.");
      }

      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("upload-assistant"),
          role: "assistant",
          content: fallbackAssistant,
          createdAt: replyAt,
        },
      ]);
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not read that document.");
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("upload-error"),
          role: "assistant",
          content: "I couldn’t read or analyze that document. Try again with a clearer PDF, image, or .txt file.",
          createdAt: createLocalTimestamp(),
        },
      ]);
    } finally {
      setReplacingDocument(false);
      setSendingFollowUp(false);
      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
    }
  };

  const createQuestionList = async () => {
    const content = "Create a concise question list I can ask my clinician about this report. Use only the saved report analysis and source anchors, group questions by priority, and include why each question matters.";
    await sendMessageToAgent(content, { clearInput: false, toast: "Question list added to the chat." });
  };

  const beginFollowUpConversation = async () => {
    if (!analysis || !session) return;
    setSheet(null);
    const action = followAction || analysis.nextActions[0] || "review the report with my clinician";
    const draft = { action, email: accountEmail ?? undefined };
    setFollowUpDraft(draft);
    const content =
      `I want to set an email check-in about this ${session.tag.toLowerCase()}. ` +
      `Clariti should email me to ask if anything changed, if I need further analysis, or if I want to compare a newer report. ` +
      `Report context: ${analysis.summary}. Suggested focus: ${action}. ` +
      `Help me choose the purpose and a safe day/time. Use my account email${accountEmail ? ` (${accountEmail})` : ""} unless I give a different one. Do not ask for a phone number.`;
    await sendMessageToAgent(content, {
      clearInput: false,
      followUpDraftOverride: draft,
      skipFollowUpCapture: true,
      toast: "Email check-in planning added to the chat.",
    });
  };

  const maybeCaptureFollowUpDetails = async (content: string, draft: FollowUpDraft): Promise<"scheduled" | "captured" | "none"> => {
    if (!analysis) return "none";
    const email = extractEmailAddress(content) ?? draft.email ?? accountEmail ?? undefined;
    const hasTime = hasSchedulingTime(content);
    const timingText = hasTime ? content : draft.timingText;

    if (!timingText) {
      if (email && email !== draft.email) {
        setFollowUpDraft({ ...draft, email });
        return "captured";
      }
      return "none";
    }

    if (!email) {
      setFollowUpDraft({ ...draft, timingText });
      return "captured";
    }

    const scheduleText = `${draft.timingText ?? ""} ${content}`.trim();
    const scheduledFor = inferScheduledFor(scheduleText);
    try {
      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: dbSessionId ?? `clariti-${active}`,
          channel: "email",
          scheduledFor,
          email,
          action: draft.action,
          analysis,
        }),
      });
      const payload = await response.json();
      if (response.status === 402 && isPlusRequiredPayload(payload)) {
        redirectToUpgrade(payload.message);
        return "none";
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not schedule check-in");
      setFollowUpDraft(null);
      const savedMessage = payload.message as { id: string; role: string; content: string; created_at?: string } | null;
      setChatMessages((current) => [
        ...current,
        savedMessage ? {
          id: savedMessage.id,
          role: "assistant",
          content: savedMessage.content,
          createdAt: timestampFromIso(savedMessage.created_at) ?? createLocalTimestamp(),
        } : {
          id: createLocalId("local-followup-scheduled"),
          role: "assistant",
          content: `Done. I’ll email ${email} around ${new Date(payload.followUp.scheduledFor).toLocaleString()} to check in about: ${draft.action}.`,
          createdAt: createLocalTimestamp(),
        },
      ]);
      track("email_checkin_scheduled", { kind: analysis.kind });
      return "scheduled";
    } catch {
      setFollowUpDraft({ ...draft, email, timingText });
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-followup-save-failed"),
          role: "assistant",
          content: "I have the check-in details, but I could not save them yet. Please try again in a moment.",
          createdAt: createLocalTimestamp(),
        },
      ]);
      return "none";
    }
  };

  if (booting || !session || (!analysis && !loading)) {
    return (
      <main className="clariti-workspace clariti-workspace-empty">
        <section className="clariti-empty-page">
          <div className="clariti-empty-inner">
            <div className="clariti-orb"><FileText /></div>
            <p className="clariti-kicker">WORKSPACE</p>
            <h1>{booting ? "Loading saved analysis" : loadError ? "Could not load this report" : "No active analysis yet"}</h1>
            <p className="clariti-lead">
              {booting
                ? "Getting your document and its analysis."
                : loadError
                  ? loadError
                  : "Ask Clariti about one health document from Home. The workspace will open after there is a saved database session to review."}
            </p>
            {!booting && loadError && (
              <button type="button" className="workspace-empty-cta" onClick={() => window.location.reload()}>
                Try again
              </button>
            )}
            {!booting && !loadError && <Link href="/" className="workspace-empty-cta">Start an analysis</Link>}
          </div>
        </section>
        <style jsx>{`
          .clariti-workspace-empty{display:block;background:#f7f8f7;min-height:100vh;height:auto;overflow:auto}
          .workspace-empty-cta{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#4d8d83;color:#fff;border-radius:12px;padding:12px 16px;font-size:13px;font-weight:800;border:none;cursor:pointer;font-family:inherit}
        `}</style>
      </main>
    );
  }

  return (
    <main className={`clariti-workspace ${canvasOpen ? "mobile-canvas-open" : ""}`}>
      <aside className={`clariti-left-panel ${drawer ? "mobile-drawer-open" : ""}`}>
        <div className="workspace-brand-row">
          <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
          <div className="workspace-brand-actions">
            <Link href="/" className="workspace-new" aria-label="New chat"><Plus /></Link>
            <button type="button" className="mobile-drawer-close" onClick={() => setDrawer(null)} aria-label="Close menu"><X /></button>
          </div>
        </div>
        <div className="mobile-drawer-tabs">
          <button className={drawer === "chats" ? "active" : ""} onClick={() => setDrawer("chats")}><MessageSquareText />Chats</button>
          <button className={drawer === "documents" ? "active" : ""} onClick={() => setDrawer("documents")}><FolderOpen />Documents</button>
          <button className={drawer === "history" ? "active" : ""} onClick={() => setDrawer("history")}><History />History</button>
        </div>
        <div className="drawer-section-title">{drawer === "documents" ? "YOUR DOCUMENTS" : drawer === "history" ? "HISTORY" : "RECENT CHATS"}</div>
        <nav className="clariti-conversations">
          {drawer === "documents" || drawer === "history" ? (
            sidebarSessions.map((item) => (
              <button
                key={item.id}
                className={`${activeSidebarId === item.id ? "active" : ""} ${"pending" in item && item.pending ? "pending" : ""}`}
                // eslint-disable-next-line react-hooks/refs -- selectSession reads refs only inside its onClick body (the sanctioned pattern); this call is unchanged from before the sidebar-grouping change, and the rule misattributes an unrelated warning to this line whenever the grouped-view branch below exists in the same component (verified via isolation: removing the ternary's other branch clears it; restructuring that branch does not).
                onClick={() => selectSession(item)}
              >
                <span className={`file-icon file-icon-${item.kind}`}>{sidebarIcon(item.kind)}</span>
                <span>
                  <b>{drawer === "documents" ? item.fileName : item.title}</b>
                  <small>{drawer === "history" ? item.preview : item.meta}</small>
                </span>
                <MoreHorizontal />
              </button>
            ))
          ) : (
            sidebarGroups.map((group) => (
              <SidebarGroupRow
                key={group.key}
                group={group}
                activeSidebarId={activeSidebarId}
                expanded={group.items.length > 1 && (expandedGroups.has(group.key) || (group.containsActive && activeSidebarId !== group.head.id))}
                onToggle={() => toggleGroup(group.key)}
                onSelect={(item) => selectSession(item)}
              />
            ))
          )}
        </nav>
        <div className="drawer-footer-links"><Link href="/"><Plus />New chat</Link><Link href="/settings"><Settings />Settings</Link></div>
        <div className="left-panel-note"><ShieldCheck /><p>Your documents stay private and under your control.</p></div>
      </aside>
      {drawer && <button className="mobile-drawer-backdrop" aria-label="Close" onClick={() => setDrawer(null)} />}

      <section className="clariti-chat-panel">
        <header className="workspace-chat-header">
          <div className="mobile-header-left">
            <button type="button" className="mobile-menu-button" onClick={() => setDrawer("chats")} aria-label="Open menu"><Menu /></button>
            <div><h1>{session.title}</h1><p>{session.meta}</p></div>
          </div>
          <button type="button" className="mobile-call-button" onClick={() => void beginFollowUpConversation()} aria-label="Set email check-in"><Bell /></button>
        </header>

        <div className="clariti-chat-scroll" ref={chatScrollRef}>
          <div className="clariti-date-chip">Today</div>
          {chatTimeline.length > 0 ? chatTimeline.map((item) => {
            if (item.type === "message") {
              return (
                <ChatMessageBubble
                  key={item.id}
                  message={item.message}
                  session={session}
                  showAttachment={item.messageIndex === 0 && item.message.role === "user"}
                  showSafetyNote={item.messageIndex === 1 && item.message.role === "assistant"}
                  safetyNote={analysis?.safetyNote ?? "Clariti explains document wording and does not diagnose or replace a clinician."}
                  active={active}
                />
              );
            }
            if (item.type === "comparison") {
              return <ProgressionComparisonCard key={item.id} comparison={item.comparison} />;
            }
            return analysis ? <GeneratedVideoResponse key={item.id} video={item.video} analysis={analysis} /> : null;
          }) : (
            <div className="clariti-ai-message">
              <span className="clariti-ai-avatar">C</span>
              <div>
                <p>{loading ? "I’m reading the document and checking the exact source wording before I explain it." : analysis?.summary}</p>
                <p>{loading ? "This usually takes a moment." : analysis?.plainEnglish}</p>
              </div>
            </div>
          )}

          {loading && chatMessages.length > 0 && (
            <article className="clariti-chat-turn assistant-turn" aria-busy="true">
              <span className="clariti-ai-avatar">C</span>
              <div className="clariti-ai-card clariti-thinking-card">
                <div className="message-meta">Clariti</div>
                <p>I’m reading the document and checking the exact source wording before I explain it.</p>
                <span className="clariti-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
              </div>
            </article>
          )}

          {sendingFollowUp && (
            <article className="clariti-chat-turn assistant-turn" aria-busy="true">
              <span className="clariti-ai-avatar">C</span>
              <div className="clariti-ai-card clariti-thinking-card clariti-agent-typing-card">
                <div className="message-meta">Clariti</div>
                <p>{replacingDocument
                  ? "Reading your attached document and updating the analysis."
                  : "Reading your follow-up and checking it against this saved analysis."}</p>
                <span className="clariti-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
              </div>
            </article>
          )}

          {!analysisPending && analysis && artifact && (
            <AnalysisTeaserCard analysis={analysis} onOpen={() => setCanvasOpen(true)} />
          )}

        </div>

        {!analysisPending && analysis && !sendingFollowUp && (
          <section className="clariti-thread-actions" aria-label="Continue with Clariti">
            <div>
              <span>Continue with Clariti</span>
              <p>Schedule an email check-in or attach a related report.</p>
            </div>
            <div className="clariti-quick-actions">
              <button onClick={() => void beginFollowUpConversation()}>Set email check-in</button>
              {compareAvailable && (
                <button
                  type="button"
                  onClick={() => injectComposerPrompt(
                    analysis
                      ? `Compare this ${getClaritiKindMeta(analysis.kind).documentNoun} with my earlier saved reports and tell me what changed.`
                      : "Compare this report with my earlier saved documents and tell me what changed.",
                  )}
                >
                  Compare with earlier docs
                </button>
              )}
              <button
                type="button"
                disabled={replacingDocument}
                onClick={() => {
                  injectComposerPrompt(
                    analysis
                      ? `Please review the follow-up ${getClaritiKindMeta(analysis.kind).documentNoun} I attach and compare it with this analysis.`
                      : "Please review the follow-up report I attach and compare it with this analysis.",
                  );
                  chatFileInputRef.current?.click();
                }}
              >
                Add follow-up report
              </button>
            </div>
          </section>
        )}

        <div className={`clariti-workspace-composer${pendingAttachment ? " has-pending-attachment" : ""}`}>
          {pendingAttachment && (
            <div className="composer-pending-attachment" aria-label="Attached document ready to send">
              {pendingAttachment.previewUrl ? (
                <img src={pendingAttachment.previewUrl} alt="" className="composer-pending-thumb" />
              ) : (
                <span className="composer-pending-icon" aria-hidden="true"><FileText /></span>
              )}
              <div className="composer-pending-meta">
                <b>{pendingAttachment.name}</b>
                <small>Ready to send — Clariti will read this with your message</small>
              </div>
              <button
                type="button"
                className="composer-pending-clear"
                aria-label="Remove attached document"
                onClick={clearPendingAttachment}
              >
                <X />
              </button>
            </div>
          )}
          <input
            ref={chatFileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,application/pdf,image/*,text/plain"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) stageChatAttachment(file);
            }}
          />
          <button
            type="button"
            className="composer-attach"
            aria-label="Attach one document"
            disabled={replacingDocument}
            onClick={() => chatFileInputRef.current?.click()}
            title="Attach one document, then send with your message"
          >
            <Paperclip />
          </button>
          <input
            ref={composerInputRef}
            placeholder={pendingAttachment ? "Add a note about this document..." : "Ask a follow-up question..."}
            value={followUpText}
            onChange={(event) => setFollowUpText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendFollowUp();
              }
            }}
          />
          <button
            type="button"
            className="send"
            aria-label="Send message"
            disabled={(!followUpText.trim() && !pendingAttachment) || sendingFollowUp}
            onClick={() => void sendFollowUp()}
          >
            {sendingFollowUp ? <RefreshCw className="spin" /> : <Send />}
          </button>
        </div>
      </section>

      <aside className={`clariti-canvas canvas-${active}`}>
        <div className="mobile-canvas-bar"><button type="button" onClick={() => setCanvasOpen(false)}><ArrowLeft />Back</button><span>Generated insight</span><button type="button" onClick={() => setCanvasOpen(false)} aria-label="Close insight"><X /></button></div>
        {analysisPending || !analysis || !artifact ? (
          <>
            <header><div><p className="canvas-kicker">READING DOCUMENT</p><h2>Clariti is checking the source text</h2></div><RefreshCw className="spin" /></header>
            <PendingAnalysisCanvas session={session} active={active} />
          </>
        ) : (
          <>
            <header><div><p className="canvas-kicker">{artifact.eyebrow}</p><h2>{analysis.title}</h2></div>{active === "radiology_report" || active === "pathology_report" ? <ImageIcon /> : <Sparkles />}</header>
            <div className="canvas-tabs">
              <button className={canvasTab === "summary" ? "active" : ""} onClick={() => setCanvasTab("summary")}>Summary</button>
              <button className={canvasTab === "detail" ? "active" : ""} onClick={() => setCanvasTab("detail")}>{getClaritiKindMeta(active).detailTab}</button>
              <button className={canvasTab === "actions" ? "active" : ""} onClick={() => setCanvasTab("actions")}>Next steps</button>
            </div>
            <AnalysisCanvas analysis={analysis} tab={canvasTab} videoScene={videoScene} generatedVideoUrl={generatedVideo?.url ?? null} generatedIllustration={generatedIllustrations[videoScene] ?? null} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} videoGenerating={videoGenerating} videoStatus={videoStatus} videoProgress={videoProgress} videoError={videoError} onSceneChange={setVideoScene} onGenerateVideo={generateHumanVideo} onGenerateIllustration={generateIllustration} onOpenIllustration={setExpandedIllustration} onCreateQuestionList={createQuestionList} onOpenSource={() => openSheet("source")} />
            <section className="canvas-continuity">
              <div><p className="canvas-kicker">CONTINUE WITH CLARITI</p><h3>Don’t stop at understanding.</h3><p>Schedule an email check-in so Clariti can ask if anything changed.</p></div>
              <div className="continuity-actions"><button onClick={() => void beginFollowUpConversation()}><Bell />Set email check-in</button></div>
            </section>
            <footer className="canvas-footer">{analysis.safetyNote}</footer>
          </>
        )}
      </aside>

      <nav className="clariti-mobile-dock"><button onClick={() => setDrawer("chats")}><MessageSquareText /><span>Chats</span></button><button onClick={() => setDrawer("documents")}><FolderOpen /><span>Documents</span></button><Link href="/"><Plus /><span>New</span></Link><button onClick={() => setDrawer("history")}><History /><span>History</span></button></nav>

      {toast && <div className="clariti-ui-toast" role="status">{toast}</div>}

      {expandedIllustration && (
        <div className="clariti-modal-backdrop illustration-lightbox-backdrop" onMouseDown={() => setExpandedIllustration(null)}>
          <div className="illustration-lightbox" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="sheet-close" onClick={() => setExpandedIllustration(null)} aria-label="Close illustration"><X /></button>
            <NextImage src={expandedIllustration.url} alt="Generated educational illustration" width={1280} height={720} unoptimized />
            <p>Educational illustration only. It does not replace a clinician, diagnosis, coverage decision, or billing advice.</p>
          </div>
        </div>
      )}

      {sheet && (
        <div className="clariti-modal-backdrop" onMouseDown={() => setSheet(null)}>
          <div className="clariti-modal prototype-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="sheet-close" onClick={() => setSheet(null)} aria-label="Close options"><X /></button>
            {sheet === "source" ? (
              <>
                <span className="modal-icon"><FileText /></span>
                <p className="canvas-kicker">ORIGINAL DOCUMENT TEXT</p>
                <h2>{session.fileName}</h2>
                <pre className="source-document-preview">{activeRequest?.documentText ?? "Original document text is not available for this saved session."}</pre>
              </>
            ) : (
              <>
                <span className="modal-icon"><Bell /></span>
                <p className="canvas-kicker">EMAIL CHECK-IN</p>
                <h2>Schedule around one action</h2>
                <p>Clariti will email you to ask if anything changed or if you need further analysis. No phone number needed.</p>
                <div className="followup-builder">
                  {(analysis?.nextActions ?? []).map((action) => (
                    <button key={action} type="button" className={`follow-choice ${followAction === action ? "selected" : ""}`} onClick={() => setFollowAction(action)}>
                      {followAction === action ? <CheckCircle2 /> : <span />}
                      <b>{action}</b>
                    </button>
                  ))}
                </div>
                <div className="prototype-option-list">
                  <button type="button" onClick={() => void beginFollowUpConversation()}><Bell /><span><b>Discuss and schedule in chat</b><small>Clariti will use your account email and ask only for day/time.</small></span></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function AnalysisCanvas({
  analysis,
  tab,
  videoScene,
  generatedVideoUrl,
  generatedIllustration,
  generatedIllustrations,
  illustrationGenerating,
  illustrationError,
  videoGenerating,
  videoStatus,
  videoProgress,
  videoError,
  onSceneChange,
  onGenerateVideo,
  onGenerateIllustration,
  onOpenIllustration,
  onCreateQuestionList,
  onOpenSource,
}: {
  analysis: ClaritiAnalysis;
  tab: CanvasTab;
  videoScene: number;
  generatedVideoUrl: string | null;
  generatedIllustration: GeneratedIllustration | null;
  generatedIllustrations: Record<number, GeneratedIllustration>;
  illustrationGenerating: boolean;
  illustrationError: string | null;
  videoGenerating: boolean;
  videoStatus: string | null;
  videoProgress: number;
  videoError: string | null;
  onSceneChange: (scene: number) => void;
  onGenerateVideo: (durationSeconds: number) => Promise<void>;
  onGenerateIllustration: (sceneIndex: number) => Promise<void>;
  onOpenIllustration: (illustration: GeneratedIllustration) => void;
  onCreateQuestionList: () => Promise<void>;
  onOpenSource: () => void;
}) {
  if (tab === "actions") return <Actions items={analysis.nextActions} onCreateQuestionList={onCreateQuestionList} />;
  if (tab === "detail") return <Detail analysis={analysis} onOpenSource={onOpenSource} />;

  const concernMetric = analysis.metrics[1] ?? analysis.metrics[0];
  const meta = getClaritiKindMeta(analysis.kind);
  const family = meta.uiFamily;

  return (
    <div className={`canvas-content canvas-family-${family}`}>
      {family === "clinical_report" ? (
        <>
          <section className={`report-hero ${analysis.kind === "pathology_report" ? "pathology-hero" : "radiology-hero"}`}>
            <div>
              <span className="result-label">{analysis.kind === "pathology_report" ? "MAIN FINDING" : "OVERALL TAKEAWAY"}</span>
              <h3>{analysis.summary}</h3>
              <p>{analysis.plainEnglish}</p>
            </div>
            <span className="risk-pill sev-positive">{concernMetric?.value ?? "Review"}</span>
          </section>
          <section className="impression-stats">
            <div><strong>{analysis.keyPoints.length}</strong><span>Key points</span></div>
            <div><strong>{analysis.metrics[0]?.value ?? "Report"}</strong><span>{analysis.metrics[0]?.label ?? "Document"}</span></div>
            <div><strong>{concernMetric?.value ?? "Ask"}</strong><span>{concernMetric?.label ?? "Ask your clinician"}</span></div>
          </section>
          <KeyPointList points={analysis.keyPoints} variant="list" />
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      ) : family === "lab" ? (
        <>
          <section className="lab-hero">
            <div>
              <span className="result-label">IN PLAIN ENGLISH</span>
              <h3>{analysis.summary}</h3>
              <p>{analysis.plainEnglish}</p>
            </div>
          </section>
          <section className="lab-metrics">
            {analysis.metrics.slice(0, 3).map((metric) => <MetricChip {...metric} key={metric.label} />)}
          </section>
          <KeyPointList points={analysis.keyPoints} variant="list" heading="Markers to understand" />
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      ) : family === "care_plan" ? (
        <>
          <section className="care-hero">
            <div>
              <span className="result-label">WHAT THIS MEANS</span>
              <h3>{analysis.summary}</h3>
              <p>{analysis.plainEnglish}</p>
            </div>
          </section>
          <KeyPointList points={analysis.keyPoints} variant="timeline" limit={3} />
          <section className="canvas-card"><h3>In plain English</h3><p>{analysis.plainEnglish}</p></section>
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      ) : family === "medication" ? (
        <>
          <section className="med-hero">
            <div>
              <span className="result-label">YOUR MEDICINES</span>
              <h3>{analysis.summary}</h3>
              <p>{analysis.plainEnglish}</p>
            </div>
          </section>
          <KeyPointList points={analysis.keyPoints} variant="pills" />
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      ) : (
        <>
          <section className={analysis.kind === "insurance_eob" || analysis.kind === "prior_authorization" ? "eob-flow" : "clariti-hero-total"}>
            {analysis.metrics.slice(0, 3).map((metric) => <MetricChip {...metric} key={metric.label} />)}
          </section>
          <section className="canvas-card"><h3>In plain English</h3><p>{analysis.plainEnglish}</p></section>
          <KeyPointList points={analysis.keyPoints} variant="list" />
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      )}
      {analysis.flags.map((flag) => <FlagCard flag={flag} key={flag.label} />)}
    </div>
  );
}

function PendingAnalysisCanvas({ session, active }: { session: WorkspaceSession; active: ClaritiAnalysisKind }) {
  const detailLabel = getClaritiKindMeta(active).pendingLabel;
  return (
    <div className="canvas-content">
      <section className="canvas-card pending-analysis-card">
        <div className="pending-analysis-icon"><RefreshCw className="spin" /></div>
        <h3>Reading {session.fileName}</h3>
        <p>Clariti is reading the {detailLabel} and turning it into simple language you can actually use.</p>
        <div className="pending-analysis-steps" aria-label="Analysis progress">
          <span>Read document</span>
          <span>Find key lines</span>
          <span>Explain simply</span>
        </div>
      </section>
      <section className="canvas-card pending-source-card">
        <h3>What Clariti will and will not do</h3>
        <p>It will explain the document text and suggest questions. It will not diagnose, prescribe, or decide coverage or payment for you.</p>
      </section>
    </div>
  );
}

function Detail({ analysis, onOpenSource }: { analysis: ClaritiAnalysis; onOpenSource: () => void }) {
  const meta = getClaritiKindMeta(analysis.kind);
  return (
    <div className="canvas-content">
      <section className="canvas-card">
        <h3>{meta.detailHeading}</h3>
        <KeyPointList points={analysis.keyPoints} variant="row" />
      </section>
      <section className="canvas-card meta-card">
        <h3>Where this came from</h3>
        {analysis.sourceAnchors.map((anchor) => (
          <div className="meta-row" key={anchor}><span>Source</span><b>{anchor}</b></div>
        ))}
        <button type="button" className="meta-link-btn" onClick={onOpenSource}><FileDown />View original document</button>
      </section>
    </div>
  );
}

function ChatMessageBubble({
  message,
  session,
  showAttachment,
  showSafetyNote,
  safetyNote,
  active,
}: {
  message: ChatMessage;
  session: WorkspaceSession;
  showAttachment: boolean;
  showSafetyNote: boolean;
  safetyNote: string;
  active: ClaritiAnalysisKind;
}) {
  if (message.role === "user") {
    const parsed = message.attachment
      ? { text: message.content, fileName: message.attachment.name }
      : parseMessageAttachment(message.content);
    const attachment = message.attachment
      ?? (parsed.fileName
        ? { name: parsed.fileName, previewUrl: null as string | null, label: fileTypeLabel(parsed.fileName) }
        : showAttachment
          ? { name: session.fileName, previewUrl: null as string | null, label: session.tag }
          : null);
    const displayText = parsed.text.trim();

    return (
      <article className="clariti-chat-turn user-turn">
        <div className="message-meta">You</div>
        <div className={`clariti-user-message${attachment ? " has-file-chip" : ""}`}>
          {attachment && (
            <div className="chat-file-chip" aria-label={`Attached file ${attachment.name}`}>
              {attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt="" className="chat-file-thumb" />
              ) : (
                <span className="chat-file-icon" aria-hidden="true">
                  {isPdfFileName(attachment.name) ? <FileHeart /> : <FileText />}
                </span>
              )}
              <span className="chat-file-meta">
                <b>{attachment.name}</b>
                <small>{attachment.label ?? fileTypeLabel(attachment.name)}</small>
              </span>
            </div>
          )}
          {displayText ? <p>{displayText}</p> : null}
        </div>
      </article>
    );
  }

  const paragraphs = message.content.split("\n").map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <article className="clariti-chat-turn assistant-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card">
        <div className="message-meta">Clariti</div>
        {paragraphs.map((paragraph, index) => (
          <p className={/source:/i.test(paragraph) ? "source-grounded-line" : undefined} key={`${paragraph}-${index}`}>{paragraph}</p>
        ))}
        {showSafetyNote && (
          <div className={`clariti-inline-note ${getClaritiKindMeta(active).uiFamily === "clinical_report" ? "radiology-note" : ""}`}>
            {getClaritiKindMeta(active).uiFamily === "clinical_report" ? <Stethoscope /> : <Flag />} {safetyNote}
          </div>
        )}
      </div>
    </article>
  );
}

function GeneratedVideoResponse({ video, analysis }: { video: GeneratedVideo; analysis: ClaritiAnalysis }) {
  const source = (analysis.sourceAnchors[0] ?? "saved report analysis").replace(/\.+$/, ".");
  const meta = getClaritiKindMeta(analysis.kind);
  return (
    <article className="clariti-chat-turn assistant-turn generated-video-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card">
        <div className="message-meta">Clariti</div>
        <p>Here is a short video that walks through this {meta.shortTitle.toLowerCase()} in plain language.</p>
        <video className="chat-generated-video" src={video.url} controls playsInline />
        <p className="source-grounded-line">Source: {source} {meta.educationDisclaimer}</p>
      </div>
    </article>
  );
}

function ProgressionComparisonCard({ comparison }: { comparison: ProgressionComparison }) {
  const trendLabel = {
    improving: "Improving",
    worsening: "Getting worse",
    stable: "Mostly stable",
    mixed: "Mixed changes",
    insufficient: "Unclear trend",
  }[comparison.trend];

  const trendToken = trendToSeverityToken(comparison.trend);

  return (
    <article className={`clariti-chat-turn assistant-turn progression-card-turn trend-${comparison.trend}`}>
      <span className="clariti-ai-avatar">C</span>
      <div className={`clariti-ai-card chat-progression-card trend-${comparison.trend} sev-${trendToken}`}>
        <div className="message-meta">Clariti · Progression</div>
        <div className="progression-card-head">
          <span className={`progression-trend-pill trend-${comparison.trend} sev-${trendToken}`}>{trendLabel}</span>
          <b>{comparison.headline}</b>
        </div>
        <p>{comparison.plainEnglish}</p>
        <div className="progression-compare-meta">
          <span><small>Earlier</small><strong>{comparison.earlier.title}</strong></span>
          <span aria-hidden="true">→</span>
          <span><small>Newest</small><strong>{comparison.current.title}</strong></span>
        </div>
        {comparison.worseningSignals.length > 0 && (
          <div className="progression-signal-block is-worse">
            <small>More concerning wording</small>
            <ul>{comparison.worseningSignals.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        )}
        {comparison.improvingSignals.length > 0 && (
          <div className="progression-signal-block is-better">
            <small>Improved / resolved wording</small>
            <ul>{comparison.improvingSignals.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        )}
        {comparison.stableSignals.length > 0 && comparison.trend === "stable" && (
          <div className="progression-signal-block is-stable">
            <small>Unchanged wording</small>
            <ul>{comparison.stableSignals.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        )}
        {comparison.metrics.filter((metric) => metric.changed).slice(0, 4).length > 0 && (
          <div className="progression-metrics">
            {comparison.metrics.filter((metric) => metric.changed).slice(0, 4).map((metric) => (
              <div key={metric.label} className="progression-metric-row">
                <span>{metric.label}</span>
                <b>{metric.previousValue ?? "—"} → {metric.currentValue ?? "—"}</b>
              </div>
            ))}
          </div>
        )}
        <p className="source-grounded-line">{comparison.safetyNote}</p>
      </div>
    </article>
  );
}

function VideoStoryboard({
  analysis,
  activeScene,
  generatedVideoUrl,
  generatedIllustration,
  generatedIllustrations,
  illustrationGenerating,
  illustrationError,
  generating,
  jobStatus,
  jobProgress,
  videoError,
  onSceneChange,
  onGenerateVideo,
  onGenerateIllustration,
  onOpenIllustration,
}: {
  analysis: ClaritiAnalysis;
  activeScene: number;
  generatedVideoUrl: string | null;
  generatedIllustration: GeneratedIllustration | null;
  generatedIllustrations: Record<number, GeneratedIllustration>;
  illustrationGenerating: boolean;
  illustrationError: string | null;
  generating: boolean;
  jobStatus: string | null;
  jobProgress: number;
  videoError: string | null;
  onSceneChange: (scene: number) => void;
  onGenerateVideo: (durationSeconds: number) => Promise<void>;
  onGenerateIllustration: (sceneIndex: number) => Promise<void>;
  onOpenIllustration: (illustration: GeneratedIllustration) => void;
}) {
  const scenes = getVideoStoryboardScenes(analysis);
  const meta = getVideoExplainerMeta(analysis);
  const durationSeconds = 30;
  const videoRef = useRef<HTMLVideoElement>(null);
  const generatedSceneIndexes = Object.keys(generatedIllustrations)
    .map((key) => Number(key))
    .filter((index) => Number.isFinite(index) && index >= 0 && index < scenes.length)
    .sort((a, b) => a - b);
  const nextMissingSceneIndex = scenes.findIndex((_, index) => !generatedIllustrations[index]);
  const hasIllustrations = generatedSceneIndexes.length > 0;

  if (scenes.length === 0) return null;
  const scene = scenes[activeScene] ?? scenes[0];
  const generateVideo = async () => {
    onSceneChange(0);
    await onGenerateVideo(durationSeconds);
    requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => undefined);
    });
  };

  return (
    <section className="canvas-card video-explainer-card">
      <div className="video-explainer-head"><h3><Sparkles />Visual explainer</h3></div>
      {generatedVideoUrl ? (
        <video ref={videoRef} className="clariti-generated-video" src={generatedVideoUrl} controls playsInline />
      ) : (
        <div className="video-explainer-media video-empty-state" aria-hidden={generating ? undefined : true}>
          <div className="video-preview-copy">
            <span>{generating ? `${formatVideoJobStatus(jobStatus)} · ${jobProgress}%` : "No video yet"}</span>
            <b>{generating ? "Creating your explainer…" : meta.title}</b>
            <small>
              {generating
                ? "Clariti is generating five short scenes in parallel, then stitching them into one explainer."
                : "This box is a preview card, not a video player. Use the button below to generate a short explainer."}
            </small>
          </div>
        </div>
      )}
      <div className="generated-illustration-panel">
        {generatedIllustration ? (
          <button type="button" className="generated-illustration-image" onClick={() => onOpenIllustration(generatedIllustration)}>
            <NextImage src={generatedIllustration.url} alt={`${scene.title} educational illustration`} width={1280} height={720} unoptimized />
            <span>View full illustration</span>
          </button>
        ) : (
          <div className="illustration-prompt-card">
            <span><ImageIcon />Scene {activeScene + 1}</span>
            <b>{scene.title}</b>
            <small>{scene.script}</small>
          </div>
        )}
        <div className="illustration-actions">
          <button
            type="button"
            className="illustration-generate-btn"
            disabled={illustrationGenerating}
            onClick={() => void onGenerateIllustration(activeScene)}
          >
            {illustrationGenerating ? <RefreshCw className="spin" /> : <ImageIcon />}
            {generatedIllustration ? "Regenerate this illustration" : illustrationGenerating ? "Generating illustration..." : "Generate illustration"}
          </button>
          {hasIllustrations && nextMissingSceneIndex >= 0 && (
            <button
              type="button"
              className="illustration-generate-btn secondary"
              disabled={illustrationGenerating}
              onClick={() => void onGenerateIllustration(nextMissingSceneIndex)}
            >
              <ImageIcon />
              Generate next illustration
            </button>
          )}
        </div>
      </div>
      <div className="video-explainer-foot">
        <span><Sparkles />Source: {scene.sourceAnchor}</span>
      </div>
      {hasIllustrations && (
        <div className="video-scene-strip" aria-label="Generated illustration scenes">
          {generatedSceneIndexes.map((index) => {
            const item = scenes[index] ?? scenes[0];
            return (
              <button
                key={`${item.title}-${index}`}
                type="button"
                className={`${activeScene === index ? "active" : ""} has-image`}
                onClick={() => onSceneChange(index)}
                aria-label={`Show generated scene ${index + 1}: ${item.title}`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="video-primary-cta" disabled={generating} onClick={() => void generateVideo()}>
        {generating ? <RefreshCw className="spin" /> : <Play />}
        {generatedVideoUrl ? "Regenerate video explainer" : generating ? `Generating video ${jobProgress}%` : "Generate video explainer"}
      </button>
      {illustrationError && <p className="video-error">{illustrationError}</p>}
      {videoError && <p className="video-error">{videoError}</p>}
      <p className="video-caption">{generatedVideoUrl ? `The generated video explainer was also added to the chat thread. ${getEducationDisclaimer(analysis)}` : `Clariti creates a short AI explainer for education only. ${getEducationDisclaimer(analysis)}`}</p>
    </section>
  );
}

type StoryboardScene = {
  title: string;
  script: string;
  sourceAnchor: string;
  visual?: string;
};

function getVideoStoryboardScenes(analysis: ClaritiAnalysis): StoryboardScene[] {
  if (analysis.videoScenes?.length) return analysis.videoScenes;
  const main = analysis.keyPoints[0];
  const second = analysis.keyPoints[1];
  const metrics = analysis.metrics.slice(0, 3).map((metric) => `${metric.label}: ${metric.value}`).join(", ");
  const question = analysis.questions[0] ?? getClaritiKindMeta(analysis.kind).defaultQuestion;
  const meta = getClaritiKindMeta(analysis.kind);

  if (meta.uiFamily === "money") {
    return [
      { title: "What this is", script: `This ${meta.documentNoun} explains the important money or coverage details.`, sourceAnchor: analysis.sourceAnchors[0] ?? "Document header" },
      { title: "Key amounts", script: metrics || "Clariti maps the main amounts and statuses from the document.", sourceAnchor: analysis.metrics[0]?.label ?? "Amounts" },
      { title: "What to check", script: main?.detail ?? analysis.summary, sourceAnchor: main?.sourceAnchor ?? "Key point" },
      { title: "Before you act", script: second?.detail ?? meta.safetyShort, sourceAnchor: second?.sourceAnchor ?? "Careful note" },
      { title: "Next question", script: `Ask: ${question}`, sourceAnchor: analysis.sourceAnchors[0] ?? "Next step" },
    ];
  }

  return [
    { title: "What this is", script: analysis.summary, sourceAnchor: analysis.sourceAnchors[0] ?? "Document" },
    { title: "Main takeaway", script: main?.detail ?? analysis.plainEnglish, sourceAnchor: main?.sourceAnchor ?? "Key point" },
    { title: "Important detail", script: second?.detail ?? analysis.plainEnglish, sourceAnchor: second?.sourceAnchor ?? "Detail" },
    { title: "What Clariti cannot decide", script: meta.safetyShort, sourceAnchor: analysis.safetyNote },
    { title: "Next question", script: `Ask: ${question}`, sourceAnchor: analysis.sourceAnchors[0] ?? "Next step" },
  ];
}

function getVideoExplainerMeta(analysis: ClaritiAnalysis) {
  const meta = getClaritiKindMeta(analysis.kind);
  return {
    eyebrow: meta.videoEyebrow,
    title: meta.videoTitle,
    chatPrompt: meta.videoChatPrompt,
  };
}

function getEducationDisclaimer(analysis: ClaritiAnalysis) {
  return getClaritiKindMeta(analysis.kind).educationDisclaimer;
}

type VideoJobPayload = {
  id: string;
  status: string;
  progress: number;
  videoUrl?: string | null;
  error?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  completedAt?: string | null;
};

type LatestVideoJobResponse = {
  job: VideoJobPayload | null;
  completedJob?: VideoJobPayload | null;
};

async function createSceneVideoJob(analysis: ClaritiAnalysis, durationSeconds: number, sessionId: string) {
  const response = await fetch("/api/videos/report-explainer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ analysis, durationSeconds, sessionId }),
  });
  const payload = await response.json();
  if (response.status === 402 && isPlusRequiredPayload(payload)) {
    throw Object.assign(new Error(payload.message ?? "Explainer videos are a Clariti Plus feature."), { plusRequired: true });
  }
  if (!response.ok || !payload.ok || !payload.job?.id) {
    throw new Error(formatHumanVideoError(payload.error ?? "Clariti could not create the video job."));
  }
  return payload.job as VideoJobPayload;
}

async function fetchLatestVideoJob(sessionId: string): Promise<LatestVideoJobResponse | null> {
  const response = await fetch(`/api/videos/report-explainer?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) return null;
  return {
    job: (payload.job as VideoJobPayload | null) ?? null,
    completedJob: (payload.completedJob as VideoJobPayload | null) ?? null,
  };
}

async function createIllustration(analysis: ClaritiAnalysis, sceneIndex: number, sessionId: string | null) {
  const response = await fetch("/api/illustrations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ analysis, sceneIndex, sessionId }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok || !payload.illustration?.url) {
    throw new Error(payload.error ?? "Clariti could not generate the illustration.");
  }
  return payload.illustration as Omit<GeneratedIllustration, "createdAt">;
}

async function pollSceneVideoJob(
  jobId: string,
  onProgress: (status: string, progress: number) => void,
) {
  let processPromise: Promise<VideoJobPayload | null> | null = null;

  const kickProcess = () => {
    if (processPromise) return;
    processPromise = fetch(`/api/videos/report-explainer/${jobId}?process=1`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload.job) return null;
        const job = payload.job as VideoJobPayload;
        onProgress(job.status, job.progress ?? 0);
        return job;
      })
      .catch(() => null)
      .finally(() => {
        processPromise = null;
      });
  };

  kickProcess();

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(`/api/videos/report-explainer/${jobId}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !payload.job) {
      throw new Error(formatHumanVideoError(payload.error ?? "Clariti could not check the video job."));
    }
    const job = payload.job as VideoJobPayload;
    onProgress(job.status, job.progress ?? 0);
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new Error(formatHumanVideoError(job.error ?? "The video job failed."));

    if (job.status === "queued" || isVideoJobStale(job)) {
      kickProcess();
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("The video job is still running. Leave this chat open or try checking again in a moment.");
}

function isVideoJobStale(job: VideoJobPayload) {
  const updatedAt = job.updatedAt ?? job.updated_at;
  if (!updatedAt) return job.status === "queued";
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return job.status === "queued";
  return Date.now() - timestamp > 8 * 60 * 1000;
}

function Actions({ items, onCreateQuestionList }: { items: string[]; onCreateQuestionList: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreateQuestionList();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="canvas-content">
      <section className="canvas-card">
        <h3>Suggested next steps</h3>
        <ol className="action-list">
          {items.map((item, index) => <li key={item}><span>{index + 1}</span><p><b>{item}</b><small>Clariti can turn this into an email check-in or a concise question list.</small></p></li>)}
        </ol>
        <button type="button" className="canvas-primary" disabled={creating} onClick={() => void handleCreate()}>
          {creating ? "Creating question list..." : "Create question list"}
        </button>
      </section>
    </div>
  );
}

function toArtifactMeta(analysis: ClaritiAnalysis) {
  return { eyebrow: getClaritiKindMeta(analysis.kind).eyebrow };
}

function messagesFromDbSession(session: DbWorkspaceSession): ChatMessage[] {
  const messages = session.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const role = message.role === "assistant" ? "assistant" as const : "user" as const;
      if (role === "user") {
        const parsed = parseMessageAttachment(message.content);
        return {
          id: message.id,
          role,
          content: parsed.fileName ? (parsed.text || "Please review this attached document.") : message.content,
          createdAt: timestampFromIso(message.created_at),
          attachment: parsed.fileName
            ? { name: parsed.fileName, previewUrl: null, label: fileTypeLabel(parsed.fileName) }
            : undefined,
        };
      }
      return {
        id: message.id,
        role,
        content: message.content,
        createdAt: timestampFromIso(message.created_at),
      };
    });
  return messages.length > 0 ? messages : [];
}

function messagesFromRequest(request: ClaritiRequest): ChatMessage[] {
  const createdAt = createLocalTimestamp();
  if (!request.analysis) return [{ id: "initial-user", role: "user", content: request.question, createdAt }];
  return [
    { id: "initial-user", role: "user", content: request.question, createdAt },
    { id: "initial-assistant", role: "assistant", content: buildInitialAnalysisReply(request.analysis), createdAt: createdAt + 1 },
  ];
}

function buildInitialAnalysisReply(analysis: ClaritiAnalysis) {
  const source = analysis.keyPoints[0]?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "your document";
  const nextAction = analysis.nextActions[0] ?? "talk this through with the right person";
  return `${analysis.summary}\n\nI put the main points in the panel on the right — written in plain language. A good next step: ${nextAction}. Source: ${source}.`;
}

function timestampFromIso(value?: string | null) {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function videoJobCreatedAt(job: VideoJobPayload) {
  return timestampFromIso(job.createdAt ?? job.created_at) ?? timestampFromIso(job.completedAt ?? job.updatedAt) ?? Date.now();
}

function buildLocalFollowUp(question: string, analysis: ClaritiAnalysis) {
  const lower = question.toLowerCase();
  const point = analysis.keyPoints[0];
  const pointText = `${point.label} - ${point.detail.replace(/\s+/g, " ").replace(/\.+$/, ".")}`;

  if (extractEmailAddress(question) && !hasSchedulingTime(question)) {
    return "Got the email. What day and time should Clariti use for the check-in?";
  }

  if (/schedule|follow-up|follow up|check[- ]?in|email me|reminder|set.*time/.test(lower)) {
    return buildFollowUpPlanningReply(analysis, analysis.nextActions[0] ?? "review this document with the relevant clinician or provider");
  }

  if (/cancer|tumou?r|malignan|mass|lesion/.test(lower)) {
    return `I cannot tell from this paperwork whether you have cancer. The saved explanation does not include a cancer, tumour, malignancy, mass, or lesion finding; it highlights: ${pointText} Source: ${point.sourceAnchor}. Ask your clinician to confirm what the report rules in and rules out.`;
  }

  if (/ignore|safe to ignore|nothing to do|leave it|wait and see/.test(lower)) {
    return `I would not ignore it. The saved explanation flags: ${pointText} Source: ${point.sourceAnchor}. A safer next step is to ${(analysis.nextActions[0] ?? "review this with your clinician").toLowerCase()}.`;
  }

  const metric = analysis.metrics.find((item) => /\$|£|amount|paid|due|responsibility|billed/i.test(`${item.label} ${item.value}`));
  if (metric) {
    return `From the saved explanation, ${metric.label.toLowerCase()} is ${metric.value}. ${metric.caveat ?? ""} Source: ${analysis.sourceAnchors[0] ?? "saved analysis"}.`;
  }
  return `From the saved explanation: ${pointText} Source: ${point.sourceAnchor}.`;
}

function buildFollowUpPlanningReply(analysis: ClaritiAnalysis, action: string) {
  const point = analysis.keyPoints[0];
  return `Yes. I can set an email check-in for ${action}. Clariti will ask if anything changed or if you need further analysis. What day and time should I email you? Source: ${point.sourceAnchor}.`;
}

function inferFollowUpDraftFromThread({
  analysis,
  currentDraft,
  latestContent,
  messages,
}: {
  analysis: ClaritiAnalysis | null;
  currentDraft: FollowUpDraft | null;
  latestContent: string;
  messages: ChatMessage[];
}): FollowUpDraft | null {
  if (!analysis) return currentDraft;

  const recentMessages = messages.slice(-12);
  const threadText = [...recentMessages.map((message) => message.content), latestContent].join("\n");
  const lower = threadText.toLowerCase();
  const schedulingIntent = /follow-up|follow up|check[- ]?in|email me|schedule|appointment|reminder|preferred day|preferred time|what day and time|what time works/i.test(lower);
  if (!currentDraft && !schedulingIntent) return null;

  const email = currentDraft?.email ?? extractEmailAddress(threadText) ?? undefined;
  const timingSource = hasSchedulingTime(latestContent)
    ? latestContent
    : currentDraft?.timingText
      ? currentDraft.timingText
      : hasSchedulingTime(threadText)
        ? threadText
        : undefined;

  return {
    action: currentDraft?.action ?? analysis.nextActions[0] ?? "review this document with the right professional",
    email,
    timingText: timingSource,
  };
}

function extractEmailAddress(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0].trim().toLowerCase() ?? null;
}

function parseMessageAttachment(content: string) {
  const attached = content.match(/\n\nAttached:\s*(.+)\s*$/i);
  if (attached?.index != null) {
    return {
      text: content.slice(0, attached.index).trim(),
      fileName: attached[1].trim(),
    };
  }
  const readOnly = content.match(/^Please read this document:\s*(.+)\s*$/i);
  if (readOnly) {
    return { text: "", fileName: readOnly[1].trim() };
  }
  return { text: content, fileName: null as string | null };
}

function fileTypeLabel(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF document";
  if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(lower)) return "Image";
  if (lower.endsWith(".txt")) return "Text document";
  if (/\.(docx?|rtf)$/i.test(lower)) return "Document";
  return "Attached file";
}

function isPdfFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

function hasSchedulingTime(value: string) {
  return /\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midday|appointment|before|after|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,3}\s*(?:minutes?|mins?)\s+before|[01]?\d(?::[0-5]\d)?\s*(?:am|pm)|[01]?\d:[0-5]\d|2[0-3]:[0-5]\d)\b/i.test(value);
}

function inferScheduledFor(value: string) {
  const lower = value.toLowerCase();
  const date = new Date();
  const now = new Date();
  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const mentionedWeekday = Object.entries(weekdays).find(([day]) => new RegExp(`\\b${day}\\b`).test(lower));

  if (mentionedWeekday) {
    const [, targetDay] = mentionedWeekday;
    let delta = (targetDay - date.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    date.setDate(date.getDate() + delta);
  } else {
    if (/tomorrow/.test(lower)) date.setDate(date.getDate() + 1);
    if (/next week/.test(lower)) date.setDate(date.getDate() + 7);
  }

  if (/evening/.test(lower)) {
    date.setHours(18, 0, 0, 0);
  } else if (/afternoon/.test(lower)) {
    date.setHours(14, 0, 0, 0);
  } else if (/noon|midday/.test(lower)) {
    date.setHours(12, 0, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }

  const explicitTime = value.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (explicitTime) {
    let hour = Number(explicitTime[1]);
    const minute = explicitTime[2] ? Number(explicitTime[2]) : 0;
    const period = explicitTime[3]?.toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    date.setHours(hour, minute, 0, 0);
  }

  const minutesBefore = lower.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\s+before\b/);
  if (minutesBefore) date.setMinutes(date.getMinutes() - Number(minutesBefore[1]));

  if (date.getTime() < now.getTime() + 15 * 60 * 1000) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function formatVideoJobStatus(status: string | null | undefined) {
  switch (status) {
    case "queued":
      return "Queued — preparing your 5-scene explainer";
    case "scripting":
      return "Writing the 5-scene explainer script";
    case "generating_scenes":
      return "Creating the five scene clips";
    case "stitching":
      return "Stitching the five scenes together";
    case "completed":
      return "Video ready";
    case "failed":
      return "Video generation failed";
    default:
      return "Preparing your 5-scene explainer";
  }
}

function parseStoredRequest(value: string | null): ClaritiRequest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ClaritiRequest>;
    if (!isAnalysisKind(parsed.kind) || !parsed.documentText?.trim()) return null;
    return {
      kind: parsed.kind,
      question: parsed.question?.trim() || "Please explain this health document in plain English.",
      documentText: parsed.documentText,
      fileName: parsed.fileName,
      documentId: parsed.documentId,
      requestId: typeof parsed.requestId === "string" ? parsed.requestId : undefined,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : undefined,
      status: parsed.status === "analyzing" || parsed.status === "done" || parsed.status === "pending"
        ? parsed.status
        : undefined,
      analysis: parsed.analysis,
      persisted: parsed.persisted,
    };
  } catch {
    return null;
  }
}

function requestFingerprint(request: ClaritiRequest) {
  if (request.requestId) return request.requestId;
  if (request.documentId) return `doc:${request.documentId}`;
  return [
    request.kind,
    request.createdAt ?? 0,
    request.fileName ?? "",
    request.documentText.slice(0, 120),
  ].join(":");
}

function writeStoredRequest(request: ClaritiRequest) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(request));
}

function clearStoredRequest() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function getPersistedSessionId(request: ClaritiRequest) {
  const persisted = request.persisted as { session?: { id?: string } } | undefined;
  return persisted?.session?.id;
}

function requestFromDbSession(session: DbWorkspaceSession): ClaritiRequest | null {
  const artifact = session.artifacts[0];
  const parsedAnalysis = claritiAnalysisSchema.safeParse(artifact?.payload);
  const analysis = parsedAnalysis.success ? parsedAnalysis.data : undefined;
  const document = session.documents[0];
  const kindSource = analysis?.kind ?? document?.kind;
  if (!isAnalysisKind(kindSource)) return null;

  const userQuestion = session.messages.find((message) => message.role === "user")?.content;
  return {
    kind: kindSource,
    question: userQuestion?.trim() || session.title || "Please explain this health document in plain English.",
    documentText: document?.extracted_text?.trim() || artifact?.summary || session.title,
    fileName: document?.file_name,
    documentId: document?.id,
    analysis,
    persisted: {
      session: { id: session.id, title: session.title, status: session.status },
      document: document ? { id: document.id, file_name: document.file_name, kind: document.kind, status: document.status } : null,
      artifact: artifact ? { id: artifact.id, kind: artifact.kind, title: artifact.title } : null,
    },
  };
}

function isFreshPendingRequest(request: ClaritiRequest) {
  if (!request.createdAt) return false;
  return Date.now() - request.createdAt < 15 * 60 * 1000;
}

function isAnalysisKind(value: unknown): value is ClaritiAnalysisKind {
  return isClaritiAnalysisKind(value);
}

function toWorkspaceSession(request: ClaritiRequest): WorkspaceSession {
  const label = getClaritiKindMeta(request.kind);
  const persisted = request.persisted as { session?: { id?: string; title?: string } } | undefined;
  const sessionTitle = persisted?.session?.title;
  const displayTitle = sessionTitle ? cleanSessionTitle(sessionTitle, request.kind) : label.title;
  return {
    id: persisted?.session?.id ?? request.documentId ?? request.kind,
    kind: request.kind,
    dbSessionId: persisted?.session?.id,
    title: displayTitle,
    tag: label.tag,
    fileName: request.fileName || `${request.kind.replaceAll("_", "-")}.txt`,
    meta: request.fileName ? `Attached document · ${request.fileName}` : "Attached text document",
    preview: buildSessionPreview(request.question, label.title, request.fileName),
  };
}

function toRecentWorkspaceSession(session: {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  updated_at: string;
  question?: string | null;
  parent_session_id?: string | null;
}): RecentWorkspaceSession {
  const kind = inferKindFromTitleText(`${session.title} ${session.question ?? ""}`);
  const category = getClaritiKindMeta(kind).title;
  const title = cleanSessionTitle(session.title, kind);
  const updatedAt = new Date(session.updated_at);
  const date = Number.isFinite(updatedAt.getTime()) ? updatedAt.toLocaleDateString() : "";
  const meta = [category, date].filter(Boolean).join(" · ");
  const createdAt = session.created_at ? new Date(session.created_at).getTime() : updatedAt.getTime();

  return {
    id: session.id,
    kind,
    title,
    meta,
    preview: buildSessionPreview(session.question, category, session.title),
    fileName: session.title,
    parentId: session.parent_session_id ?? null,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
  };
}

type SidebarSessionItem = RecentWorkspaceSession | WorkspaceSession;

type SidebarGroup = {
  key: string;
  title: string;
  meta: string;
  kind: ClaritiAnalysisKind;
  pending: boolean;
  containsActive: boolean;
  head: SidebarSessionItem;
  items: SidebarSessionItem[];
};

function sidebarItemParentId(item: SidebarSessionItem): string | null {
  return "parentId" in item ? item.parentId ?? null : null;
}

function sidebarItemCreatedAt(item: SidebarSessionItem): number {
  return "createdAt" in item && typeof item.createdAt === "number" ? item.createdAt : Number.MAX_SAFE_INTEGER;
}

const FOLLOW_UP_TITLE_PREFIX = /^follow[\s-]?up\s+/i;

function groupSidebarSessions(sessions: SidebarSessionItem[], activeId?: string | null): SidebarGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, SidebarSessionItem[]>();

  for (const item of sessions) {
    const key = sidebarItemParentId(item) ?? item.id;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }

  return order.map((key) => {
    const items = buckets.get(key)!;
    const head = items[0];
    const sortedByDate = [...items].sort((a, b) => sidebarItemCreatedAt(a) - sidebarItemCreatedAt(b));
    const root = items.find((item) => item.id === key) ?? sortedByDate[0];
    const category = getClaritiKindMeta(root.kind).title;
    const title = root.title.replace(FOLLOW_UP_TITLE_PREFIX, "");

    return {
      key,
      title,
      meta: items.length > 1 ? `${category} · ${items.length} reports` : root.meta,
      kind: head.kind,
      pending: "pending" in head ? Boolean(head.pending) : false,
      containsActive: activeId != null && items.some((item) => item.id === activeId),
      head,
      items: sortedByDate,
    };
  });
}

function SidebarGroupRow({
  group,
  activeSidebarId,
  expanded,
  onToggle,
  onSelect,
}: {
  group: SidebarGroup;
  activeSidebarId: string | null;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (item: SidebarSessionItem) => void;
}) {
  return (
    <div className={`conversation-group ${activeSidebarId === group.head.id ? "active" : group.containsActive ? "has-active" : ""} ${group.pending ? "pending" : ""}`}>
      <button className="conversation-group-main" onClick={() => onSelect(group.head)}>
        <span className={`file-icon file-icon-${group.kind}`}>{sidebarIcon(group.kind)}</span>
        <span>
          <b>{group.title}</b>
          <small>{group.meta}</small>
        </span>
      </button>
      {group.items.length > 1 ? (
        <button
          type="button"
          className="conversation-group-toggle"
          aria-label={expanded ? "Collapse history" : "Expand history"}
          onClick={onToggle}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </button>
      ) : (
        <MoreHorizontal />
      )}
      {expanded && (
        <div className="conversation-subgroup">
          {group.items.map((item, index) => (
            <button
              key={item.id}
              className={`conversation-subrow ${activeSidebarId === item.id ? "active" : ""}`}
              onClick={() => onSelect(item)}
            >
              <span>{sidebarItemCreatedAt(item) !== Number.MAX_SAFE_INTEGER ? new Date(sidebarItemCreatedAt(item)).toLocaleDateString() : item.meta}</span>
              <small>{index === 0 ? "Original" : "Follow-up"}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function toPendingWorkspaceSession(request: ClaritiRequest): RecentWorkspaceSession {
  const category = getClaritiKindMeta(request.kind).title;
  const sourceTitle = request.fileName ?? request.question;
  return {
    id: pendingSessionKey(request),
    kind: request.kind,
    title: cleanSessionTitle(sourceTitle, request.kind),
    meta: `${category} · Analyzing...`,
    preview: `In progress · ${truncateMiddle(request.question, 54)}`,
    fileName: request.fileName ?? sourceTitle,
    pending: true,
    request,
  };
}

function toRecentWorkspaceSessionFromAnalysis(request: ClaritiRequest, analysis: ClaritiAnalysis, persisted: unknown): RecentWorkspaceSession {
  const saved = persisted as { session?: { id?: string; title?: string; status?: string; updated_at?: string } } | null;
  const sessionId = saved?.session?.id ?? pendingSessionKey(request);
  const category = getClaritiKindMeta(analysis.kind).title;

  return {
    id: sessionId,
    kind: analysis.kind,
    title: cleanSessionTitle(saved?.session?.title ?? analysis.title, analysis.kind),
    meta: `${category} · Ready`,
    preview: buildSessionPreview(request.question, category, analysis.title),
    fileName: request.fileName ?? analysis.title,
  };
}

function pendingSessionKey(request: ClaritiRequest) {
  return `pending-${request.documentId ?? request.createdAt ?? request.fileName ?? request.kind}`;
}

function cleanSessionTitle(title: string, kind: ClaritiAnalysisKind) {
  const fallback = getClaritiKindMeta(kind).title;
  const cleaned = title
    .replace(/\.(pdf|txt|png|jpe?g|webp)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;
  const generic = /^(medical bill|insurance eob|radiology report|lab results|discharge summary|medication list|pathology report|referral letter|visit notes|prior authorization|health document)$/i.test(cleaned);
  return generic ? fallback : truncateMiddle(cleaned, 42);
}

function buildSessionPreview(question: string | null | undefined, category: string, fallback?: string) {
  const source = question?.trim() || fallback?.trim() || category;
  const normalized = source.replace(/\s+/g, " ");
  return `${category} · ${truncateMiddle(normalized, 54)}`;
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const keep = Math.max(8, Math.floor((maxLength - 3) / 2));
  const tail = Math.max(8, maxLength - keep - 3);
  return `${value.slice(0, keep)}...${value.slice(value.length - tail)}`;
}

function sidebarIcon(kind: ClaritiAnalysisKind) {
  if (kind === "radiology_report" || kind === "pathology_report") return <FileHeart />;
  if (kind === "insurance_eob" || kind === "prior_authorization") return <ShieldCheck />;
  if (kind === "lab_results") return <FlaskConical />;
  if (kind === "discharge_summary") return <Hospital />;
  if (kind === "medication_context") return <Pill />;
  if (kind === "visit_notes" || kind === "referral_letter") return <ClipboardList />;
  if (kind === "unknown") return <FileText />;
  return <ReceiptText />;
}
