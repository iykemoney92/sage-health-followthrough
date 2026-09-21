"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  FileDown,
  FileHeart,
  FileText,
  Flag,
  FlaskConical,
  FolderOpen,
  History,
  Hospital,
  Image as ImageIcon,
  Layers,
  Link2,
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
import {
  FLUX_MAX_CHAINED_SEGMENTS,
  FLUX_MAX_CLIP_SECONDS,
  formatHumanVideoError,
  recommendExplainerSeconds,
  segmentsForExplainerSeconds,
} from "@/lib/ai/clariti-video";
import { getClaritiKindMeta, inferKindFromTitleText, isClaritiAnalysisKind } from "@/lib/domain/clariti-document-kinds";
import type { ProgressionComparison } from "@/lib/domain/clariti-progression";
import { THREAD_EVIDENCE_RULE, type ThreadDocument } from "@/lib/domain/clariti-threads";
import {
  flagSeverityToToken,
  trendToSeverityToken,
  type ClaritiFlagSeverity,
  type ClaritiSeverityToken,
} from "@/lib/domain/clariti-severity";
// Event names and non-clinical params only. The document kind is a health category, and
// sending it to GA against an identifiable visitor makes it Art. 9 special-category data,
// which needs explicit consent for that purpose — the cookie banner's generic Accept is
// not that, and /privacy describes analytics as screens and features. The event names on
// their own still give the funnel its counts.
import { track } from "@/lib/analytics";
import { FlagCard } from "@/components/clariti/flag-card";
import { MetricChip } from "@/components/clariti/metric-chip";
import { KeyPointList } from "@/components/clariti/key-point-list";
import { AnalysisTeaserCard } from "@/components/clariti/analysis-teaser-card";
import { prepareDocumentForUpload, readDocumentApiResponse } from "@/components/clariti/document-upload";
import { buildFallbackAnalysis, inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";

type Drawer = "chats" | "documents" | "history";
type CanvasTab = "summary" | "detail" | "actions";
type Sheet = "followup" | "source" | null;
/**
 * Why a document is being attached, carried from the control the reader actually pressed.
 *
 * "thread" is the only value that files the document into the open story, and only the
 * rail's labelled button sets it. The intent is threaded through rather than inferred from
 * whichever session happens to be open: inferring it is what made the composer's paperclip
 * and the camera silently link every attachment into the thread on screen, so a dermatology
 * letter attached while a cardiology thread was open became part of that story without
 * anybody saying so — and every later answer then reasoned across both.
 */
type AttachIntent = "standalone" | "thread";
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
  | { type: "comparison"; id: string; sortAt: number; comparison: ProgressionComparison; comparedBecause: string[] }
  // /api/compare's own words for why it will not compare two documents. It belongs in the
  // conversation and not in a toast: it is an explanation the reader may want to act on,
  // and three seconds is not long enough to read a paragraph that says "nothing these two
  // share came through".
  | { type: "compare-note"; id: string; sortAt: number; message: string }
  | { type: "upgrade"; id: string; sortAt: number; message: string };
type FollowUpDraft = {
  action: string;
  email?: string;
  timingText?: string;
};
function isPlusRequiredPayload(payload: unknown): payload is { error: "plus_required"; message?: string; upgradeUrl?: string } {
  return Boolean(payload) && typeof payload === "object" && (payload as { error?: unknown }).error === "plus_required";
}

/** The 403 from lib/ai-consent.ts, which withdrawing consent in Settings turns on. */
function isConsentRequiredPayload(payload: unknown): payload is { error: "consent_required" } {
  return Boolean(payload) && typeof payload === "object" && (payload as { error?: unknown }).error === "consent_required";
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
  /** Whether the saved analysis was the regex fallback rather than a model answer. */
  degraded?: boolean;
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

/**
 * One row of the thread rail: a document that belongs to this session. clariti_session_documents
 * has always been a many-to-many join, so a session is structurally a thread already — the
 * workspace simply only ever read the first row of it.
 */
type ThreadDocumentRow = {
  id: string;
  kind: ClaritiAnalysisKind;
  fileName: string;
  createdAt: number | null;
};

/**
 * A document Clariti believes belongs in this thread, and the reasons it matched. The
 * document half is the shared ThreadDocument the scorer reads, so the two cannot drift.
 *
 * Reasons, never a score: "both mention claim 4471-002" is something a person can check and
 * overrule, and 0.82 is not. Nothing here is a link until they tap Add — see ThreadPanel.
 */
type ThreadLinkSuggestion = {
  document: Pick<ThreadDocument, "id" | "kind" | "title">;
  createdAt: number | null;
  reasons: string[];
};

/**
 * A thread Clariti looked at and would not propose. Carried so the rail can say "this looks
 * adjacent and Clariti will not call it" instead of an empty list, which reads as "you have
 * nothing else about this".
 */
type ThreadUncertainty = {
  id: string;
  title: string;
  whyNot: string;
};

/**
 * Two documents in one thread that do not say the same thing. Two different amounts owed is
 * the most useful thing this product can catch, so it is surfaced — but only when the API
 * says so. The workspace does not work out for itself what disagrees.
 */
type ThreadDisagreement = {
  id: string;
  label: string;
  note: string | null;
  values: Array<{ documentTitle: string; value: string }>;
};

/** Said before a locally built analysis so the first thing read is not a confident one. */
const DEGRADED_ANALYSIS_NOTE =
  "I could not finish the full explanation of this document. What follows is only wording Clariti could pick out of the text itself, so please read it as a rough index rather than an explanation.";

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
  // True when the analysis on screen is the regex fallback rather than a model answer —
  // either because /api/analyze substituted one, or because this page built one itself.
  const [degradedAnalysis, setDegradedAnalysis] = useState(false);
  const [paywalled, setPaywalled] = useState(false);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<{ id: string; createdAt: number; message: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpText, setFollowUpText] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoScene, setVideoScene] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  // Which pipeline the job actually ran. Four are possible and they produce visibly
  // different things, so every line of progress copy is derived from this rather than
  // assumed — the copy used to narrate five stitched scenes whatever was really running.
  const [videoPipeline, setVideoPipeline] = useState<string | null>(null);
  // The segments the job has finished. A chained run can render every segment
  // and still be unable to offer one file, and the copy for that tells the reader
  // their segments are saved — so the workspace has to be able to show them.
  const [videoSegments, setVideoSegments] = useState<VideoSegment[]>([]);
  const [videoSegmentCount, setVideoSegmentCount] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedIllustrations, setGeneratedIllustrations] = useState<Record<number, GeneratedIllustration>>({});
  const [expandedIllustration, setExpandedIllustration] = useState<GeneratedIllustration | null>(null);
  const [illustrationGenerating, setIllustrationGenerating] = useState(false);
  const [illustrationError, setIllustrationError] = useState<string | null>(null);
  const [followAction, setFollowAction] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpDraft | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [compareAvailable, setCompareAvailable] = useState(false);
  const [comparisonCards, setComparisonCards] = useState<Array<{
    id: string;
    createdAt: number;
    comparison: ProgressionComparison;
    /** Why /api/compare paired these two. Empty when the route did not say. */
    comparedBecause: string[];
  }>>([]);
  // What /api/compare said when it declined to compare, in its own words. Kept beside the
  // cards rather than inside them: a refusal is not a comparison with empty fields.
  const [comparisonNote, setComparisonNote] = useState<{ id: string; createdAt: number; message: string } | null>(null);
  const [replacingDocument, setReplacingDocument] = useState(false);
  // The documents in this session, oldest first. Empty until a saved session is hydrated,
  // and never longer than one for a thread nobody has added to — which is most of them.
  const [threadDocuments, setThreadDocuments] = useState<ThreadDocumentRow[]>([]);
  const [threadSuggestions, setThreadSuggestions] = useState<ThreadLinkSuggestion[]>([]);
  const [threadDisagreements, setThreadDisagreements] = useState<ThreadDisagreement[]>([]);
  const [threadUnsure, setThreadUnsure] = useState<ThreadUncertainty[]>([]);
  // "Not related" is a local refusal, not a saved one: hiding a proposal needs no row, and
  // nobody can apply a migration to this project right now.
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [linkingDocumentId, setLinkingDocumentId] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(true);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    name: string;
    previewUrl: string | null;
    intent: AttachIntent;
  } | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatCameraInputRef = useRef<HTMLInputElement>(null);
  // The rail's "add to this thread" has a file input of its own rather than borrowing the
  // composer's. One input plus a remembered intent would mean a cancelled picker can leave
  // the next paperclip pointing at the thread, and a silent link is the one failure this
  // whole feature exists to prevent.
  const threadFileInputRef = useRef<HTMLInputElement>(null);
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
  // The same regex fallback /api/analyze substitutes when the model call fails, built here
  // for the request that never reached it. It is marked degraded through the same flag, so
  // there is one honest state instead of two that both look finished.
  const localFallbackAnalysis = useMemo(() => {
    if (activeAnalysis || !activeRequest || loading || booting) return null;
    // A Plus refusal is not a failed analysis. Without this the 402 branch leaves
    // `loading` false with no analysis, the regex fallback fills the gap, and the
    // person is told Clariti could not read their document when in fact it simply
    // has not been asked to yet.
    if (paywalled) return null;
    return buildFallbackAnalysis({
      kind: activeRequest.kind,
      question: activeRequest.question,
      documentText: activeRequest.documentText,
    });
  }, [activeAnalysis, activeRequest, booting, loading, paywalled]);
  const analysis = activeAnalysis ?? localFallbackAnalysis;
  const analysisDegraded = Boolean(analysis) && (degradedAnalysis || Boolean(localFallbackAnalysis));
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
    const upgradeItems = upgradePrompt
      ? [{ type: "upgrade" as const, id: upgradePrompt.id, sortAt: upgradePrompt.createdAt, message: upgradePrompt.message }]
      : [];
    const latestMessageAt = messageItems.reduce((max, item) => Math.max(max, item.sortAt), 0);
    const comparisonItems = comparisonCards.map((card, index) => ({
      type: "comparison" as const,
      id: card.id,
      // Always keep progression cards after the related chat bubbles.
      sortAt: Math.max(card.createdAt, latestMessageAt + 1 + index),
      comparison: card.comparison,
      comparedBecause: card.comparedBecause,
    }));
    const compareNoteItems = comparisonNote
      ? [{
        type: "compare-note" as const,
        id: comparisonNote.id,
        sortAt: Math.max(comparisonNote.createdAt, latestMessageAt + 1),
        message: comparisonNote.message,
      }]
      : [];
    return [...messageItems, ...videoItems, ...comparisonItems, ...compareNoteItems, ...upgradeItems].sort((a, b) => {
      if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt;
      // Stable preference: messages → videos → comparison cards → compare note → upgrade offer
      const rank = { message: 0, video: 1, comparison: 2, "compare-note": 3, upgrade: 4 } as const;
      return rank[a.type] - rank[b.type];
    });
  }, [chatMessages, comparisonCards, comparisonNote, generatedVideo, upgradePrompt]);
  // A proposal the reader has refused stays refused for as long as this workspace is open.
  // It is not written down anywhere, so reopening the thread will offer it again — which is
  // the honest behaviour for a decision nobody recorded.
  const visibleThreadSuggestions = useMemo(
    () => threadSuggestions.filter((suggestion) => !dismissedSuggestions.has(suggestion.document.id)),
    [dismissedSuggestions, threadSuggestions],
  );
  // `unsure` is in here deliberately. Attaching a document no longer files it into the open
  // thread by itself, so the rail's labelled button is the only way a reader can say two
  // documents belong together — and the moment that matters most is the one where Clariti
  // has looked at their other paperwork and refused to call it. Showing the refusal without
  // showing the way to overrule it would be telling somebody no with no door in the room.
  const threadPanelVisible = threadDocuments.length > 1
    || visibleThreadSuggestions.length > 0
    || threadDisagreements.length > 0
    || threadUnsure.length > 0;

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
    if (chatCameraInputRef.current) chatCameraInputRef.current.value = "";
    if (threadFileInputRef.current) threadFileInputRef.current.value = "";
  }, []);

  // `intent` has no default: every caller has to say whether this document is joining the
  // open thread, because the one that forgets is the one that links it silently.
  const stageChatAttachment = useCallback((file: File, intent: AttachIntent) => {
    if (pendingAttachmentUrlRef.current) {
      URL.revokeObjectURL(pendingAttachmentUrlRef.current);
      pendingAttachmentUrlRef.current = null;
    }
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    pendingAttachmentUrlRef.current = previewUrl;
    setPendingAttachment({ file, name: file.name, previewUrl, intent });
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
    if (chatCameraInputRef.current) chatCameraInputRef.current.value = "";
    if (threadFileInputRef.current) threadFileInputRef.current.value = "";
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

  // Someone who has just typed a day and a time for a check-in should not be thrown onto a
  // price list with the answer they typed discarded. The offer arrives as a bubble in the
  // thread instead, and the funnel keeps counting the same event it always did.
  const offerPlusUpgrade = useCallback((message?: string) => {
    track("plus_upgrade_redirect", { source: "workspace" });
    setUpgradePrompt({
      id: createLocalId("plus-offer"),
      createdAt: createLocalTimestamp(),
      message: message?.trim() || "That is a Clariti Plus feature.",
    });
  }, []);

  // Someone who withdrew consent in Settings gets the gate again rather than the
  // refusal token. The sessionId lands in the URL through replaceState, so the
  // return path comes from the address bar and not from searchParams.
  const redirectToConsent = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search}`;
    router.push(`/ai-consent?next=${encodeURIComponent(next)}`);
  }, [router]);

  const resetVideoState = useCallback(() => {
    videoGeneratingRef.current = false;
    setGeneratedVideo(null);
    setVideoGenerating(false);
    setVideoStatus(null);
    setVideoProgress(0);
    setVideoPipeline(null);
    setVideoSegments([]);
    setVideoSegmentCount(0);
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
    setVideoPipeline(job.pipeline ?? null);
    setVideoSegments(videoSegmentsOf(job));
    setVideoSegmentCount(videoSegmentCountOf(job));
    setVideoError(job.status === "failed" ? formatHumanVideoError(job.error ?? "The video job failed.") : null);

    if (inFlight && !videoGeneratingRef.current) {
      videoGeneratingRef.current = true;
      setVideoGenerating(true);
      void pollSceneVideoJob(job.id, (status, progress, latest) => {
        if (dbSessionIdRef.current !== sessionId) return;
        setVideoStatus(status);
        setVideoProgress(progress);
        setVideoSegments(videoSegmentsOf(latest));
        setVideoSegmentCount(videoSegmentCountOf(latest));
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
    // Below the guard on purpose: a re-entrant call is the same analysis, not a new one.
    track("analysis_started");

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
          offerPlusUpgrade(payload.message);
          setPaywalled(true);
          setLoading(false);
        }
        return;
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Analysis failed");
      const analysis = payload.analysis as ClaritiAnalysis;
      const savedSessionId = payload.persisted?.session?.id as string | undefined;
      track("analysis_completed", { reused: Boolean(payload.reused) });
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
      setDegradedAnalysis(Boolean(payload.degraded));
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
      showToast(payload.degraded
        ? "Clariti could not finish the full explanation — see the note on the analysis."
        : payload.reused
          ? "Clariti restored your existing analysis."
          : "Clariti generated a source-grounded analysis.");
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
            // This is the client's own regex fallback, not a model answer. Without
            // this flag the route stores it as genuine and then serves it from the
            // reuse cache for ever — which is the exact failure the degraded band
            // exists to make visible.
            degraded: true,
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
      setDegradedAnalysis(true);
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
        : [...current, {
          id: createLocalId("fallback-assistant"),
          role: "assistant",
          content: `${DEGRADED_ANALYSIS_NOTE}\n\n${buildInitialAnalysisReply(fallbackAnalysis)}`,
          createdAt: createLocalTimestamp(),
        }]);
      // No toast here: it used to say the full AI pass was still finishing, and nothing was
      // running. The band on the analysis is the durable, honest version of that message.
    } finally {
      if (analyzeInFlightRef.current === fingerprint) analyzeInFlightRef.current = null;
      if (stillCurrentRequest(activeRequestRef.current)) setLoading(false);
    }
  }, [offerPlusUpgrade, showToast]);

  // force: true so the re-run cannot be answered out of the reuse cache — a degraded
  // analysis is exactly the one nobody should be handed a second time.
  const retryAnalysis = useCallback(async () => {
    const request = activeRequestRef.current;
    if (!request || retryingAnalysis) return;
    setRetryingAnalysis(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: request.kind,
          question: request.question,
          documentText: request.documentText,
          fileName: request.fileName,
          documentId: request.documentId,
          force: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 402 && isPlusRequiredPayload(payload)) {
        offerPlusUpgrade(payload.message);
        return;
      }
      if (response.status === 403 && isConsentRequiredPayload(payload)) {
        redirectToConsent();
        return;
      }
      if (!response.ok || !payload?.ok || !payload.analysis) {
        showToast("Clariti still could not produce the full explanation. Please try again in a moment.");
        return;
      }
      const nextAnalysis = payload.analysis as ClaritiAnalysis;
      const savedSessionId = payload.persisted?.session?.id as string | undefined;
      setActiveAnalysis(nextAnalysis);
      setDegradedAnalysis(Boolean(payload.degraded));
      setActiveRequest((current) => current
        ? { ...current, analysis: nextAnalysis, persisted: payload.persisted, status: "done" }
        : current);
      if (savedSessionId) {
        clearStoredRequest();
        dbSessionIdRef.current = savedSessionId;
        setDbSessionId(savedSessionId);
        bootHandledRef.current = `session:${savedSessionId}`;
        window.history.replaceState(null, "", `/workspace?sessionId=${savedSessionId}`);
      }
      showToast(payload.degraded
        ? "Clariti still could not produce the full explanation."
        : "Clariti finished the full explanation.");
    } catch {
      showToast("Clariti could not reach the analysis service. Check your connection and try again.");
    } finally {
      setRetryingAnalysis(false);
    }
  }, [offerPlusUpgrade, redirectToConsent, retryingAnalysis, showToast]);

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
      setThreadDocuments(threadRowsFromDbSession(sessionPayload));
      setDismissedSuggestions(new Set());
      void hydrateGeneratedVideo(sessionPayload.id);
      setActiveAnalysis(dbRequest.analysis ?? null);
      setDegradedAnalysis(dbRequest.degraded === true);
      // A stale upgrade bubble belongs to the conversation it fired in, not to
      // whichever one is opened next.
      setUpgradePrompt(null);
      setPaywalled(false);
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
      // Beside resetVideoState for the same reason: whatever is about to be hydrated, the
      // thread on screen belongs to the session being left.
      setThreadDocuments([]);
      setDismissedSuggestions(new Set());

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
              setDegradedAnalysis(false);
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
            setDegradedAnalysis(false);
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
          setDegradedAnalysis(false);
          setLoading(false);
          bootHandledRef.current = fingerprint ? `pending:${fingerprint}` : "empty";
        } else if (alive) {
          setActiveRequest(null);
          setActiveAnalysis(null);
          setDegradedAnalysis(false);
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
    // /api/compare's refusal was written about two other documents.
    setComparisonNote(null);
    if ("pending" in item && item.pending && item.request) {
      dbSessionIdRef.current = null;
      setDbSessionId(null);
      activeRequestRef.current = item.request;
      setActiveRequest(item.request);
      setActive(item.kind);
      setActiveAnalysis(item.request.analysis ?? null);
      setDegradedAnalysis(item.request.degraded === true);
      setUpgradePrompt(null);
      setPaywalled(false);
      setChatMessages(messagesFromRequest(item.request));
      setThreadDocuments([]);
      setDismissedSuggestions(new Set());
      resetVideoState();
      setLoading(!item.request.analysis);
      setCanvasTab("summary");
      setDrawer(null);
      setCanvasOpen(false);
      return;
    }
    if (item.id !== dbSessionId) {
      bootHandledRef.current = null;
      // Cleared before the push, not after the hydrate: otherwise the rail shows the
      // documents of the thread that was open until the new one finishes loading.
      setThreadDocuments([]);
      setDismissedSuggestions(new Set());
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
    track("video_generated");
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
    setVideoPipeline(null);
    setVideoSegments([]);
    setVideoSegmentCount(0);
    setCanvasOpen(false);
    try {
      const job = await createSceneVideoJob(analysis, durationSeconds, sessionId);
      setVideoStatus(job.status);
      setVideoProgress(job.progress ?? 5);
      setVideoPipeline(job.pipeline ?? null);
      setVideoSegmentCount(videoSegmentCountOf(job));
      const completed = await pollSceneVideoJob(job.id, (status, progress, latest) => {
        setVideoStatus(status);
        setVideoProgress(progress);
        setVideoSegments(videoSegmentsOf(latest));
        setVideoSegmentCount(videoSegmentCountOf(latest));
      });
      if (!completed.videoUrl) throw new Error("The video job completed without a video URL.");
      handleVideoGenerated(completed.videoUrl, completed.id, videoJobCreatedAt(completed));
    } catch (error) {
      if (error instanceof Error && "consentRequired" in error) {
        setCanvasOpen(false);
        redirectToConsent();
      } else if (error instanceof Error && "plusRequired" in error) {
        setCanvasOpen(false);
        offerPlusUpgrade(error.message);
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
      track("illustration_generated");
    } catch (error) {
      if (error instanceof Error && "consentRequired" in error) {
        redirectToConsent();
        return;
      }
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
        offerPlusUpgrade(payload.message);
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
      // A thread holding a second document already has something to compare against, and it
      // is usually the best partner there is — the bill and the EOB for the same visit.
      if (threadDocuments.length > 1) {
        if (alive) setCompareAvailable(true);
        return;
      }
      // No kind filter any more. Kind was the old comparison rule and it was wrong in both
      // directions; whether two documents can be compared is /api/compare's question, and it
      // now answers "nothing these two share" rather than comparing them anyway.
      const params = new URLSearchParams({ excludeSessionId: dbSessionId, limit: "1" });
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
  }, [analysis, dbSessionId, threadDocuments.length]);

  // The thread's own rows come from /api/sessions, which has always returned every linked
  // document — nothing new is needed on the server to show the story.
  const refreshThread = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const payload = response.ok ? await response.json().catch(() => null) : null;
      if (dbSessionIdRef.current !== sessionId) return;
      if (payload?.ok && payload.session) setThreadDocuments(threadRowsFromDbSession(payload.session as DbWorkspaceSession));
    } catch {
      // A thread that cannot be re-read keeps the rows already on screen. Emptying the rail
      // would say the documents are gone, and a dropped request is not that.
    }
  }, []);

  // Suggestions and disagreements are the one part of this that a route has to compute, and
  // a route that is not there yet answers 404. That is a workspace with no proposals in it,
  // not a broken one — so it fails quiet rather than putting an error over the thread.
  const loadThreadInsights = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/threads?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const payload = response.ok ? await response.json().catch(() => null) : null;
      if (dbSessionIdRef.current !== sessionId) return;
      // suggestThreadLinks returns an object — { proposals, unsure } — so the route may hand
      // it over whole under one key or spread across two. Reading `suggestions` as an array
      // without checking is how a populated answer renders as an empty rail.
      const bundle = unwrapThreadSuggestions(payload);
      setThreadSuggestions(payload?.ok ? normalizeThreadSuggestions(bundle.proposals) : []);
      setThreadDisagreements(payload?.ok ? normalizeThreadDisagreements(payload.disagreements) : []);
      setThreadUnsure(payload?.ok ? normalizeThreadUncertainty(bundle.unsure) : []);
    } catch {
      setThreadSuggestions([]);
      setThreadDisagreements([]);
      setThreadUnsure([]);
    }
  }, []);

  useEffect(() => {
    if (!dbSessionId) {
      setThreadSuggestions([]);
      setThreadDisagreements([]);
      setThreadUnsure([]);
      return;
    }
    void loadThreadInsights(dbSessionId);
    // threadDocuments.length is in here so a document that has just joined the thread is
    // scored against the rest of it instead of being proposed again.
  }, [dbSessionId, loadThreadInsights, threadDocuments.length]);

  // Never called on Clariti's own initiative: a proposal becomes a link when the reader taps
  // Add. Silently deciding a dermatology letter belongs in a cardiology thread would have the
  // agent reason across documents that do not belong together and state relationships that do
  // not exist — the same failure as a confident wrong answer, with more surface area.
  const acceptThreadLink = async (suggestion: ThreadLinkSuggestion) => {
    if (!dbSessionId || linkingDocumentId) return;
    setLinkingDocumentId(suggestion.document.id);
    try {
      // PATCH /api/sessions, not a write of its own: thread membership is one row in
      // clariti_session_documents and that route owns it. Linking shares rather than moves,
      // so accepting here does not empty the thread the document came from.
      const response = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "link", sessionId: dbSessionId, documentId: suggestion.document.id }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 402 && isPlusRequiredPayload(payload)) {
        offerPlusUpgrade(payload.message);
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "");
      }
      setThreadSuggestions((current) => current.filter((item) => item.document.id !== suggestion.document.id));
      await refreshThread(dbSessionId);
      track("thread_link_accepted");
      showToast(`Added ${suggestion.document.title} to this thread.`);
    } catch (caught) {
      showToast(caught instanceof Error && caught.message
        ? caught.message
        : "Clariti could not add that document to this thread. Please try again in a moment.");
    } finally {
      setLinkingDocumentId(null);
    }
  };

  const dismissThreadSuggestion = (suggestion: ThreadLinkSuggestion) => {
    setDismissedSuggestions((current) => new Set(current).add(suggestion.document.id));
  };

  const processAttachedDocument = async (
    attachment: { file: File; name: string; previewUrl: string | null; intent: AttachIntent },
    userMessage: string,
  ) => {
    if (replacingDocument) return;
    const file = attachment.file;
    const previousAnalysis = analysis;
    const previousSessionId = dbSessionId;
    // The only place a thread link can be created by attaching. It needs the reader to have
    // pressed the rail's labelled button *and* a thread to put the document in; anything
    // else — the paperclip, the camera, the follow-up button — is a document of its own.
    const joinsThread = attachment.intent === "thread" && Boolean(previousSessionId);
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
      // Shrink the photo, or say plainly that the PDF is too big, before either request goes
      // out. An oversize body is rejected by the edge with a non-JSON 413 the routes never see.
      const prepared = await prepareDocumentForUpload(file);
      if (!prepared.ok) throw new Error(prepared.error);
      const uploadReadyFile = prepared.file;

      const formData = new FormData();
      formData.set("file", uploadReadyFile);
      const extractResponse = await fetch("/api/documents/extract", { method: "POST", body: formData });
      const extractPayload = await readDocumentApiResponse(extractResponse);
      const extractedText = String(extractPayload.extractedText ?? "");
      if (!extractResponse.ok || !extractPayload.ok || !extractedText.trim()) {
        throw new Error(extractPayload.error ?? "Could not read that document.");
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
        uploadForm.set("file", uploadReadyFile);
        uploadForm.set("kind", kind);
        uploadForm.set("extractedText", documentText);
        const uploadResponse = await fetch("/api/documents/upload", { method: "POST", body: uploadForm });
        const uploadPayload = await readDocumentApiResponse(uploadResponse);
        if (!uploadResponse.ok || !uploadPayload.ok || !uploadPayload.document?.id) {
          throw new Error(uploadPayload.error ?? "Clariti could not save this document to your history.");
        }
        documentId = String(uploadPayload.document.id);
      } catch (uploadCaught) {
        // Analysis can still run from the extracted text, so this is not fatal — but it used to
        // be swallowed whole, and a document that never reached history looked like a document
        // that had been saved.
        const reason = uploadCaught instanceof Error
          ? uploadCaught.message
          : "Clariti could not save this document to your history.";
        console.error("[clariti] document upload failed:", reason);
        showToast(`${reason} The analysis still ran from the text Clariti read.`);
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
          // Sent only when the reader pressed the rail's labelled button. Filing a document
          // into a thread is what makes the agent read it together with the rest of that
          // story, so it is a decision a person makes — never one inferred from whichever
          // session happens to be open behind the paperclip.
          threadSessionId: joinsThread ? previousSessionId ?? undefined : undefined,
        }),
      });
      const analyzePayload = await analyzeResponse.json().catch(() => null);
      if (analyzeResponse.status === 402 && isPlusRequiredPayload(analyzePayload)) {
        offerPlusUpgrade(analyzePayload.message);
        return;
      }
      if (!analyzeResponse.ok || !analyzePayload?.ok || !analyzePayload.analysis) {
        throw new Error(analyzePayload?.error ?? "Could not analyze that document.");
      }

      const nextAnalysis = analyzePayload.analysis as ClaritiAnalysis;
      // The thread the route says this document landed in, preferred over the session inside
      // `persisted`. On the reuse path the analysis handed back is the one already saved, so
      // `persisted.session` still names the session the document was first read in — and
      // following that walks the reader out of the thread they just added it to.
      const savedSessionId = threadSessionIdFromAnalyze(analyzePayload)
        ?? (analyzePayload.persisted?.session?.id as string | undefined);
      const savedArtifactId = analyzePayload.persisted?.artifact?.id as string | undefined;
      track("follow_up_report_added");
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
      setDegradedAnalysis(Boolean(analyzePayload.degraded));
      setActive(nextAnalysis.kind);
      // A document that joined the open thread leaves the session — and any video already
      // generated for it — where it was. Only a genuinely new session starts with none.
      if (!savedSessionId || savedSessionId !== previousSessionId) resetVideoState();
      setComparisonCards([]);
      setComparisonNote(null);
      if (savedSessionId) {
        dbSessionIdRef.current = savedSessionId;
        setDbSessionId(savedSessionId);
        window.history.replaceState(null, "", `/workspace?sessionId=${savedSessionId}`);
        setRecentSessions((current) => {
          const saved = toRecentWorkspaceSessionFromAnalysis(nextRequest, nextAnalysis, analyzePayload.persisted);
          const existing = current.find((item) => item.id === savedSessionId);
          // A thread is named for the story, so it keeps the row it already has rather than
          // taking the title of whatever was added to it last. Either way the row is filed
          // under the session now on screen: `saved` can still carry the session this
          // document was first read in.
          const row = existing && joinsThread ? existing : { ...saved, id: savedSessionId };
          return [row, ...current.filter((item) => item.id !== savedSessionId)];
        });
      }

      // The rail has to be re-read whichever way this went: it now shows either this thread
      // with one more document in it, or a new session holding one.
      const sessionOnScreen = savedSessionId ?? previousSessionId;
      if (sessionOnScreen) void refreshThread(sessionOnScreen);
      // Counted only when a document actually joined a thread, so the funnel cannot report
      // consent that nobody gave.
      if (joinsThread) track("thread_document_added");

      // This used to require both documents to be the same kind, which is the defect
      // threading replaces: a bill and its EOB are different kinds and are the single most
      // valuable comparison there is, while a thyroid panel and a diabetes panel are both
      // lab_results and were compared as though they measured the same thing. The gate is
      // now "is there an earlier document to compare against", and /api/compare answers
      // comparison: null when it cannot say what the two share.
      const hasEarlierDocument = Boolean(previousAnalysis && previousSessionId);

      let comparison: ProgressionComparison | null = null;
      let comparedBecause: string[] = [];
      if (hasEarlierDocument) {
        const compareResponse = await fetch("/api/compare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            analysis: nextAnalysis,
            sessionId: savedSessionId,
            // A thread holds many documents, so "not the one I am reading" has to name the
            // artifact. Without it the new reading is its own comparison partner.
            artifactId: savedArtifactId,
            compareSessionId: previousSessionId ?? undefined,
          }),
        });
        const comparePayload = await compareResponse.json().catch(() => null);
        if (compareResponse.status === 402 && isPlusRequiredPayload(comparePayload)) {
          offerPlusUpgrade(comparePayload.message);
        } else if (compareResponse.ok && comparePayload?.ok && comparePayload.comparison) {
          comparison = comparePayload.comparison as ProgressionComparison;
          // The route now says what the pairing rests on. Printing it keeps a comparison
          // the reader accepted off a guess from reading as one Clariti worked out itself.
          comparedBecause = normalizeComparedBecause(comparePayload.comparedBecause);
          track("compare_documents", { trend: comparison.trend });
        } else if (compareResponse.ok && comparePayload?.ok && typeof comparePayload.message === "string" && comparePayload.message.trim()) {
          // The route looked and would not compare, and it wrote out why. That is an answer,
          // not an error — and it is the reader's cue to put the two documents in one thread
          // if they know they belong together — so it goes into the conversation where it can
          // be read twice, rather than into a toast that is gone in three seconds.
          setComparisonNote({
            id: createLocalId("compare-note"),
            createdAt: createLocalTimestamp(),
            message: comparePayload.message.trim(),
          });
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
              setComparisonCards([{ id: createLocalId("comparison"), createdAt: comparisonAt, comparison, comparedBecause }]);
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
        setComparisonCards([{ id: createLocalId("comparison"), createdAt: replyAt + 1, comparison, comparedBecause }]);
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
      // The toast clears itself in under three seconds, so the bubble is the only
      // durable answer. Telling someone whose PDF is too large to "try again with
      // a clearer PDF" sends them round the same loop, so the specific reason —
      // the size cap, most often — is what stays on screen.
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("upload-error"),
          role: "assistant",
          content: caught instanceof Error && caught.message
            ? caught.message
            : "I couldn’t read or analyze that document. Try again with a clearer PDF, image, or .txt file.",
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
      `Help me choose the purpose and a safe day/time. Clariti emails my account address${accountEmail ? ` (${accountEmail})` : ""} and cannot send check-ins anywhere else, so do not ask me for an address or a phone number.`;
    await sendMessageToAgent(content, {
      clearInput: false,
      followUpDraftOverride: draft,
      skipFollowUpCapture: true,
      toast: "Email check-in planning added to the chat.",
    });
  };

  const maybeCaptureFollowUpDetails = async (content: string, draft: FollowUpDraft): Promise<"scheduled" | "captured" | "none"> => {
    if (!analysis) return "none";
    // Check-ins only ever go to the account's own address — the route refuses any other — so an
    // address typed into the chat is treated as conversation, not as a destination.
    const email = accountEmail ?? draft.email ?? undefined;
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
      // A platform error page is not JSON, and parsing one unguarded threw a
      // SyntaxError that the catch below would have printed into the chat.
      const payload = await response.json().catch(() => null);
      if (response.status === 402 && isPlusRequiredPayload(payload)) {
        offerPlusUpgrade(payload.message);
        return "none";
      }
      if (!response.ok || !payload?.ok) {
        // Only the 400s this route writes itself are sentences meant for a
        // reader: the wrong address, and an account email that is not confirmed
        // yet. Everything else it returns is a zod flatten() object or a raw
        // Postgres message, which would reach the chat as "[object Object]" or
        // leak the database's own words. Those go to the console instead.
        const actionable = response.status === 400 && typeof payload?.error === "string" ? payload.error : null;
        if (!actionable) {
          console.error("[workspace] check-in save failed", { status: response.status, error: payload?.error });
        }
        throw new Error(actionable ?? "");
      }
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
      track("email_checkin_scheduled");
      return "scheduled";
    } catch (caught) {
      setFollowUpDraft({ ...draft, email, timingText });
      // The route rejects an address that is not the account's own, and refuses until the
      // account email is confirmed. Both are things the person can act on, so the reason
      // goes in the reply rather than being flattened into "try again". Anything else
      // arrives here with no message and falls back to the plain sentence.
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-followup-save-failed"),
          role: "assistant",
          content: caught instanceof Error && caught.message
            ? `I have the check-in details, but I could not save them. ${caught.message}`
            : "I have the check-in details, but I could not save them yet. Please try again in a moment.",
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

        {threadPanelVisible && (
          <ThreadPanel
            documents={threadDocuments}
            suggestions={visibleThreadSuggestions}
            disagreements={threadDisagreements}
            unsure={threadUnsure}
            open={threadOpen}
            busy={replacingDocument}
            linkingDocumentId={linkingDocumentId}
            onToggle={() => setThreadOpen((current) => !current)}
            onAddDocument={() => threadFileInputRef.current?.click()}
            onAccept={(suggestion) => void acceptThreadLink(suggestion)}
            onDismiss={dismissThreadSuggestion}
          />
        )}

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
              return <ProgressionComparisonCard key={item.id} comparison={item.comparison} comparedBecause={item.comparedBecause} />;
            }
            if (item.type === "upgrade") {
              return <PlusUpgradeBubble key={item.id} message={item.message} />;
            }
            if (item.type === "compare-note") {
              return <CompareDeclinedNote key={item.id} message={item.message} />;
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

          {!analysisPending && analysis && analysisDegraded && (
            <DegradedAnalysisBand onRetry={() => void retryAnalysis()} retrying={retryingAnalysis} />
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
              <button
                type="button"
                disabled={replacingDocument}
                onClick={() => chatCameraInputRef.current?.click()}
              >
                Photograph a report
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
                {/* The last thing on screen before the document is read, so it says which of
                    the two things is about to happen. A document that is about to join a
                    story should never be filed into one without the reader seeing it said. */}
                <small>
                  {pendingAttachment.intent === "thread"
                    ? "Ready to send — this joins this thread, and Clariti will read it together with the documents already in it"
                    : "Ready to send — Clariti will read this on its own, with your message"}
                </small>
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
              // "standalone", whatever thread is open behind it: the paperclip is how a
              // document gets read, not how it gets filed into a story.
              if (file) stageChatAttachment(file, "standalone");
            }}
          />
          {/* Separate from the input above on purpose: capture="environment" opens the camera
              straight away, which is what a paper letter needs, and would take the file picker
              away from the PDF that arrived by email. */}
          <input
            ref={chatCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) stageChatAttachment(file, "standalone");
            }}
          />
          {/* The thread rail's own picker, and the only one that stages an attachment with
              "thread" on it. The reader reached it by pressing a button that says the
              document becomes part of this story. */}
          <input
            ref={threadFileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,application/pdf,image/*,text/plain"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) stageChatAttachment(file, "thread");
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
            {analysisDegraded && (
              <DegradedAnalysisBand onRetry={() => void retryAnalysis()} retrying={retryingAnalysis} />
            )}
            <AnalysisCanvas analysis={analysis} tab={canvasTab} videoScene={videoScene} generatedVideoUrl={generatedVideo?.url ?? null} generatedIllustration={generatedIllustrations[videoScene] ?? null} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} videoGenerating={videoGenerating} videoStatus={videoStatus} videoProgress={videoProgress} videoPipeline={videoPipeline} videoSegments={videoSegments} videoSegmentCount={videoSegmentCount} videoError={videoError} onSceneChange={setVideoScene} onGenerateVideo={generateHumanVideo} onGenerateIllustration={generateIllustration} onOpenIllustration={setExpandedIllustration} onCreateQuestionList={createQuestionList} onOpenSource={() => openSheet("source")} />
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
  videoPipeline,
  videoSegments,
  videoSegmentCount,
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
  videoPipeline: string | null;
  videoSegments: VideoSegment[];
  videoSegmentCount: number;
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
  const heroToken = worstFlagSeverityToken(analysis.flags);

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
            <span className={`risk-pill sev-${heroToken}`}>{concernMetric?.value ?? "Review"}</span>
          </section>
          <section className="impression-stats">
            <div><strong>{analysis.keyPoints.length}</strong><span>Key points</span></div>
            <div><strong>{analysis.metrics[0]?.value ?? "Report"}</strong><span>{analysis.metrics[0]?.label ?? "Document"}</span></div>
            <div><strong>{concernMetric?.value ?? "Ask"}</strong><span>{concernMetric?.label ?? "Ask your clinician"}</span></div>
          </section>
          <KeyPointList points={analysis.keyPoints} variant="list" />
          <VideoStoryboard key={analysis.title} analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} jobPipeline={videoPipeline} jobSegments={videoSegments} jobSegmentCount={videoSegmentCount} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
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
          <VideoStoryboard key={analysis.title} analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} jobPipeline={videoPipeline} jobSegments={videoSegments} jobSegmentCount={videoSegmentCount} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
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
          <VideoStoryboard key={analysis.title} analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} jobPipeline={videoPipeline} jobSegments={videoSegments} jobSegmentCount={videoSegmentCount} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
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
          <VideoStoryboard key={analysis.title} analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} jobPipeline={videoPipeline} jobSegments={videoSegments} jobSegmentCount={videoSegmentCount} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      ) : (
        <>
          <section className={analysis.kind === "insurance_eob" || analysis.kind === "prior_authorization" ? "eob-flow" : "clariti-hero-total"}>
            {analysis.metrics.slice(0, 3).map((metric) => <MetricChip {...metric} key={metric.label} />)}
          </section>
          <section className="canvas-card"><h3>In plain English</h3><p>{analysis.plainEnglish}</p></section>
          <KeyPointList points={analysis.keyPoints} variant="list" />
          <VideoStoryboard key={analysis.title} analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} jobPipeline={videoPipeline} jobSegments={videoSegments} jobSegmentCount={videoSegmentCount} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      )}
      {analysis.flags.map((flag) => <FlagCard flag={flag} key={flag.label} />)}
    </div>
  );
}

/**
 * The pill on the clinical hero used to be a hardcoded sev-positive — a green all-clear
 * printed over every radiology and pathology report, including ones carrying urgent
 * flags. It follows the flags now, and with no flags to read it stays neutral rather
 * than reassuring.
 */
function worstFlagSeverityToken(flags: ClaritiAnalysis["flags"]): ClaritiSeverityToken {
  const rank: Record<ClaritiFlagSeverity, number> = { info: 0, check: 1, urgent: 2 };
  const worst = flags.reduce<ClaritiFlagSeverity | null>(
    (current, flag) => (current === null || rank[flag.severity] > rank[current] ? flag.severity : current),
    null,
  );
  return worst ? flagSeverityToToken(worst) : "neutral";
}

/**
 * Shown whenever the analysis on screen came from the regex fallback instead of the
 * model. It has no dismiss control on purpose: there is no state in which this document
 * has been explained, so there is no state in which the band should be gone.
 */
function DegradedAnalysisBand({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <section className="canvas-card flag-card sev-check" role="status" style={{ margin: "14px 0" }}>
      <div className="card-title">
        <AlertTriangle />
        <h3>Clariti could not finish this explanation</h3>
      </div>
      <p>
        The AI pass did not complete, so everything here was assembled from the document&rsquo;s own
        wording by pattern-matching alone. It can miss findings, misread numbers and say nothing
        about the parts that matter most. Read it as a rough index of the document rather than an
        explanation of it, and do not use it to judge whether something needs attention.
      </p>
      <button type="button" className="meta-link-btn" disabled={retrying} onClick={onRetry}>
        {retrying ? <RefreshCw className="spin" /> : <RefreshCw />}
        {retrying ? "Retrying the full explanation..." : "Retry the full explanation"}
      </button>
    </section>
  );
}

/** The Plus offer arrives here rather than at /billing — see offerPlusUpgrade. */
function PlusUpgradeBubble({ message }: { message: string }) {
  return (
    <article className="clariti-chat-turn assistant-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card">
        <div className="message-meta">Clariti</div>
        <p>{message}</p>
        <p>This chat stays exactly where it is — nothing you have typed has been lost.</p>
        <Link href="/billing" className="meta-link-btn" style={{ textDecoration: "none" }}>
          <Sparkles />Start Clariti Plus
        </Link>
        {/* No figure is printed here: a subscription costs a different amount in every
            storefront, and /billing renders the store's own localised price. */}
        <p className="source-grounded-line">The store shows the price in your own currency before anything is charged.</p>
      </div>
    </article>
  );
}

/**
 * /api/compare declining to compare, in the route's own words.
 *
 * It sits in the conversation as an assistant turn because that is what it is: an account
 * of what Clariti looked for and did not find, which the reader can act on by putting the
 * two documents in one thread. A toast takes it away before a paragraph can be read, and a
 * red error would dress an honest answer up as a failure.
 */
function CompareDeclinedNote({ message }: { message: string }) {
  return (
    <article className="clariti-chat-turn assistant-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card">
        <div className="message-meta">Clariti</div>
        <p>{message}</p>
        {/* The door out, named. The route's message invites the reader to overrule this, and a
            thread is the thing that does it: /api/compare compares two documents in one thread
            without needing to work out for itself what they share. */}
        <p>If you know they belong to the same story, put them in one thread — Clariti reads a thread together, and it will compare them once they are in it.</p>
        {/* The bar itself, quoted from the module that applies it, so the reader is told why
            they are being asked rather than left to infer it. */}
        <p className="source-grounded-line">{THREAD_EVIDENCE_RULE}</p>
      </div>
    </article>
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

function ProgressionComparisonCard({ comparison, comparedBecause }: { comparison: ProgressionComparison; comparedBecause: string[] }) {
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
        {comparedBecause.length > 0 && (
          <p className="source-grounded-line">Compared because: {comparedBecause.join(" · ")}</p>
        )}
        <p className="source-grounded-line">{comparison.safetyNote}</p>
      </div>
    </article>
  );
}

function normalizeComparedBecause(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const reasons = (value as { reasons?: unknown }).reasons;
  if (!Array.isArray(reasons)) return [];
  return reasons.filter((reason: unknown): reason is string => typeof reason === "string" && reason.trim().length > 0);
}

/**
 * The thread: the documents in this session, in the order they arrived, plus anything
 * Clariti proposes adding to it.
 *
 * The caller keeps this off screen entirely while the thread holds one document and nothing
 * is proposed. Most threads are one document, and a thread of one should not look like a
 * feature someone failed to use.
 */
function ThreadPanel({
  documents,
  suggestions,
  disagreements,
  unsure,
  open,
  busy,
  linkingDocumentId,
  onToggle,
  onAddDocument,
  onAccept,
  onDismiss,
}: {
  documents: ThreadDocumentRow[];
  suggestions: ThreadLinkSuggestion[];
  disagreements: ThreadDisagreement[];
  unsure: ThreadUncertainty[];
  open: boolean;
  busy: boolean;
  linkingDocumentId: string | null;
  onToggle: () => void;
  onAddDocument: () => void;
  onAccept: (suggestion: ThreadLinkSuggestion) => void;
  onDismiss: (suggestion: ThreadLinkSuggestion) => void;
}) {
  return (
    <section className="clariti-thread-rail" aria-label="Documents in this thread">
      <div className="thread-rail-head">
        <button type="button" className="thread-rail-toggle" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown /> : <ChevronRight />}
          <Layers />
          <span>This thread</span>
          {documents.length > 0 && (
            <small>{documents.length === 1 ? "1 document" : `${documents.length} documents`}</small>
          )}
        </button>
        {/* The one control that files a document into this thread, and it says so on its
            face. The composer's paperclip and the camera read a document on its own; working
            the intent out from whichever thread happened to be open is what linked documents
            without anybody saying they belonged together. */}
        <button
          type="button"
          className="thread-rail-add"
          onClick={onAddDocument}
          disabled={busy}
          title="The document you choose becomes part of this story, and Clariti will read it together with the documents already here."
        >
          <Plus />Add a document to this thread
        </button>
      </div>

      {open && (
        <div className="thread-rail-body">
          {/* Said before the button is pressed rather than after: a thread is what Clariti
              reads together, so the reader has to know that is what they are agreeing to. */}
          <p className="thread-rail-note">
            Anything you add here becomes part of this story, and Clariti will read it together with the
            rest of it. To have a document read on its own instead, use the paperclip under the chat.
          </p>
          {documents.length > 1 && (
            <ol className="thread-doc-list">
              {documents.map((document, index) => {
                const date = formatThreadDate(document.createdAt);
                return (
                  <li key={document.id}>
                    <span className="thread-doc-step" aria-hidden="true">{index + 1}</span>
                    <span className={`file-icon file-icon-${document.kind}`}>{sidebarIcon(document.kind)}</span>
                    <span className="thread-doc-meta">
                      <b>{document.fileName}</b>
                      <small>{getClaritiKindMeta(document.kind).title}{date ? ` · ${date}` : ""}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {disagreements.map((item) => (
            <div className="thread-disagreement" key={item.id} role="status">
              <div className="thread-disagreement-head"><AlertTriangle /><b>{item.label}</b></div>
              <ul>
                {item.values.map((value) => (
                  <li key={`${value.documentTitle}-${value.value}`}>
                    <span>{value.documentTitle}</span>
                    <b>{value.value}</b>
                  </li>
                ))}
              </ul>
              {item.note ? <p>{item.note}</p> : null}
              <p className="thread-disagreement-note">
                These documents do not say the same thing. Clariti is reporting what each one says, not
                deciding which is right.
              </p>
            </div>
          ))}

          {suggestions.map((suggestion) => {
            const kind = isClaritiAnalysisKind(suggestion.document.kind) ? suggestion.document.kind : "unknown";
            const date = formatThreadDate(suggestion.createdAt);
            const linking = linkingDocumentId === suggestion.document.id;
            return (
              <div className="thread-suggestion" key={suggestion.document.id}>
                <div className="thread-suggestion-head">
                  <span className={`file-icon file-icon-${kind}`}>{sidebarIcon(kind)}</span>
                  <span className="thread-doc-meta">
                    <b>{suggestion.document.title}</b>
                    <small>{getClaritiKindMeta(kind).title}{date ? ` · ${date}` : ""}</small>
                  </span>
                </div>
                {/* The reasons, not a score. "Both mention claim 4471-002" is something a
                    person can check and overrule; a confidence number is not. */}
                <p className="thread-suggestion-why">This may belong in this thread because:</p>
                <ul className="thread-reasons">
                  {suggestion.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="thread-suggestion-actions">
                  <button
                    type="button"
                    className="thread-accept"
                    disabled={Boolean(linkingDocumentId)}
                    onClick={() => onAccept(suggestion)}
                  >
                    {linking ? <RefreshCw className="spin" /> : <Link2 />}
                    {linking ? "Adding..." : "Add to this thread"}
                  </button>
                  <button
                    type="button"
                    className="thread-dismiss"
                    disabled={Boolean(linkingDocumentId)}
                    onClick={() => onDismiss(suggestion)}
                  >
                    Not related
                  </button>
                </div>
              </div>
            );
          })}

          {suggestions.length > 0 && (
            // The module exports this sentence so the UI states the bar rather than
            // paraphrasing it into something looser than the code actually applies.
            <p className="thread-rail-note">{THREAD_EVIDENCE_RULE}</p>
          )}

          {unsure.map((item) => (
            <p className="thread-unsure" key={item.id}>
              <b>{item.title}</b> looks adjacent, and Clariti will not call it: {item.whyNot}
            </p>
          ))}
        </div>
      )}
      <style jsx>{`
        .clariti-thread-rail{flex:none;border-bottom:1px solid var(--border);background:#fbfdfc;padding:9px 20px 11px;max-height:42vh;overflow:auto}
        .thread-rail-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .thread-rail-toggle{display:flex;align-items:center;gap:7px;min-width:0;background:none;border:0;padding:2px 0;color:#315b53;font-family:inherit;cursor:pointer}
        .thread-rail-toggle :global(svg){width:13px;height:13px;flex:none}
        .thread-rail-toggle span{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
        .thread-rail-toggle small{color:#78908a;font-size:10px;font-weight:700}
        .thread-rail-add{display:inline-flex;align-items:center;gap:5px;flex:none;border:1px solid #dfe9e5;background:#fff;color:#315b53;border-radius:9px;padding:6px 9px;font-size:10px;font-weight:850;font-family:inherit;cursor:pointer}
        .thread-rail-add :global(svg){width:12px;height:12px}
        .thread-rail-body{display:grid;gap:8px;margin-top:9px}
        .thread-doc-list{list-style:none;display:grid;gap:6px;margin:0;padding:0}
        .thread-doc-list li{display:flex;align-items:center;gap:8px;min-width:0;border:1px solid var(--border);background:#fff;border-radius:10px;padding:7px 9px}
        .thread-doc-step{display:grid;place-items:center;flex:none;width:17px;height:17px;border-radius:999px;background:var(--accent-soft);color:var(--accent-dark);font-size:9px;font-weight:900}
        .thread-doc-meta{display:block;min-width:0}
        .thread-doc-meta b{display:block;color:#243631;font-size:11px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .thread-doc-meta small{display:block;color:#78908a;font-size:10px;margin-top:1px}
        .thread-disagreement{border:1px solid var(--sev-check-border);background:var(--sev-check-bg);border-radius:12px;padding:9px 11px}
        .thread-disagreement-head{display:flex;align-items:center;gap:6px;color:var(--sev-check-fg)}
        .thread-disagreement-head :global(svg){width:13px;height:13px;flex:none}
        .thread-disagreement-head b{font-size:11px;font-weight:900}
        .thread-disagreement ul{list-style:none;display:grid;gap:4px;margin:7px 0 0;padding:0}
        .thread-disagreement li{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11px}
        .thread-disagreement li span{min-width:0;color:#6d7d78;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .thread-disagreement li b{flex:none;color:#243631;font-weight:850}
        .thread-disagreement p{margin:7px 0 0;color:#6d7d78;font-size:10px;line-height:1.45}
        .thread-disagreement .thread-disagreement-note{color:#82908b}
        .thread-rail-note{margin:0;color:#82908b;font-size:10px;line-height:1.5}
        .thread-unsure{margin:0;color:#78908a;font-size:10px;line-height:1.5}
        .thread-unsure b{color:#4c5f5a;font-weight:850}
        .thread-suggestion{border:1px solid #dfe9e5;background:#fff;border-radius:12px;padding:9px 11px}
        .thread-suggestion-head{display:flex;align-items:center;gap:8px;min-width:0}
        .thread-suggestion-why{margin:8px 0 4px;color:#6d7d78;font-size:10px;font-weight:800}
        .thread-reasons{list-style:none;display:grid;gap:3px;margin:0;padding:0}
        .thread-reasons li{position:relative;padding-left:12px;color:#3d514c;font-size:11px;line-height:1.45}
        .thread-reasons li:before{content:"";position:absolute;left:3px;top:7px;width:4px;height:4px;border-radius:999px;background:var(--accent)}
        .thread-suggestion-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
        .thread-accept{display:inline-flex;align-items:center;gap:5px;border:0;background:var(--accent);color:#fff;border-radius:9px;padding:7px 11px;font-size:10px;font-weight:850;font-family:inherit;cursor:pointer}
        .thread-accept :global(svg){width:12px;height:12px}
        .thread-dismiss{border:1px solid var(--border);background:#fff;color:#6d7d78;border-radius:9px;padding:7px 11px;font-size:10px;font-weight:800;font-family:inherit;cursor:pointer}
        .thread-rail-add:disabled,.thread-accept:disabled,.thread-dismiss:disabled{opacity:.55;cursor:not-allowed}
        @media (max-width:900px){.clariti-thread-rail{padding:8px 16px 10px;max-height:38vh}}
        /* The button says what it does, which makes it long. On a phone it takes its own
           line rather than squeezing the thread's name down to an ellipsis. */
        @media (max-width:430px){.thread-rail-head{flex-wrap:wrap}.thread-rail-add{width:100%;justify-content:center}}
      `}</style>
    </section>
  );
}

function threadRowsFromDbSession(session: DbWorkspaceSession): ThreadDocumentRow[] {
  return session.documents
    .map((document) => ({
      id: document.id,
      kind: isAnalysisKind(document.kind) ? document.kind : inferKindFromTitleText(document.file_name),
      fileName: document.file_name,
      createdAt: timestampFromIso(document.created_at) ?? null,
    }))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/**
 * The thread /api/analyze filed this document into, when it filed it into one.
 *
 * Read from the top level first: that is where the reuse path reports it, and that path
 * hands back the analysis already saved, so `persisted` there describes the session the
 * document was first read in rather than the thread it has just joined.
 */
function threadSessionIdFromAnalyze(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const row = payload as { threadSessionId?: unknown; persisted?: { threadSessionId?: unknown } | null };
  if (typeof row.threadSessionId === "string" && row.threadSessionId) return row.threadSessionId;
  const nested = row.persisted?.threadSessionId;
  return typeof nested === "string" && nested ? nested : undefined;
}

/**
 * `suggestThreadLinks` returns an object — `{ proposals, unsure }` — not an array, and the
 * route may hand it over spread across two keys or whole under one. Reading it as an array
 * without looking is how a populated answer renders as an empty rail, which reads to a person
 * as "nothing else of yours is about this": a stronger claim than anybody is entitled to.
 */
function unwrapThreadSuggestions(payload: unknown): { proposals: unknown; unsure: unknown } {
  const empty = { proposals: [] as unknown, unsure: [] as unknown };
  if (!payload || typeof payload !== "object") return empty;
  const row = payload as Record<string, unknown>;
  const bundle = row.suggestions && typeof row.suggestions === "object" && !Array.isArray(row.suggestions)
    ? row.suggestions as Record<string, unknown>
    : null;

  const proposals = Array.isArray(row.proposals)
    ? row.proposals
    : bundle && Array.isArray(bundle.proposals)
      ? bundle.proposals
      // Only a plain array under `suggestions` is read as proposals. An object there is the
      // whole bundle, and rendering that as a list of proposals would show the reader the
      // threads Clariti refused to call as though it had called them.
      : Array.isArray(row.suggestions)
        ? row.suggestions
        : [];

  const unsure = Array.isArray(row.unsure) ? row.unsure : bundle && Array.isArray(bundle.unsure) ? bundle.unsure : [];
  return { proposals, unsure };
}

/**
 * /api/threads is another route's answer, so nothing here trusts its shape. A proposal with
 * no reasons is dropped rather than shown: a link the reader cannot check is the silent
 * auto-link this feature exists to avoid.
 */
function normalizeThreadSuggestions(value: unknown): ThreadLinkSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const nested = row.document && typeof row.document === "object" ? row.document as Record<string, unknown> : row;
    // The id has to be a clariti_documents id: it is what PATCH /api/sessions links by.
    const id = typeof row.documentId === "string"
      ? row.documentId
      : typeof nested.documentId === "string"
        ? nested.documentId
        : typeof nested.id === "string" ? nested.id : null;
    const title = typeof nested.title === "string" ? nested.title.trim() : "";
    const reasons: string[] = Array.isArray(row.reasons)
      ? row.reasons.filter((reason: unknown): reason is string => typeof reason === "string" && reason.trim().length > 0)
      : [];
    if (!id || !title || reasons.length === 0) return [];
    return [{
      document: { id, kind: isClaritiAnalysisKind(nested.kind) ? nested.kind : "unknown", title },
      createdAt: toThreadTimestamp(nested.createdAt ?? row.createdAt),
      reasons,
    }];
  });
}

/**
 * A disagreement with fewer than two sides is not one, so it is dropped rather than printed
 * as a finding about a thread.
 */
function normalizeThreadDisagreements(value: unknown): ThreadDisagreement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const values: Array<{ documentTitle: string; value: string }> = Array.isArray(row.values)
      ? row.values.flatMap((candidate: unknown) => {
        if (!candidate || typeof candidate !== "object") return [];
        const item = candidate as Record<string, unknown>;
        const documentTitle = typeof item.documentTitle === "string" ? item.documentTitle.trim() : "";
        const itemValue = typeof item.value === "string" ? item.value.trim() : "";
        return documentTitle && itemValue ? [{ documentTitle, value: itemValue }] : [];
      })
      : [];
    if (!label || values.length < 2) return [];
    return [{
      id: typeof row.id === "string" ? row.id : `${label}-${index}`,
      label,
      note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
      values,
    }];
  });
}

function normalizeThreadUncertainty(value: unknown): ThreadUncertainty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const title = typeof row.threadTitle === "string" ? row.threadTitle.trim() : typeof row.title === "string" ? row.title.trim() : "";
    const whyNot = typeof row.whyNot === "string" ? row.whyNot.trim() : "";
    // Without the reason this is just a name with a shrug next to it, which tells the
    // reader nothing they can act on.
    if (!title || !whyNot) return [];
    return [{ id: typeof row.threadId === "string" ? row.threadId : `${title}-${index}`, title, whyNot }];
  });
}

function toThreadTimestamp(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return timestampFromIso(value) ?? null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  return null;
}

function formatThreadDate(value: number | null) {
  if (value === null) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "";
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
  jobPipeline,
  jobSegments,
  jobSegmentCount,
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
  jobPipeline: string | null;
  jobSegments: VideoSegment[];
  jobSegmentCount: number;
  videoError: string | null;
  onSceneChange: (scene: number) => void;
  onGenerateVideo: (durationSeconds: number) => Promise<void>;
  onGenerateIllustration: (sceneIndex: number) => Promise<void>;
  onOpenIllustration: (illustration: GeneratedIllustration) => void;
}) {
  const scenes = getVideoStoryboardScenes(analysis);
  const meta = getVideoExplainerMeta(analysis);
  const pipelineShape = videoPipelineShape(jobPipeline);
  // Shown only while there is no single finished file to play. In the shape the
  // chained path saves, the last segment is the whole explainer, so repeating the
  // segments under a finished video would just be the same footage twice.
  const showSegments = !generatedVideoUrl && jobSegments.length > 0;
  // Length is the one thing that moves the bill — Flux charges by the second and every
  // clip past the first is another render — so Clariti proposes a length for this
  // document and the reader picks. It used to ask for a flat twenty seconds whatever
  // the document said, which spent the same money on a one-line result as on a bill.
  const lengthOptions = explainerLengthOptions(analysis);
  const [chosenSeconds, setChosenSeconds] = useState<number | null>(null);
  // A one-clip suggestion is pre-selected: there is no spend to consent to beyond
  // the render they already asked for. A suggestion that costs two or more renders
  // is not — the default tap must not be the expensive one, and on the free tier a
  // multi-clip explainer spends the whole allowance.
  const suggestionCostsExtra = (lengthOptions[0]?.segments ?? 1) > 1;
  const chosenLength = lengthOptions.find((option) => option.seconds === chosenSeconds) ?? lengthOptions[0];
  const durationSeconds = chosenLength.seconds;
  // Nothing is null here — the card always has a length to show. What is withheld is
  // the Generate button, until a multi-render suggestion has actually been picked.
  const lengthNotChosen = suggestionCostsExtra && chosenSeconds === null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const playlistRef = useRef<HTMLVideoElement>(null);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  // Set only by a click, so every play() below follows a gesture. Chaining on `ended`
  // after the reader started the first clip is what mobile autoplay policy allows.
  const chainFromGestureRef = useRef(false);
  // Derived, not corrected in an effect. A new job replaces the clips under the
  // player, so the position has to come back into range rather than point at a URL
  // that is gone — but doing that with setState inside an effect renders once with
  // a stale index first, which is what react-hooks/set-state-in-effect is warning
  // about.
  const safePlaylistIndex = playlistIndex < jobSegments.length ? playlistIndex : 0;

  useEffect(() => {
    if (!chainFromGestureRef.current) return;
    chainFromGestureRef.current = false;
    void playlistRef.current?.play().catch(() => undefined);
  }, [playlistIndex]);

  const generatedSceneIndexes = Object.keys(generatedIllustrations)
    .map((key) => Number(key))
    .filter((index) => Number.isFinite(index) && index >= 0 && index < scenes.length)
    .sort((a, b) => a - b);
  const nextMissingSceneIndex = scenes.findIndex((_, index) => !generatedIllustrations[index]);
  const hasIllustrations = generatedSceneIndexes.length > 0;

  if (scenes.length === 0) return null;
  const scene = scenes[activeScene] ?? scenes[0];
  // The chain is only whole if every planned part came back. `jobSegmentCount` is what
  // the job planned; a segment index past it means the job grew, so take the larger.
  const totalParts = Math.max(jobSegmentCount, jobSegments.length ? jobSegments[jobSegments.length - 1].sceneIndex + 1 : 0);
  // Only once the job has stopped. While it is still rendering, a part that has not
  // arrived has not failed — and telling someone their explainer is incomplete while
  // it is being built is a false alarm in the feature whose whole job is to degrade
  // honestly.
  const missingParts = (generating ? [] : Array.from({ length: totalParts }, (_, part) => part))
    .filter((part) => !jobSegments.some((segment) => segment.sceneIndex === part));
  const missingPartsNote = missingParts.length === 0
    ? null
    : missingParts.length === 1
      ? `part ${missingParts[0] + 1} did not render, so this explainer skips it`
      : `parts ${missingParts.map((part) => part + 1).join(", ")} did not render, so this explainer is incomplete`;
  const playingSegment = jobSegments[safePlaylistIndex] ?? jobSegments[0];
  const playSegment = (index: number) => {
    chainFromGestureRef.current = true;
    setPlaylistIndex(index);
  };
  // One clip ending is the reader's own play still running, so starting the next one
  // reads as a single explainer without asking them to press play four times.
  const playNextSegment = () => {
    if (safePlaylistIndex + 1 >= jobSegments.length) return;
    playSegment(safePlaylistIndex + 1);
  };
  const generateVideo = async () => {
    onSceneChange(0);
    // Event name and non-clinical counters only: the length the reader agreed to and
    // how many renders that is. Nothing here describes the document.
    track("video_length_chosen", {
      seconds: durationSeconds,
      clips: chosenLength.segments,
      suggested: chosenLength.seconds === lengthOptions[0].seconds,
    });
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
            <span>{generating ? `${formatVideoJobStatus(jobStatus, jobPipeline, jobSegmentCount)} · ${jobProgress}%` : "No video yet"}</span>
            <b>{generating ? "Creating your explainer…" : meta.title}</b>
            <small>
              {generating
                ? describeVideoPipeline(pipelineShape, jobSegmentCount)
                : "This box is a preview card, not a video player. Use the button below to generate a short narrated explainer. Rendering usually takes a few minutes, and you can keep reading while it runs."}
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
      {showSegments && (jobSegments.length === 1 ? (
        <div className="video-segment-list">
          <span>Segment saved so far</span>
          <figure key={jobSegments[0].sceneIndex}>
            <video className="clariti-generated-video" src={jobSegments[0].videoUrl} controls playsInline preload="metadata" />
            <figcaption>{`${jobSegments[0].sceneIndex + 1}. ${jobSegments[0].title}`}</figcaption>
          </figure>
        </div>
      ) : (
        <>
          <div className="video-segment-list video-explainer-playlist">
            <span>{`Part ${playingSegment.sceneIndex + 1} of ${totalParts}`}</span>
            <figure>
              <video
                ref={playlistRef}
                className="clariti-generated-video"
                src={playingSegment.videoUrl}
                controls
                playsInline
                preload="metadata"
                onEnded={playNextSegment}
              />
              <figcaption>
                {`${playingSegment.sceneIndex + 1}. ${playingSegment.title}`}
                {missingPartsNote ? ` — ${missingPartsNote}` : ""}
              </figcaption>
            </figure>
          </div>
          <div className="video-scene-strip" aria-label="Explainer parts">
            {Array.from({ length: totalParts }, (_, part) => {
              const index = jobSegments.findIndex((segment) => segment.sceneIndex === part);
              // A part that never rendered is still shown, greyed out. Silently
              // renumbering the clips that survived would read as a whole story.
              if (index < 0) {
                return (
                  <button key={`missing-${part}`} type="button" disabled aria-label={`Part ${part + 1} did not render`}>
                    {part + 1}
                  </button>
                );
              }
              return (
                <button
                  key={jobSegments[index].videoUrl}
                  type="button"
                  className={index === safePlaylistIndex ? "active" : ""}
                  onClick={() => playSegment(index)}
                  aria-label={`Play part ${part + 1}: ${jobSegments[index].title}`}
                >
                  {part + 1}
                </button>
              );
            })}
          </div>
        </>
      ))}
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
      {!generating && (
        <div className="video-segment-list video-length-plan">
          <div className="illustration-prompt-card video-length-card">
            <span><Clock />Before you generate</span>
            <b>{formatExplainerLength(chosenLength)}</b>
            {chosenLength.reasons.map((reason) => <small key={reason}>{reason}</small>)}
            <small>
              {chosenLength.segments > 1
                ? "Each clip is a separate render, and until Clariti is set up to chain them a longer request comes back as the first clip only. Either length counts as one explainer against your plan."
                : "A shorter clip costs less to render, and either length counts as one explainer against your plan."}
            </small>
          </div>
          {lengthOptions.length > 1 && (
            <div className="illustration-actions">
              {lengthOptions.map((option) => (
                <button
                  key={option.seconds}
                  type="button"
                  className={`illustration-generate-btn${option.seconds === durationSeconds ? "" : " secondary"}`}
                  aria-pressed={option.seconds === durationSeconds}
                  onClick={() => setChosenSeconds(option.seconds)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Held until a multi-render length has been picked. A one-clip suggestion
          is pre-selected and this reads exactly as it did before. */}
      <button
        type="button"
        className="video-primary-cta"
        disabled={generating || lengthNotChosen}
        title={lengthNotChosen ? "Choose how long this explainer should be first" : undefined}
        onClick={() => void generateVideo()}
      >
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

/** A length Clariti will offer for an explainer, and what choosing it costs. */
type ExplainerLengthOption = {
  seconds: number;
  segments: number;
  label: string;
  /** Best first, and short enough to read standing at the confirm button. */
  reasons: string[];
};

/** How many of the recommender's reasons fit beside the button before it stops being read. */
const SHOWN_LENGTH_REASONS = 2;

/**
 * What Clariti proposes for this document, its own suggestion first.
 *
 * The number and the reasoning both come from `recommendExplainerSeconds`, so the
 * client cannot drift from what the enqueue route plans. Clariti recommends and
 * the reader decides: Flux bills by the second, every clip past the first is
 * another render, and the whole explainer still only counts as one against the
 * plan — so the shorter answer is always offered beside the suggestion.
 */
/**
 * The longest explainer this deployment will actually produce.
 *
 * Chaining is off until `CLARITI_VIDEO_PIPELINE=chained`, and with it off the
 * enqueue route clamps any request to a single twenty-second clip. Offering
 * "about 45 seconds, 3 clips" while the renderer will return 20 is precisely the
 * over-promise this card exists to prevent, so the options are capped at what the
 * server will honour. Raise this to 80 in the same change that turns chaining on —
 * it is public because the card is client-rendered, and the runbook says to move
 * the two together.
 */
function explainerRenderCeiling() {
  const raw = Number(process.env.NEXT_PUBLIC_CLARITI_VIDEO_MAX_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return FLUX_MAX_CLIP_SECONDS;
  return Math.min(Math.round(raw), FLUX_MAX_CHAINED_SEGMENTS * FLUX_MAX_CLIP_SECONDS);
}

function explainerLengthOptions(analysis: ClaritiAnalysis): ExplainerLengthOption[] {
  const uncapped = recommendExplainerSeconds(analysis);
  const ceiling = explainerRenderCeiling();
  const cappedSeconds = Math.min(uncapped.seconds, ceiling);
  const recommendation = cappedSeconds === uncapped.seconds
    ? uncapped
    : {
        ...uncapped,
        seconds: cappedSeconds,
        segments: segmentsForExplainerSeconds(cappedSeconds),
        // Not the reasons for the longer version. Those argued for seconds this
        // deployment will not render, and leaving them under a shorter number
        // would explain a length nobody is getting.
        reasons: [`Clariti would cover this in about ${uncapped.seconds} seconds, but this app currently renders explainers up to ${ceiling}.`],
      };
  const suggested = buildExplainerLengthOption(
    recommendation.seconds,
    recommendation.segments,
    "Clariti suggests",
    recommendation.reasons.slice(0, SHOWN_LENGTH_REASONS),
  );

  // Past one clip the cheaper answer is the single clip, because the second clip is
  // a whole extra render. Inside one clip it is simply fewer seconds.
  const shorterSeconds = recommendation.segments > 1
    ? FLUX_MAX_CLIP_SECONDS
    : Math.max(recommendation.minSeconds, Math.floor(recommendation.seconds * 0.6 / 5) * 5);
  if (shorterSeconds >= recommendation.seconds) return [suggested];

  return [suggested, buildExplainerLengthOption(
    shorterSeconds,
    segmentsForExplainerSeconds(shorterSeconds),
    "Shorter",
    ["Shorter than Clariti suggests and cheaper to render, at the cost of leaving something out."],
  )];
}

function buildExplainerLengthOption(seconds: number, segments: number, prefix: string, reasons: string[]): ExplainerLengthOption {
  return {
    seconds,
    segments,
    label: `${prefix} · ${seconds}s, ${segments === 1 ? "1 clip" : `${segments} clips`}`,
    reasons,
  };
}

function formatExplainerLength(option: ExplainerLengthOption) {
  return `About ${option.seconds} seconds · ${option.segments === 1 ? "one clip" : `${option.segments} clips`}`;
}

function getEducationDisclaimer(analysis: ClaritiAnalysis) {
  return getClaritiKindMeta(analysis.kind).educationDisclaimer;
}

type VideoJobPayload = {
  id: string;
  status: string;
  progress: number;
  pipeline?: string | null;
  scenes?: unknown;
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
  if (response.status === 403 && isConsentRequiredPayload(payload)) {
    throw Object.assign(new Error("Clariti needs your permission before it can send this analysis to the video model."), { consentRequired: true });
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
  if (response.status === 403 && isConsentRequiredPayload(payload)) {
    throw Object.assign(new Error("Clariti needs your permission before it can send this analysis to the image model."), { consentRequired: true });
  }
  if (!response.ok || !payload.ok || !payload.illustration?.url) {
    throw new Error(payload.error ?? "Clariti could not generate the illustration.");
  }
  return payload.illustration as Omit<GeneratedIllustration, "createdAt">;
}

async function pollSceneVideoJob(
  jobId: string,
  onProgress: (status: string, progress: number, job: VideoJobPayload) => void,
) {
  let processPromise: Promise<VideoJobPayload | null> | null = null;
  // A worker that turns the claim down for quota puts the row back to "queued", which is
  // exactly the state this loop re-kicks. Left unchecked that is a kick every four
  // seconds against a ceiling the caller has already met — spending more of the very
  // budget it is waiting on. The refusal is the answer, so stop and say so.
  //
  // Withdrawn AI consent is the same shape of answer: the worker will keep refusing the
  // claim, and polling it ninety times ends in "still running", which is not what
  // happened. It carries the flag the callers use to send the reader to /ai-consent.
  let refusal: string | null = null;
  let refusalNeedsConsent = false;

  const kickProcess = () => {
    if (processPromise) return;
    processPromise = fetch(`/api/videos/report-explainer/${jobId}?process=1`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (response.status === 429) {
          refusal = String(payload?.error ?? "You have made a lot of requests in a short time. Try again shortly.");
          return null;
        }
        if (response.status === 403 && isConsentRequiredPayload(payload)) {
          refusal = "Clariti needs your permission before it can send this analysis to the video model.";
          refusalNeedsConsent = true;
          return null;
        }
        if (!response.ok || !payload?.ok || !payload.job) return null;
        const job = payload.job as VideoJobPayload;
        onProgress(job.status, job.progress ?? 0, job);
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
    onProgress(job.status, job.progress ?? 0, job);
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new Error(formatHumanVideoError(job.error ?? "The video job failed."));
    if (refusal) {
      throw refusalNeedsConsent
        ? Object.assign(new Error(refusal), { consentRequired: true })
        : new Error(refusal);
    }

    if (job.status === "queued" || isVideoJobStale(job)) {
      kickProcess();
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("The video job is still running. Leave this chat open or try checking again in a moment.");
}

/**
 * The clips a job has finished so far. A chained explainer can render every
 * segment and still have no single file to offer — the message for that says the
 * segments are saved, so they have to be reachable.
 */
type VideoSegment = { sceneIndex: number; title: string; videoUrl: string };

function videoSegmentsOf(job: VideoJobPayload | null | undefined): VideoSegment[] {
  if (!Array.isArray(job?.scenes)) return [];
  return job.scenes
    .map((scene, index) => {
      const item = scene as { sceneIndex?: number; title?: string; status?: string; videoUrl?: string };
      if (item?.status !== "completed" || !item.videoUrl) return null;
      return {
        sceneIndex: Number.isFinite(item.sceneIndex) ? Number(item.sceneIndex) : index,
        title: item.title?.trim() || `Segment ${index + 1}`,
        videoUrl: item.videoUrl,
      };
    })
    .filter((segment): segment is VideoSegment => segment !== null)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);
}

function videoSegmentCountOf(job: VideoJobPayload | null | undefined) {
  return Array.isArray(job?.scenes) ? job.scenes.length : 0;
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

// The four pipelines the job can report, reduced to the four shapes the reader can
// actually see: one clip, several clips continued from each other, the legacy stitched
// cut, and the short single render Veo falls back to. A job that has not said yet is
// "unknown", and the copy for it promises nothing.
type VideoPipelineShape = "flux-single" | "flux-chained" | "stitched" | "single-clip" | "unknown";

function videoPipelineShape(pipeline: string | null | undefined): VideoPipelineShape {
  switch (pipeline) {
    case "flux-single":
      return "flux-single";
    case "flux-chained":
      return "flux-chained";
    case "ai-video-scenes-shotstack":
      return "stitched";
    case "ai-video-job-single-render":
      return "single-clip";
    default:
      return "unknown";
  }
}

function describeVideoPipeline(shape: VideoPipelineShape, segmentCount: number) {
  switch (shape) {
    case "flux-single":
      return "Clariti is rendering one continuous clip of up to twenty seconds, narration included. That usually takes a few minutes.";
    case "flux-chained":
      // A chained job whose explainer fits in one clip is planned as a single
      // segment, so the copy only promises a chain once the job says there is one.
      return segmentCount > 1
        ? "Clariti is rendering the explainer in segments, each one carrying on from the end of the last. A longer explainer takes proportionally longer."
        : "Clariti is rendering one continuous clip, narration included. That usually takes a few minutes.";
    case "stitched":
      return "Clariti is generating five short scenes in parallel, then stitching them into one explainer.";
    case "single-clip":
      return "Clariti is rendering one short explainer clip.";
    default:
      return "Clariti is putting your explainer together.";
  }
}

function formatVideoJobStatus(status: string | null | undefined, pipeline: string | null | undefined, segmentCount: number) {
  const rawShape = videoPipelineShape(pipeline);
  // One segment is one clip whatever the pipeline is called, and saying
  // "segment by segment" over a single render is a promise the job will not keep.
  const shape = rawShape === "flux-chained" && segmentCount <= 1 ? "flux-single" : rawShape;
  const segmented = shape === "flux-chained" || shape === "stitched";
  switch (status) {
    case "queued":
      return shape === "stitched"
        ? "Queued — preparing your 5-scene explainer"
        : shape === "flux-chained"
          ? "Queued — preparing your explainer segments"
          : "Queued — preparing your explainer";
    case "scripting":
      return shape === "stitched" ? "Writing the 5-scene explainer script" : "Writing the explainer script";
    case "generating_scenes":
      return shape === "stitched"
        ? "Creating the five scene clips"
        : shape === "flux-chained"
          ? "Rendering the explainer segment by segment"
          : "Rendering the explainer clip";
    case "stitching":
      return shape === "stitched"
        ? "Stitching the five scenes together"
        : segmented
          ? "Putting the segments together"
          : "Finishing the explainer";
    case "completed":
      return "Video ready";
    case "failed":
      return "Video generation failed";
    default:
      return "Preparing your explainer";
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
  // Off the raw payload: claritiAnalysisSchema does not carry `degraded`, so
  // parsing first would drop the one field that says this analysis is not a real
  // one — and the band would vanish on the next load of a document it was written
  // for.
  const degraded = (artifact?.payload as { degraded?: unknown } | undefined)?.degraded === true;
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
    degraded,
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
