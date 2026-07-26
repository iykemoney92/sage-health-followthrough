"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  FileDown,
  FileHeart,
  FileText,
  Flag,
  FolderOpen,
  History,
  Image as ImageIcon,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Phone,
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
import { buildFallbackAnalysis } from "@/lib/domain/clariti-fallback-analysis";

type Drawer = "chats" | "documents" | "history";
type CanvasTab = "summary" | "detail" | "actions";
type Sheet = "call" | "followup" | "source" | null;
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
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
  | { type: "video"; id: string; sortAt: number; video: GeneratedVideo };
type FollowUpDraft = {
  action: string;
  phoneNumber?: string;
  timingText?: string;
};
type ClaritiRequest = {
  kind: ClaritiAnalysisKind;
  question: string;
  documentText: string;
  fileName?: string;
  documentId?: string;
  createdAt?: number;
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
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
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
  const [callPhoneNumber, setCallPhoneNumber] = useState("");
  const [placingCall, setPlacingCall] = useState(false);
  const activeRequestRef = useRef<ClaritiRequest | null>(null);
  const dbSessionIdRef = useRef<string | null>(null);
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
    return [...messageItems, ...videoItems].sort((a, b) => a.sortAt - b.sortAt);
  }, [chatMessages, generatedVideo]);

  useEffect(() => {
    activeRequestRef.current = activeRequest;
  }, [activeRequest]);

  useEffect(() => {
    dbSessionIdRef.current = dbSessionId;
  }, [dbSessionId]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const resetVideoState = useCallback(() => {
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
    const job = await fetchLatestVideoJob(sessionId).catch(() => null);
    if (dbSessionIdRef.current !== sessionId) return;
    if (!job) {
      resetVideoState();
      return;
    }

    setVideoStatus(job.status);
    setVideoProgress(job.progress ?? 0);
    setVideoError(job.status === "failed" ? formatHumanVideoError(job.error ?? "The video job failed.") : null);
    if (job.status === "completed" && job.videoUrl) {
      setGeneratedVideo((current) => current?.jobId === job.id
        ? current
        : { url: job.videoUrl!, jobId: job.id, createdAt: videoJobCreatedAt(job) });
    } else {
      setGeneratedVideo(null);
    }
  }, [resetVideoState]);

  const analyzeRequest = useCallback(async (request: ClaritiRequest) => {
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
    try {
      const documentText = request.documentText.trim();
      if (!documentText) throw new Error("Missing document text");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, documentText }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Analysis failed");
      const analysis = payload.analysis as ClaritiAnalysis;
      const savedSessionId = payload.persisted?.session?.id as string | undefined;
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
      setActiveRequest((current) => current ? { ...current, analysis, persisted: payload.persisted } : current);
      if (savedSessionId) {
        dbSessionIdRef.current = savedSessionId;
        setDbSessionId(savedSessionId);
        window.localStorage.removeItem(STORAGE_KEY);
        window.history.replaceState(null, "", `/workspace?sessionId=${savedSessionId}`);
      }
      setChatMessages((current) => current.some((message) => message.role === "assistant")
        ? current
        : [...current, { id: createLocalId("analysis-assistant"), role: "assistant", content: buildInitialAnalysisReply(analysis), createdAt: createLocalTimestamp() }]);
      showToast("Clariti generated a source-grounded analysis.");
    } catch {
      const fallbackAnalysis = buildFallbackAnalysis({ ...request, documentText: request.documentText });
      setPendingSessions((current) => current.filter((item) => item.id !== pendingKey));
      if (!stillCurrentRequest(activeRequestRef.current)) {
        showToast("Clariti could not finish that background analysis. Please try again from Home.");
        return;
      }
      setActiveAnalysis(fallbackAnalysis);
      setActiveRequest((current) => current ? { ...current, analysis: fallbackAnalysis } : current);
      setChatMessages((current) => current.some((message) => message.role === "assistant")
        ? current
        : [...current, { id: createLocalId("fallback-assistant"), role: "assistant", content: buildInitialAnalysisReply(fallbackAnalysis), createdAt: createLocalTimestamp() }]);
      showToast("Using source-grounded fallback analysis until the AI service is configured.");
    } finally {
      if (stillCurrentRequest(activeRequestRef.current)) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let alive = true;

    async function loadWorkspace() {
      setBooting(true);
      setLoading(false);
      setActiveAnalysis(null);
      resetVideoState();
      try {
        const requestedSessionId = searchParams.get("sessionId");
        const isNewRequest = searchParams.get("new") === "1";
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const pendingRequest = parseStoredRequest(stored);
        let resolvedSessionId = requestedSessionId;
        const listResponse = await fetch("/api/sessions", { cache: "no-store" });
        const listPayload = listResponse.ok ? await listResponse.json() : null;
        const accountSessions = listPayload?.ok ? listPayload.sessions?.map(toRecentWorkspaceSession) ?? [] : [];
        if (alive) setRecentSessions(accountSessions);

        if (!requestedSessionId && pendingRequest && (isNewRequest || isFreshPendingRequest(pendingRequest)) && alive) {
          dbSessionIdRef.current = null;
          setDbSessionId(null);
          activeRequestRef.current = pendingRequest;
          setActiveRequest(pendingRequest);
          setActive(pendingRequest.kind);
          setCanvasTab("summary");
          setChatMessages(messagesFromRequest(pendingRequest));
          if (pendingRequest.analysis) {
            setActiveAnalysis(pendingRequest.analysis);
          } else {
            void analyzeRequest(pendingRequest);
          }
          return;
        }

        if (!resolvedSessionId && !isNewRequest) {
          resolvedSessionId = listPayload?.ok ? listPayload.sessions?.[0]?.id ?? null : null;
        }

        if (resolvedSessionId) {
          const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(resolvedSessionId)}`);
          const payload = response.ok ? await response.json() : null;
          if (payload?.ok && payload.session) {
            const dbRequest = requestFromDbSession(payload.session as DbWorkspaceSession);
            if (dbRequest && alive) {
              dbSessionIdRef.current = payload.session.id;
              setDbSessionId(payload.session.id);
              activeRequestRef.current = dbRequest;
              setActiveRequest(dbRequest);
              setActive(dbRequest.kind);
              setCanvasTab("summary");
              setChatMessages(messagesFromDbSession(payload.session as DbWorkspaceSession));
              void hydrateGeneratedVideo(payload.session.id);
              if (dbRequest.analysis) {
                setActiveAnalysis(dbRequest.analysis);
              } else {
                void analyzeRequest(dbRequest);
              }
              return;
            }
          }
        }

        const request = pendingRequest;
        if (request && alive) {
          dbSessionIdRef.current = null;
          setDbSessionId(null);
          activeRequestRef.current = request;
          setActiveRequest(request);
          setActive(request.kind);
          setCanvasTab("summary");
          setChatMessages(messagesFromRequest(request));
          if (request.analysis) {
            setActiveAnalysis(request.analysis);
          } else {
            void analyzeRequest(request);
          }
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
      router.push(`/workspace?sessionId=${encodeURIComponent(item.id)}`);
    }
    setActive(item.kind);
    setCanvasTab("summary");
    setDrawer(null);
    setCanvasOpen(false);
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
    setCanvasOpen(false);
    showToast("Video explanation added to the chat.");
  };

  const generateHumanVideo = async (durationSeconds: number) => {
    if (!analysis) return;
    setVideoGenerating(true);
    setVideoError(null);
    setVideoStatus("queued");
    setVideoProgress(5);
    setCanvasOpen(false);
    try {
      const job = await createSceneVideoJob(analysis, durationSeconds, dbSessionId);
      setVideoStatus(job.status);
      setVideoProgress(job.progress ?? 5);
      const completed = await pollSceneVideoJob(job.id, (status, progress) => {
        setVideoStatus(status);
        setVideoProgress(progress);
      });
      if (!completed.videoUrl) throw new Error("The video job completed without a video URL.");
      handleVideoGenerated(completed.videoUrl, completed.id, videoJobCreatedAt(completed));
    } catch (error) {
      const message = formatHumanVideoError(error);
      setVideoError(message);
      showToast(message);
    } finally {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clariti could not generate the illustration.";
      setIllustrationError(message);
      showToast(message);
    } finally {
      setIllustrationGenerating(false);
    }
  };

  const startCall = async () => {
    if (!analysis) {
      showToast("Start an analysis before preparing a call.");
      return;
    }
    if (!dbSessionId) {
      showToast("Save the analysis before placing a call.");
      return;
    }
    if (callPhoneNumber.trim().replace(/[^\d]/g, "").length < 7) {
      showToast("Enter the phone number Clariti should call.");
      return;
    }
    setPlacingCall(true);
    try {
      const response = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: dbSessionId,
          phoneNumber: callPhoneNumber,
          action: `Talk through ${analysis.title} and decide what to ask next.`,
          analysis,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Call failed");
      const savedMessage = payload.message as { id: string; role: string; content: string; created_at?: string } | null;
      setChatMessages((current) => [
        ...current,
        savedMessage ? {
          id: savedMessage.id,
          role: "assistant",
          content: savedMessage.content,
          createdAt: timestampFromIso(savedMessage.created_at) ?? createLocalTimestamp(),
        } : {
          id: createLocalId("call-placed"),
          role: "assistant",
          content: "Calling now. Clariti will keep the call grounded in this saved analysis.",
          createdAt: createLocalTimestamp(),
        },
      ]);
      setSheet(null);
      showToast("Clariti is placing the call now.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Clariti could not place the call.");
    } finally {
      setPlacingCall(false);
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
    const pendingDraft = options?.followUpDraftOverride ?? followUpDraft;
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
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: dbSessionId, content, analysis, followUpDraft: pendingDraft }),
      });
      const payload = await response.json();
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
    await sendMessageToAgent(followUpText.trim());
  };

  const createQuestionList = async () => {
    const content = "Create a concise question list I can ask my clinician about this report. Use only the saved report analysis and source anchors, group questions by priority, and include why each question matters.";
    await sendMessageToAgent(content, { clearInput: false, toast: "Question list added to the chat." });
  };

  const beginFollowUpConversation = async () => {
    if (!analysis || !session) return;
    setSheet(null);
    const action = followAction || analysis.nextActions[0] || "review the report with my clinician";
    const draft = { action };
    setFollowUpDraft(draft);
    const content = `I want to set a phone follow-up about this ${session.tag.toLowerCase()}. Report context: ${analysis.summary}. Suggested action: ${action}. Help me choose the purpose, reason, phone number to call, and a safe time to schedule it.`;
    await sendMessageToAgent(content, {
      clearInput: false,
      followUpDraftOverride: draft,
      skipFollowUpCapture: true,
      toast: "Follow-up planning added to the chat.",
    });
  };

  const maybeCaptureFollowUpDetails = async (content: string, draft: FollowUpDraft): Promise<"scheduled" | "captured" | "none"> => {
    if (!analysis) return "none";
    const phoneNumber = extractPhoneNumber(content) ?? draft.phoneNumber;
    const hasTime = hasSchedulingTime(content);
    const timingText = hasTime ? content : draft.timingText;

    if (!phoneNumber) {
      if (hasTime) {
        setFollowUpDraft({ ...draft, timingText: content });
        return "captured";
      }
      return "none";
    }

    if (!timingText) {
      setFollowUpDraft({ ...draft, phoneNumber });
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
          channel: "phone",
          scheduledFor,
          phoneNumber,
          action: draft.action,
          analysis,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not schedule follow-up");
      setFollowUpDraft(null);
      setCallPhoneNumber(phoneNumber);
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
          content: `Done. I saved ${phoneNumber} for ${new Date(payload.followUp.scheduledFor).toLocaleString()}. Purpose: ${draft.action}.`,
          createdAt: createLocalTimestamp(),
        },
      ]);
      return "scheduled";
    } catch {
      setFollowUpDraft({ ...draft, phoneNumber, timingText });
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-followup-save-failed"),
          role: "assistant",
          content: "I have the follow-up details, but I could not save them yet. Please try again in a moment.",
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
            <h1>{booting ? "Loading saved analysis" : "No active analysis yet"}</h1>
            <p className="clariti-lead">
              {booting
                ? "Clariti is loading your saved session, document, messages and analysis from Supabase."
                : "Ask Clariti about one health document from Home. The workspace will open after there is a saved database session to review."}
            </p>
            {!booting && <Link href="/" className="workspace-empty-cta">Start an analysis</Link>}
          </div>
        </section>
        <style jsx>{`
          .clariti-workspace-empty{display:block;background:#f7f8f7;min-height:100vh;height:auto;overflow:auto}
          .workspace-empty-cta{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#4d8d83;color:#fff;border-radius:12px;padding:12px 16px;font-size:13px;font-weight:800}
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
          {sidebarSessions.map((item) => (
            <button
              key={item.id}
              className={`${(dbSessionId ?? session.id) === item.id ? "active" : ""} ${"pending" in item && item.pending ? "pending" : ""}`}
              onClick={() => selectSession(item)}
            >
              <span className={`file-icon file-icon-${item.kind}`}>{sidebarIcon(item.kind)}</span>
              <span>
                <b>{drawer === "documents" ? item.fileName : item.title}</b>
                <small>{drawer === "history" ? item.preview : item.meta}</small>
              </span>
              <MoreHorizontal />
            </button>
          ))}
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
          <button type="button" className="mobile-call-button" onClick={() => openSheet("call")} aria-label="Discuss with AI"><Phone /></button>
        </header>

        <div className="clariti-chat-scroll" ref={chatScrollRef}>
          <div className="clariti-date-chip">Today</div>
          {chatTimeline.length > 0 ? chatTimeline.map((item) => item.type === "message" ? (
            <ChatMessageBubble
              key={item.id}
              message={item.message}
              session={session}
              showAttachment={item.messageIndex === 0 && item.message.role === "user"}
              showSafetyNote={item.messageIndex === 1 && item.message.role === "assistant"}
              safetyNote={analysis?.safetyNote ?? "Clariti explains document wording and does not diagnose or replace a clinician."}
              active={active}
            />
          ) : (
            analysis ? <GeneratedVideoResponse key={item.id} video={item.video} analysis={analysis} /> : null
          )) : (
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
                <p>Reading your follow-up and checking it against this saved analysis.</p>
                <span className="clariti-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
              </div>
            </article>
          )}

          {!analysisPending && analysis && !generatedVideo && (
            <VideoGenerationPrompt
              analysis={analysis}
              generating={videoGenerating}
              status={videoStatus}
              progress={videoProgress}
              error={videoError}
              onGenerate={() => void generateHumanVideo(30)}
            />
          )}

          {!analysisPending && analysis && artifact && (
            <button className={`chat-artifact-card artifact-${active}`} onClick={() => setCanvasOpen(true)}>
              <span className="artifact-card-top"><span><small>{artifact.eyebrow}</small><b>{artifact.title}</b></span><Sparkles /></span>
              <span className="artifact-card-metric"><strong>{artifact.metric}</strong><small>{artifact.label}</small></span>
              <span className="artifact-card-note"><CheckCircle2 />{artifact.note}</span>
              <span className="artifact-card-cta">View full analysis <span>→</span></span>
            </button>
          )}

        </div>

        {!analysisPending && analysis && !sendingFollowUp && (
          <section className="clariti-thread-actions" aria-label="Continue with Clariti">
            <div>
              <span>Continue with Clariti</span>
              <p>Talk it through or schedule one focused next step.</p>
            </div>
            <div className="clariti-quick-actions">
              <button onClick={() => openSheet("call")}>Call Clariti</button>
              <button onClick={() => void beginFollowUpConversation()}>Set phone follow-up</button>
            </div>
          </section>
        )}

        <div className="clariti-workspace-composer">
          <Link href="/" aria-label="Attach a new document"><Paperclip /></Link>
          <input
            placeholder="Ask a follow-up question..."
            value={followUpText}
            onChange={(event) => setFollowUpText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendFollowUp();
              }
            }}
          />
          <button type="button" className="send" aria-label="Send message" disabled={!followUpText.trim() || sendingFollowUp} onClick={() => void sendFollowUp()}>
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
            <header><div><p className="canvas-kicker">{artifact.eyebrow}</p><h2>{analysis.title}</h2></div>{active === "radiology_report" ? <ImageIcon /> : <Sparkles />}</header>
            <div className="canvas-tabs">
              <button className={canvasTab === "summary" ? "active" : ""} onClick={() => setCanvasTab("summary")}>Summary</button>
              <button className={canvasTab === "detail" ? "active" : ""} onClick={() => setCanvasTab("detail")}>{active === "medical_bill" ? "Charges" : active === "radiology_report" ? "Findings" : "Claim"}</button>
              <button className={canvasTab === "actions" ? "active" : ""} onClick={() => setCanvasTab("actions")}>Next steps</button>
            </div>
            <AnalysisCanvas analysis={analysis} tab={canvasTab} videoScene={videoScene} generatedVideoUrl={generatedVideo?.url ?? null} generatedIllustration={generatedIllustrations[videoScene] ?? null} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} videoGenerating={videoGenerating} videoStatus={videoStatus} videoProgress={videoProgress} videoError={videoError} onSceneChange={setVideoScene} onGenerateVideo={generateHumanVideo} onGenerateIllustration={generateIllustration} onOpenIllustration={setExpandedIllustration} onCreateQuestionList={createQuestionList} onOpenSource={() => openSheet("source")} />
            <section className="canvas-continuity">
              <div><p className="canvas-kicker">CONTINUE WITH CLARITI</p><h3>Don’t stop at understanding.</h3><p>Talk this through or let Clariti call back when it matters.</p></div>
              <div className="continuity-actions"><button onClick={() => openSheet("call")}><Phone />Call Clariti</button><button onClick={() => void beginFollowUpConversation()}><Bell />Set follow-up</button></div>
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
            ) : sheet === "call" ? (
              <>
                <span className="modal-icon"><Phone /></span>
                <p className="canvas-kicker">CALL CLARITI</p>
                <h2>Talk through this {session.tag.toLowerCase()}</h2>
                <p>Clariti will use only this document analysis and its source anchors during the call.</p>
                <label className="sheet-field">
                  <span>Phone number</span>
                  <input
                    type="tel"
                    placeholder="+44 7000 000000"
                    value={callPhoneNumber}
                    onChange={(event) => setCallPhoneNumber(event.target.value)}
                  />
                </label>
                <div className="prototype-option-list">
                  <button type="button" onClick={startCall} disabled={placingCall || callPhoneNumber.trim().replace(/[^\d]/g, "").length < 7}>
                    {placingCall ? <RefreshCw className="spin" /> : <Phone />}
                    <span><b>{placingCall ? "Placing call..." : "Call me now"}</b><small>Starts an ElevenLabs/Twilio call with this Clariti analysis as context.</small></span>
                  </button>
                  <button type="button" disabled><ShieldCheck /><span><b>Safety boundary</b><small>No diagnosis, treatment instruction, or final coverage decision.</small></span></button>
                </div>
              </>
            ) : (
              <>
                <span className="modal-icon"><Bell /></span>
                <p className="canvas-kicker">PHONE FOLLOW-UP</p>
                <h2>Schedule around one action</h2>
                <p>Choose what this follow-up should focus on.</p>
                <div className="followup-builder">
                  {(analysis?.nextActions ?? []).map((action) => (
                    <button key={action} type="button" className={`follow-choice ${followAction === action ? "selected" : ""}`} onClick={() => setFollowAction(action)}>
                      {followAction === action ? <CheckCircle2 /> : <span />}
                      <b>{action}</b>
                    </button>
                  ))}
                </div>
                <div className="prototype-option-list">
                  <button type="button" onClick={() => void beginFollowUpConversation()}><Bell /><span><b>Discuss and schedule in chat</b><small>Clariti will use the report context, purpose and timing before scheduling.</small></span></button>
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

  return (
    <div className="canvas-content">
      {analysis.kind === "radiology_report" ? (
        <>
          <section className="radiology-hero">
            <div><span className="result-label">OVERALL IMPRESSION</span><h3>{analysis.summary}</h3><p>{analysis.plainEnglish}</p></div>
            <span className="risk-pill">{concernMetric?.value ?? "Review"}</span>
          </section>
          <section className="impression-stats">
            <div><strong>{analysis.keyPoints.length}</strong><span>Key findings</span></div>
            <div><strong>{analysis.metrics[0]?.value ?? "Report"}</strong><span>{analysis.metrics[0]?.label ?? "Document"}</span></div>
            <div><strong>{concernMetric?.value ?? "Ask"}</strong><span>{concernMetric?.label ?? "Clinician context"}</span></div>
          </section>
          <KeyPoints analysis={analysis} />
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      ) : (
        <>
          <section className={analysis.kind === "insurance_eob" ? "eob-flow" : "clariti-hero-total"}>
            {analysis.metrics.slice(0, 3).map((metric) => (
              <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong>{metric.caveat && <small>{metric.caveat}</small>}</div>
            ))}
          </section>
          <section className="canvas-card"><h3>In plain English</h3><p>{analysis.plainEnglish}</p></section>
          <KeyPoints analysis={analysis} />
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} generatedIllustration={generatedIllustration} generatedIllustrations={generatedIllustrations} illustrationGenerating={illustrationGenerating} illustrationError={illustrationError} generating={videoGenerating} jobStatus={videoStatus} jobProgress={videoProgress} videoError={videoError} onSceneChange={onSceneChange} onGenerateVideo={onGenerateVideo} onGenerateIllustration={onGenerateIllustration} onOpenIllustration={onOpenIllustration} />
        </>
      )}
      {analysis.flags.map((flag) => (
        <section className="canvas-card flag-card" key={flag.label}>
          <div className="card-title"><Flag /><h3>{flag.label}</h3></div>
          <p>{flag.detail}</p>
        </section>
      ))}
    </div>
  );
}

function PendingAnalysisCanvas({ session, active }: { session: WorkspaceSession; active: ClaritiAnalysisKind }) {
  const detailLabel = active === "radiology_report" ? "report wording" : active === "insurance_eob" ? "claim wording" : "document wording";
  return (
    <div className="canvas-content">
      <section className="canvas-card pending-analysis-card">
        <div className="pending-analysis-icon"><RefreshCw className="spin" /></div>
        <h3>Reading {session.fileName}</h3>
        <p>Clariti is extracting the {detailLabel}, checking source phrases, and preparing a grounded explanation.</p>
        <div className="pending-analysis-steps" aria-label="Analysis progress">
          <span>Read document</span>
          <span>Find anchors</span>
          <span>Build explanation</span>
        </div>
      </section>
      <section className="canvas-card pending-source-card">
        <h3>Safety boundary</h3>
        <p>Clariti will explain the document text and suggest questions. It will not diagnose, prescribe, or make final coverage/payment decisions.</p>
      </section>
    </div>
  );
}

function Detail({ analysis, onOpenSource }: { analysis: ClaritiAnalysis; onOpenSource: () => void }) {
  return (
    <div className="canvas-content">
      <section className="canvas-card">
        <h3>{analysis.kind === "medical_bill" ? "Charge breakdown" : analysis.kind === "insurance_eob" ? "Claim breakdown" : "Report findings"}</h3>
        {analysis.keyPoints.map((point) => (
          <div className="finding-row" key={point.label}>
            <span>{point.label}</span>
            <b>{point.detail}</b>
          </div>
        ))}
      </section>
      <section className="canvas-card meta-card">
        <h3>Source Anchors</h3>
        {analysis.sourceAnchors.map((anchor) => (
          <div className="meta-row" key={anchor}><span>Source</span><b>{anchor}</b></div>
        ))}
        <button type="button" className="meta-link-btn" onClick={onOpenSource}><FileDown />View original document</button>
      </section>
    </div>
  );
}

function KeyPoints({ analysis }: { analysis: ClaritiAnalysis }) {
  return (
    <section className="canvas-card">
      <h3>Key Points</h3>
      <ul className="key-findings-list">
        {analysis.keyPoints.map((point) => (
          <li key={point.label}><CheckCircle2 /><span><b>{point.label}</b><small>{point.detail} Source: {point.sourceAnchor}</small></span></li>
        ))}
      </ul>
    </section>
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
    return (
      <article className="clariti-chat-turn user-turn">
        <div className="message-meta">You</div>
        <div className="clariti-user-message">
          {showAttachment && <span className="attached-file"><FileText /><span><b>{session.fileName}</b><small>{session.tag} document</small></span></span>}
          <p>{message.content}</p>
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
          <div className={`clariti-inline-note ${active === "radiology_report" ? "radiology-note" : ""}`}>
            {active === "radiology_report" ? <Stethoscope /> : <Flag />} {safetyNote}
          </div>
        )}
      </div>
    </article>
  );
}

function GeneratedVideoResponse({ video, analysis }: { video: GeneratedVideo; analysis: ClaritiAnalysis }) {
  const source = (analysis.sourceAnchors[0] ?? "saved report analysis").replace(/\.+$/, ".");
  const label = analysis.kind === "insurance_eob" ? "claim" : analysis.kind === "medical_bill" ? "bill" : "report";
  const disclaimer = analysis.kind === "radiology_report"
    ? "Educational explanation only; not a medical diagnosis or a replacement for a clinician."
    : "Educational explanation only; confirm details with the provider or insurer before acting.";
  return (
    <article className="clariti-chat-turn assistant-turn generated-video-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card">
        <div className="message-meta">Clariti</div>
        <p>I generated a video explainer grounded in the saved {label} analysis.</p>
        <video className="chat-generated-video" src={video.url} controls playsInline />
        <p className="source-grounded-line">Source: {source} {disclaimer}</p>
      </div>
    </article>
  );
}

function VideoGenerationPrompt({
  analysis,
  generating,
  status,
  progress,
  error,
  onGenerate,
}: {
  analysis: ClaritiAnalysis;
  generating: boolean;
  status: string | null;
  progress: number;
  error: string | null;
  onGenerate: () => void;
}) {
  const meta = getVideoExplainerMeta(analysis);
  return (
    <article className="clariti-chat-turn assistant-turn video-prompt-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card video-prompt-card">
        <div className="message-meta">Clariti</div>
        <p>{meta.chatPrompt}</p>
        <button type="button" className="chat-video-generate" disabled={generating} onClick={onGenerate}>
          {generating ? <RefreshCw className="spin" /> : <Play />}
          {generating ? `Generating video ${progress}%` : "Generate video explainer"}
        </button>
        {generating && <p className="source-grounded-line">Status: {status ?? "queued"}. This can take a minute or more.</p>}
        {error && <p className="video-error">{error}</p>}
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
        <div className="video-explainer-media human-video-preview">
          <div className="video-preview-copy">
            <span>{generating ? `Generating video · ${jobStatus ?? "queued"} · ${jobProgress}%` : meta.eyebrow}</span>
            <b>{meta.title}</b>
            <small>{generating ? "Clariti is creating the scene clips, stitching them, and saving the MP4." : scene.script}</small>
          </div>
          <button type="button" className="video-play-btn" aria-label="Generate video explanation" disabled={generating} onClick={() => void generateVideo()}>{generating ? <RefreshCw className="spin" /> : <Play />}</button>
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
      <p className="video-caption">{generatedVideoUrl ? `The generated video explainer was also added to the chat thread. ${getEducationDisclaimer(analysis)}` : `Clariti creates a stitched, AI-generated explainer for education only. ${getEducationDisclaimer(analysis)}`}</p>
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
  const question = analysis.questions[0] ?? "What should I ask next?";

  if (analysis.kind === "insurance_eob") {
    return [
      { title: "What this is", script: `This EOB explains how the claim was processed.`, sourceAnchor: analysis.sourceAnchors[0] ?? "Document header" },
      { title: "Claim flow", script: metrics || "Clariti maps billed, allowed, paid, and possible patient responsibility amounts.", sourceAnchor: analysis.metrics[0]?.label ?? "Claim amounts" },
      { title: "What to check", script: main?.detail ?? analysis.summary, sourceAnchor: main?.sourceAnchor ?? "Key point" },
      { title: "Before paying", script: second?.detail ?? "Compare this EOB with the provider bill before paying.", sourceAnchor: second?.sourceAnchor ?? "Payment note" },
      { title: "Next question", script: `Ask: ${question}`, sourceAnchor: analysis.sourceAnchors[0] ?? "Next step" },
    ];
  }

  if (analysis.kind === "medical_bill") {
    return [
      { title: "What this is", script: `This bill lists provider charges and possible amount due.`, sourceAnchor: analysis.sourceAnchors[0] ?? "Document header" },
      { title: "Charges map", script: metrics || "Clariti separates total charges, payments or adjustments, and the amount to verify.", sourceAnchor: analysis.metrics[0]?.label ?? "Charges" },
      { title: "Main issue", script: main?.detail ?? analysis.summary, sourceAnchor: main?.sourceAnchor ?? "Key point" },
      { title: "What to verify", script: second?.detail ?? "Check unclear fees and compare against your insurer's EOB.", sourceAnchor: second?.sourceAnchor ?? "Billing note" },
      { title: "Next question", script: `Ask: ${question}`, sourceAnchor: analysis.sourceAnchors[0] ?? "Next step" },
    ];
  }

  return [
    { title: "Report wording", script: analysis.summary, sourceAnchor: analysis.sourceAnchors[0] ?? "Report" },
    { title: "Anatomy", script: main?.detail ?? analysis.plainEnglish, sourceAnchor: main?.sourceAnchor ?? "Finding" },
    { title: "Other findings", script: second?.detail ?? analysis.plainEnglish, sourceAnchor: second?.sourceAnchor ?? "Finding" },
    { title: "What it does not decide", script: "This explains the report wording only; it is not a diagnosis.", sourceAnchor: analysis.safetyNote },
    { title: "Clinician question", script: `Ask: ${question}`, sourceAnchor: analysis.sourceAnchors[0] ?? "Next step" },
  ];
}

function getVideoExplainerMeta(analysis: ClaritiAnalysis) {
  if (analysis.kind === "insurance_eob") {
    return {
      eyebrow: "Claim explainer",
      title: "Claim flow, responsibilities, and what to verify",
      chatPrompt: "I can also generate a short human explainer video for this EOB, grounded in the same source wording.",
    };
  }
  if (analysis.kind === "medical_bill") {
    return {
      eyebrow: "Bill explainer",
      title: "Charges, payments, and what to check before paying",
      chatPrompt: "I can also generate a short human explainer video for this bill, grounded in the same source wording.",
    };
  }
  return {
    eyebrow: "Anatomy explainer",
    title: "Anatomy, findings, and questions to ask",
    chatPrompt: "I can also generate a short human explainer video for this radiology report, grounded in the same source wording.",
  };
}

function getEducationDisclaimer(analysis: ClaritiAnalysis) {
  if (analysis.kind === "insurance_eob") return "Confirm coverage and payment with the insurer or provider.";
  if (analysis.kind === "medical_bill") return "Confirm charges and what you owe with the provider or insurer.";
  return "It does not replace a clinician or medical diagnosis.";
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
  completedAt?: string | null;
};

async function createSceneVideoJob(analysis: ClaritiAnalysis, durationSeconds: number, sessionId: string | null) {
  const response = await fetch("/api/videos/report-explainer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ analysis, durationSeconds, sessionId }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok || !payload.job?.id) {
    throw new Error(formatHumanVideoError(payload.error ?? "Clariti could not create the video job."));
  }
  return payload.job as VideoJobPayload;
}

async function fetchLatestVideoJob(sessionId: string) {
  const response = await fetch(`/api/videos/report-explainer?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) return null;
  return payload.job as VideoJobPayload | null;
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
  void fetch(`/api/videos/report-explainer/${jobId}?process=1`, { cache: "no-store" }).catch(() => undefined);

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
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("The video job is still running. Leave this chat open or try checking again in a moment.");
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
          {items.map((item, index) => <li key={item}><span>{index + 1}</span><p><b>{item}</b><small>Clariti can turn this into a phone follow-up or a concise question list.</small></p></li>)}
        </ol>
        <button type="button" className="canvas-primary" disabled={creating} onClick={() => void handleCreate()}>
          {creating ? "Creating question list..." : "Create question list"}
        </button>
      </section>
    </div>
  );
}

function toArtifactMeta(analysis: ClaritiAnalysis) {
  const metric = analysis.metrics[0];
  return {
    eyebrow: analysis.kind === "radiology_report" ? "RADIOLOGY INTELLIGENCE" : analysis.kind === "insurance_eob" ? "CLAIM INTELLIGENCE" : "BILL INTELLIGENCE",
    title: analysis.kind === "radiology_report" ? "Your report, in plain English" : analysis.kind === "insurance_eob" ? "Your claim, made clearer" : "Your bill, made clearer",
    metric: metric?.value ?? String(analysis.keyPoints.length),
    label: metric?.label ?? "key points",
    note: analysis.flags[0]?.label ?? analysis.questions[0] ?? "Ready for review",
  };
}

function messagesFromDbSession(session: DbWorkspaceSession): ChatMessage[] {
  const messages = session.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: message.content,
      createdAt: timestampFromIso(message.created_at),
    }));
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
  const source = analysis.keyPoints[0]?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "saved document";
  const nextAction = analysis.nextActions[0] ?? "review this with the right professional";
  return `${analysis.summary}\n\nI pulled out the key points in the analysis panel. Next: ${nextAction}. Source: ${source}.`;
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

  if (extractPhoneNumber(question) && !hasSchedulingTime(question)) {
    return "Got the phone number. What day and time should Clariti use for the follow-up?";
  }

  if (/schedule|follow-up|follow up|call back|phone follow|reminder|set.*time/.test(lower)) {
    return buildFollowUpPlanningReply(analysis, analysis.nextActions[0] ?? "review this document with the relevant clinician or provider");
  }

  if (/cancer|tumou?r|malignan|mass|lesion/.test(lower)) {
    return `Clariti cannot tell from this report whether you have cancer. The saved analysis does not include a cancer, tumour, malignancy, mass, or lesion finding; it highlights: ${pointText} Source: ${point.sourceAnchor}. Ask your clinician to confirm what the report rules in and rules out.`;
  }

  if (/ignore|safe to ignore|nothing to do|leave it|wait and see/.test(lower)) {
    return `I would not ignore it. The saved analysis flags: ${pointText} Source: ${point.sourceAnchor}. A safer next step is to ${(analysis.nextActions[0] ?? "review this with your clinician").toLowerCase()}.`;
  }

  const metric = analysis.metrics.find((item) => /\$|£|amount|paid|due|responsibility|billed/i.test(`${item.label} ${item.value}`));
  if (metric) {
    return `Based on the saved analysis, ${metric.label.toLowerCase()} is ${metric.value}. ${metric.caveat ?? ""} Source: ${analysis.sourceAnchors[0] ?? "saved analysis"}.`;
  }
  return `From the saved analysis: ${pointText} Source: ${point.sourceAnchor}.`;
}

function buildFollowUpPlanningReply(analysis: ClaritiAnalysis, action: string) {
  const point = analysis.keyPoints[0];
  return `Yes. I can set up a focused phone follow-up for ${action}. Send the best phone number and preferred day/time. Source: ${point.sourceAnchor}.`;
}

function extractPhoneNumber(value: string) {
  const match = value.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
  return match?.[0].replace(/\s+/g, " ").trim() ?? null;
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
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : undefined,
      analysis: parsed.analysis,
      persisted: parsed.persisted,
    };
  } catch {
    return null;
  }
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
  return value === "medical_bill" || value === "radiology_report" || value === "insurance_eob";
}

function toWorkspaceSession(request: ClaritiRequest): WorkspaceSession {
  const labels: Record<ClaritiAnalysisKind, { title: string; tag: string }> = {
    medical_bill: { title: "Medical bill", tag: "Bill" },
    radiology_report: { title: "Radiology report", tag: "Report" },
    insurance_eob: { title: "Insurance EOB", tag: "EOB" },
  };
  const label = labels[request.kind];
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

function toRecentWorkspaceSession(session: { id: string; title: string; status: string; updated_at: string; question?: string | null }): RecentWorkspaceSession {
  const source = `${session.title} ${session.question ?? ""}`.toLowerCase();
  const kind: ClaritiAnalysisKind = source.includes("radiology") || source.includes("mri")
    ? "radiology_report"
    : source.includes("eob") || source.includes("claim") || source.includes("insurance")
      ? "insurance_eob"
      : "medical_bill";

  const category = kind === "radiology_report" ? "Radiology report" : kind === "insurance_eob" ? "Insurance EOB" : "Medical bill";
  const title = cleanSessionTitle(session.title, kind);
  const updatedAt = new Date(session.updated_at);
  const date = Number.isFinite(updatedAt.getTime()) ? updatedAt.toLocaleDateString() : "";
  const meta = [category, date].filter(Boolean).join(" · ");

  return {
    id: session.id,
    kind,
    title,
    meta,
    preview: buildSessionPreview(session.question, category, session.title),
    fileName: session.title,
  };
}

function toPendingWorkspaceSession(request: ClaritiRequest): RecentWorkspaceSession {
  const category = request.kind === "radiology_report" ? "Radiology report" : request.kind === "insurance_eob" ? "Insurance EOB" : "Medical bill";
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
  const category = analysis.kind === "radiology_report" ? "Radiology report" : analysis.kind === "insurance_eob" ? "Insurance EOB" : "Medical bill";

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
  const fallback = kind === "radiology_report" ? "Radiology report" : kind === "insurance_eob" ? "Insurance EOB" : "Medical bill";
  const cleaned = title
    .replace(/\.(pdf|txt|png|jpe?g|webp)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;
  const generic = /^(medical bill|insurance eob|radiology report)$/i.test(cleaned);
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
  if (kind === "radiology_report") return <FileHeart />;
  if (kind === "insurance_eob") return <ShieldCheck />;
  return <ReceiptText />;
}
