"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  FileDown,
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
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { claritiAnalysisSchema, type ClaritiAnalysis, type ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { buildFallbackAnalysis } from "@/lib/domain/clariti-fallback-analysis";

type Drawer = "chats" | "documents" | "history";
type CanvasTab = "summary" | "detail" | "actions";
type Sheet = "call" | "followup" | "source" | null;
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type GeneratedVideo = {
  url: string;
  createdAt: number;
};
type FollowUpDraft = {
  action: string;
};
type ClaritiRequest = {
  kind: ClaritiAnalysisKind;
  question: string;
  documentText: string;
  fileName?: string;
  analysis?: ClaritiAnalysis;
  persisted?: unknown;
};
type WorkspaceSession = {
  id: ClaritiAnalysisKind;
  dbSessionId?: string;
  title: string;
  meta: string;
  tag: string;
  fileName: string;
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

function createLocalId(prefix: string) {
  localMessageCounter += 1;
  return `${prefix}-${localMessageCounter}`;
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceContent />
    </Suspense>
  );
}

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<ClaritiAnalysisKind>("medical_bill");
  const [activeRequest, setActiveRequest] = useState<ClaritiRequest | null>(null);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("summary");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [analysisByKind, setAnalysisByKind] = useState<Partial<Record<ClaritiAnalysisKind, ClaritiAnalysis>>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpText, setFollowUpText] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoScene, setVideoScene] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [followAction, setFollowAction] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpDraft | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = useMemo(() => activeRequest ? toWorkspaceSession(activeRequest) : null, [activeRequest]);
  const sessions = useMemo(() => session ? [session] : [], [session]);
  const analysis = analysisByKind[active] ?? null;
  const artifact = useMemo(() => analysis ? toArtifactMeta(analysis) : null, [analysis]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const analyzeRequest = useCallback(async (request: ClaritiRequest) => {
    setLoading(true);
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
      setAnalysisByKind((current) => ({ ...current, [request.kind]: payload.analysis as ClaritiAnalysis }));
      showToast("Clariti generated a source-grounded analysis.");
    } catch {
      setAnalysisByKind((current) => ({ ...current, [request.kind]: buildFallbackAnalysis({ ...request, documentText: request.documentText }) }));
      showToast("Using source-grounded fallback analysis until the AI service is configured.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let alive = true;

    async function loadWorkspace() {
      setBooting(true);
      try {
        const requestedSessionId = searchParams.get("sessionId");
        let resolvedSessionId = requestedSessionId;

        if (!resolvedSessionId) {
          const listResponse = await fetch("/api/sessions");
          const listPayload = listResponse.ok ? await listResponse.json() : null;
          resolvedSessionId = listPayload?.ok ? listPayload.sessions?.[0]?.id ?? null : null;
        }

        if (resolvedSessionId) {
          const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(resolvedSessionId)}`);
          const payload = response.ok ? await response.json() : null;
          if (payload?.ok && payload.session) {
            const dbRequest = requestFromDbSession(payload.session as DbWorkspaceSession);
            if (dbRequest && alive) {
              setDbSessionId(payload.session.id);
              setActiveRequest(dbRequest);
              setActive(dbRequest.kind);
              setChatMessages(messagesFromDbSession(payload.session as DbWorkspaceSession));
              if (dbRequest.analysis) {
                setAnalysisByKind((current) => ({ ...current, [dbRequest.kind]: dbRequest.analysis! }));
              } else {
                void analyzeRequest(dbRequest);
              }
              return;
            }
          }
        }

        const stored = window.localStorage.getItem(STORAGE_KEY);
        const request = parseStoredRequest(stored);
        if (request && alive) {
          setDbSessionId(null);
          setActiveRequest(request);
          setActive(request.kind);
          setChatMessages(messagesFromRequest(request));
          if (request.analysis) {
            setAnalysisByKind((current) => ({ ...current, [request.kind]: request.analysis! }));
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
  }, [analyzeRequest, searchParams]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [active, analysis, chatMessages, generatedVideo, loading, sendingFollowUp]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (generatedVideo?.url) URL.revokeObjectURL(generatedVideo.url);
    };
  }, [generatedVideo?.url]);

  const selectSession = (id: ClaritiAnalysisKind) => {
    setActive(id);
    setCanvasTab("summary");
    setDrawer(null);
    setCanvasOpen(false);
  };

  const openSheet = (nextSheet: Sheet) => {
    setToast(null);
    setSheet(nextSheet);
  };

  const handleVideoGenerated = (url: string) => {
    setGeneratedVideo((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { url, createdAt: Date.now() };
    });
    setCanvasOpen(false);
    showToast("Video explanation added to the chat.");
  };

  const startCall = async () => {
    if (!analysis) {
      showToast("Start an analysis before preparing a call.");
      return;
    }
    try {
      const response = await fetch("/api/voice/report-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: dbSessionId ?? `clariti-${active}`, analysis }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error("Call context failed");
      setSheet(null);
      showToast(`Call context ready: ${payload.elevenLabs.dynamicVariables.call_goal}`);
    } catch {
      showToast("Call Clariti could not prepare the report context.");
    }
  };

  const sendFollowUp = async () => {
    const content = followUpText.trim();
    if (!content || !analysis) return;

    const userMessage: ChatMessage = { id: createLocalId("local-user"), role: "user", content };
    const pendingDraft = followUpDraft;
    setFollowUpText("");
    setSendingFollowUp(true);
    setChatMessages((current) => [...current, userMessage]);

    try {
      if (!dbSessionId) throw new Error("Missing saved session");
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: dbSessionId, content, analysis }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not send message");

      const savedMessages = Array.isArray(payload.messages)
        ? payload.messages.map((message: { id: string; role: string; content: string }) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" as const : "user" as const,
          content: message.content,
        }))
        : [
          userMessage,
          { id: createLocalId("local-assistant"), role: "assistant" as const, content: payload.assistant as string },
        ];
      setChatMessages((current) => [...current.filter((message) => message.id !== userMessage.id), ...savedMessages]);
      if (pendingDraft) await maybeCaptureFollowUpDetails(content, pendingDraft);
    } catch {
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-assistant"),
          role: "assistant",
          content: buildLocalFollowUp(content, analysis),
        },
      ]);
      if (pendingDraft) await maybeCaptureFollowUpDetails(content, pendingDraft);
      showToast("Follow-up answered locally; it could not be saved.");
    } finally {
      setSendingFollowUp(false);
    }
  };

  const beginFollowUpConversation = async () => {
    if (!analysis || !session) return;
    setSheet(null);
    const action = followAction || analysis.nextActions[0] || "review the report with my clinician";
    setFollowUpDraft({ action });
    const content = `I want to set a phone follow-up about this ${session.tag.toLowerCase()}. Report context: ${analysis.summary}. Suggested action: ${action}. Help me choose the purpose, reason, phone number to call, and a safe time to schedule it.`;
    const userMessage: ChatMessage = { id: createLocalId("local-followup-user"), role: "user", content };
    setSendingFollowUp(true);
    setChatMessages((current) => [...current, userMessage]);

    try {
      if (!dbSessionId) throw new Error("Missing saved session");
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: dbSessionId, content, analysis }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not start follow-up conversation");
      const savedMessages = Array.isArray(payload.messages)
        ? payload.messages.map((message: { id: string; role: string; content: string }) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" as const : "user" as const,
          content: message.content,
        }))
        : [
          userMessage,
          { id: createLocalId("local-followup-assistant"), role: "assistant" as const, content: payload.assistant as string },
        ];
      setChatMessages((current) => [...current.filter((message) => message.id !== userMessage.id), ...savedMessages]);
    } catch {
      setChatMessages((current) => [
        ...current,
        { id: createLocalId("local-followup-assistant"), role: "assistant", content: buildFollowUpPlanningReply(analysis, action) },
      ]);
      showToast("Follow-up planning started locally; it could not be saved.");
    } finally {
      setSendingFollowUp(false);
    }
  };

  const maybeCaptureFollowUpDetails = async (content: string, draft: FollowUpDraft) => {
    if (!analysis) return;
    const phoneNumber = extractPhoneNumber(content);
    if (!phoneNumber) {
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-phone-needed"),
          role: "assistant",
          content: "I can schedule this once I have the phone number to call. Please send the best phone number and your preferred time, for example: +44 7123 456789 tomorrow morning.",
        },
      ]);
      return;
    }

    const scheduledFor = inferScheduledFor(content);
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
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-followup-scheduled"),
          role: "assistant",
          content: `Done. I captured ${phoneNumber} for the phone follow-up and scheduled it for ${new Date(payload.followUp.scheduledFor).toLocaleString()}. Purpose: ${draft.action}. ${analysis.safetyNote}`,
        },
      ]);
    } catch {
      setChatMessages((current) => [
        ...current,
        {
          id: createLocalId("local-followup-save-failed"),
          role: "assistant",
          content: `I captured the phone number ${phoneNumber}, but I could not save the follow-up yet. Please try again or confirm the time once more. ${analysis.safetyNote}`,
        },
      ]);
    }
  };

  if (booting || !session || !analysis || !artifact) {
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
          {sessions.map((item) => (
            <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => selectSession(item.id)}>
              <span className="file-icon"><FileText /></span>
              <span><b>{drawer === "documents" ? `${item.title} document` : item.title}</b><small>{drawer === "history" ? `Opened recently · ${item.meta}` : item.meta}</small></span>
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
          {chatMessages.length > 0 ? chatMessages.map((message, index) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              session={session}
              showAttachment={index === 0 && message.role === "user"}
              showSafetyNote={index === 1 && message.role === "assistant"}
              safetyNote={analysis.safetyNote}
              active={active}
            />
          )) : (
            <div className="clariti-ai-message">
              <span className="clariti-ai-avatar">C</span>
              <div>
                <p>{loading ? "I’m reading the document and checking the exact source wording before I explain it." : analysis.summary}</p>
                <p>{loading ? "This usually takes a moment." : analysis.plainEnglish}</p>
              </div>
            </div>
          )}

          {generatedVideo && <GeneratedVideoResponse video={generatedVideo} analysis={analysis} />}

          <button className={`chat-artifact-card artifact-${active}`} onClick={() => setCanvasOpen(true)}>
            <span className="artifact-card-top"><span><small>{artifact.eyebrow}</small><b>{artifact.title}</b></span><Sparkles /></span>
            <span className="artifact-card-metric"><strong>{artifact.metric}</strong><small>{artifact.label}</small></span>
            <span className="artifact-card-note"><CheckCircle2 />{artifact.note}</span>
            <span className="artifact-card-cta">View full analysis <span>→</span></span>
          </button>

          <div className="clariti-ai-message">
            <span className="clariti-ai-avatar">C</span>
            <div>
              <p>I can stay with you beyond this explanation. We can talk through it or set a phone follow-up around one specific next action.</p>
              <div className="clariti-quick-actions"><button onClick={() => openSheet("call")}>Call Clariti</button><button onClick={() => void beginFollowUpConversation()}>Set phone follow-up</button></div>
            </div>
          </div>
        </div>

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
          <button type="button" className="send" aria-label="Send message" disabled={!followUpText.trim() || sendingFollowUp} onClick={() => void sendFollowUp()}><Send /></button>
        </div>
      </section>

      <aside className={`clariti-canvas canvas-${active}`}>
        <div className="mobile-canvas-bar"><button type="button" onClick={() => setCanvasOpen(false)}><ArrowLeft />Back</button><span>Generated insight</span><button type="button" onClick={() => setCanvasOpen(false)} aria-label="Close insight"><X /></button></div>
        <header><div><p className="canvas-kicker">{artifact.eyebrow}</p><h2>{analysis.title}</h2></div>{active === "radiology_report" ? <ImageIcon /> : <Sparkles />}</header>
        <div className="canvas-tabs">
          <button className={canvasTab === "summary" ? "active" : ""} onClick={() => setCanvasTab("summary")}>Summary</button>
          <button className={canvasTab === "detail" ? "active" : ""} onClick={() => setCanvasTab("detail")}>{active === "medical_bill" ? "Charges" : active === "radiology_report" ? "Findings" : "Claim"}</button>
          <button className={canvasTab === "actions" ? "active" : ""} onClick={() => setCanvasTab("actions")}>Next steps</button>
        </div>
        <AnalysisCanvas analysis={analysis} tab={canvasTab} videoScene={videoScene} generatedVideoUrl={generatedVideo?.url ?? null} onSceneChange={setVideoScene} onVideoGenerated={handleVideoGenerated} onPrototypeAction={showToast} onOpenSource={() => openSheet("source")} />
        <section className="canvas-continuity">
          <div><p className="canvas-kicker">CONTINUE WITH CLARITI</p><h3>Don’t stop at understanding.</h3><p>Talk this through or let Clariti call back when it matters.</p></div>
          <div className="continuity-actions"><button onClick={() => openSheet("call")}><Phone />Call Clariti</button><button onClick={() => void beginFollowUpConversation()}><Bell />Set follow-up</button></div>
        </section>
        <footer className="canvas-footer">{analysis.safetyNote}</footer>
      </aside>

      <nav className="clariti-mobile-dock"><button onClick={() => setDrawer("chats")}><MessageSquareText /><span>Chats</span></button><button onClick={() => setDrawer("documents")}><FolderOpen /><span>Documents</span></button><Link href="/"><Plus /><span>New</span></Link><button onClick={() => setDrawer("history")}><History /><span>History</span></button></nav>

      {toast && <div className="clariti-ui-toast" role="status">{toast}</div>}

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
                <div className="prototype-option-list">
                  <button type="button" onClick={startCall}><Phone /><span><b>Prepare AI phone call</b><small>Builds a constrained call context from this Clariti analysis.</small></span></button>
                  <button type="button" onClick={() => showToast("Live telephony can connect here once the ElevenLabs agent ID is configured.")}><ShieldCheck /><span><b>Safety boundary</b><small>No diagnosis, treatment instruction, or final coverage decision.</small></span></button>
                </div>
              </>
            ) : (
              <>
                <span className="modal-icon"><Bell /></span>
                <p className="canvas-kicker">PHONE FOLLOW-UP</p>
                <h2>Schedule around one action</h2>
                <p>Choose the action Clariti should call back about tomorrow.</p>
                <div className="followup-builder">
                  {analysis.nextActions.map((action) => (
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
  onSceneChange,
  onVideoGenerated,
  onPrototypeAction,
  onOpenSource,
}: {
  analysis: ClaritiAnalysis;
  tab: CanvasTab;
  videoScene: number;
  generatedVideoUrl: string | null;
  onSceneChange: (scene: number) => void;
  onVideoGenerated: (url: string) => void;
  onPrototypeAction: (message: string) => void;
  onOpenSource: () => void;
}) {
  if (tab === "actions") return <Actions items={analysis.nextActions} onPrototypeAction={onPrototypeAction} />;
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
          <VideoStoryboard analysis={analysis} activeScene={videoScene} generatedVideoUrl={generatedVideoUrl} onSceneChange={onSceneChange} onVideoGenerated={onVideoGenerated} />
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
  return (
    <article className="clariti-chat-turn assistant-turn generated-video-turn">
      <span className="clariti-ai-avatar">C</span>
      <div className="clariti-ai-card">
        <div className="message-meta">Clariti</div>
        <p>I generated a short video explanation from the five source-grounded scenes for this report.</p>
        <video className="chat-generated-video" src={video.url} controls playsInline />
        <p className="source-grounded-line">Source: {source} {analysis.safetyNote}</p>
      </div>
    </article>
  );
}

function VideoStoryboard({
  analysis,
  activeScene,
  generatedVideoUrl,
  onSceneChange,
  onVideoGenerated,
}: {
  analysis: ClaritiAnalysis;
  activeScene: number;
  generatedVideoUrl: string | null;
  onSceneChange: (scene: number) => void;
  onVideoGenerated: (url: string) => void;
}) {
  const scenes = analysis.videoScenes ?? [];
  const [generating, setGenerating] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (scenes.length === 0) return null;
  const scene = scenes[activeScene] ?? scenes[0];
  const generateVideo = async () => {
    setGenerating(true);
    setVideoError(null);
    onSceneChange(0);
    try {
      const nextUrl = await createSceneVideo(analysis);
      onVideoGenerated(nextUrl);
      requestAnimationFrame(() => {
        void videoRef.current?.play().catch(() => undefined);
      });
    } catch {
      setVideoError("Clariti could not generate the video in this browser.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="canvas-card video-explainer-card">
      <div className="video-explainer-head"><h3><Sparkles />Generated video explanation</h3><span className="video-duration-badge">~25 sec</span></div>
      {generatedVideoUrl ? (
        <video ref={videoRef} className="clariti-generated-video" src={generatedVideoUrl} controls playsInline />
      ) : (
        <div className="video-explainer-media report-preview">
          <div><span>Ready to generate</span><b>{scene.title}</b><small>{scene.script}</small></div>
          <button type="button" className="video-play-btn" aria-label="Generate video explanation" disabled={generating} onClick={() => void generateVideo()}>{generating ? <RefreshCw className="spin" /> : <Play />}</button>
        </div>
      )}
      <div className="video-scene-strip" aria-label="Video scene outline">
        {scenes.map((item, index) => (
          <button key={item.title} type="button" className={index === activeScene ? "active" : ""} onClick={() => onSceneChange(index)}>{index + 1}</button>
        ))}
      </div>
      <div className="video-explainer-foot">
        <span><Sparkles />Source: {scene.sourceAnchor}</span>
        <button type="button" className="video-play-cta" disabled={generating} onClick={() => void generateVideo()}>{generatedVideoUrl ? <RefreshCw /> : <Play />}{generatedVideoUrl ? "Regenerate video" : "Generate video"}</button>
      </div>
      {videoError && <p className="video-error">{videoError}</p>}
      <p className="video-caption">{generatedVideoUrl ? "A generated video file was also added to the chat thread so it is easy to find." : scene.visual}</p>
    </section>
  );
}

async function createSceneVideo(analysis: ClaritiAnalysis) {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("Video generation is not available.");
  }

  const scenes = analysis.videoScenes ?? [];
  if (scenes.length === 0) throw new Error("No scenes to render.");

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_400_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise<string>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Recording failed."));
    recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
  });

  recorder.start();
  const startedAt = Date.now();
  const sceneDuration = 5000;
  const totalDuration = sceneDuration * scenes.length;

  await new Promise<void>((resolve, reject) => {
    const render = () => {
      try {
        const elapsed = Math.min(Date.now() - startedAt, totalDuration);
        const sceneIndex = Math.max(0, Math.min(scenes.length - 1, Math.floor(elapsed / sceneDuration)));
        const sceneProgress = Math.max(0, Math.min(1, (elapsed - sceneIndex * sceneDuration) / sceneDuration));
        const currentScene = scenes[sceneIndex] ?? scenes[0];
        drawVideoFrame(context, analysis, currentScene, sceneIndex, scenes.length, sceneProgress);
        if (elapsed >= totalDuration) {
          resolve();
          return;
        }
        requestAnimationFrame(render);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Video render failed."));
      }
    };
    render();
  });

  recorder.stop();
  return done;
}

function drawVideoFrame(
  context: CanvasRenderingContext2D,
  analysis: ClaritiAnalysis,
  scene: NonNullable<ClaritiAnalysis["videoScenes"]>[number],
  sceneIndex: number,
  totalScenes: number,
  progress: number,
) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const eased = 1 - Math.pow(1 - progress, 3);

  context.fillStyle = "#f7faf9";
  context.fillRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#173139");
  gradient.addColorStop(0.62, "#28504a");
  gradient.addColorStop(1, "#eaf5f1");
  context.fillStyle = gradient;
  roundRect(context, 52, 52, width - 104, height - 104, 38);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.1)";
  context.beginPath();
  context.arc(1030 + eased * 22, 165, 92, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(965, 540 - eased * 24, 150, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#a9d9cf";
  context.font = "700 24px Inter, Arial, sans-serif";
  context.fillText(`SCENE ${sceneIndex + 1} OF ${totalScenes}`, 100, 120);

  context.fillStyle = "#ffffff";
  context.font = "600 60px Georgia, serif";
  wrapCanvasText(context, scene.title, 100, 205, 760, 66, 2);

  context.fillStyle = "#d9e8e4";
  context.font = "400 30px Inter, Arial, sans-serif";
  wrapCanvasText(context, scene.script, 100, 335, 760, 42, 4);

  context.fillStyle = "#20312e";
  roundRect(context, 880, 178, 250, 294, 28);
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.fill();
  context.fillStyle = "#4d8d83";
  context.font = "700 22px Inter, Arial, sans-serif";
  context.fillText("Source", 925, 235);
  context.fillStyle = "#20312e";
  context.font = "600 28px Georgia, serif";
  wrapCanvasText(context, scene.sourceAnchor, 925, 285, 170, 36, 4);

  context.fillStyle = "#ffffff";
  context.font = "700 22px Inter, Arial, sans-serif";
  context.fillText("Clariti", 100, 615);
  context.fillStyle = "#cde3dd";
  context.font = "400 21px Inter, Arial, sans-serif";
  context.fillText(analysis.safetyNote, 198, 615);

  context.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(context, 100, 646, width - 200, 12, 999);
  context.fill();
  context.fillStyle = "#9fd2c8";
  roundRect(context, 100, 646, (width - 200) * ((sceneIndex + progress) / totalScenes), 12, 999);
  context.fill();
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
      if (lines >= maxLines) return;
    } else {
      line = testLine;
    }
  }
  if (line && lines < maxLines) context.fillText(line, x, y + lines * lineHeight);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function Actions({ items, onPrototypeAction }: { items: string[]; onPrototypeAction: (message: string) => void }) {
  return (
    <div className="canvas-content">
      <section className="canvas-card">
        <h3>Suggested next steps</h3>
        <ol className="action-list">
          {items.map((item, index) => <li key={item}><span>{index + 1}</span><p><b>{item}</b><small>Clariti can turn this into a phone follow-up or a concise question list.</small></p></li>)}
        </ol>
        <button type="button" className="canvas-primary" onClick={() => onPrototypeAction("Question list created from the current source-grounded analysis.")}>Create question list</button>
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
    }));
  return messages.length > 0 ? messages : [];
}

function messagesFromRequest(request: ClaritiRequest): ChatMessage[] {
  if (!request.analysis) return [{ id: "initial-user", role: "user", content: request.question }];
  return [
    { id: "initial-user", role: "user", content: request.question },
    { id: "initial-assistant", role: "assistant", content: `${request.analysis.summary}\n\n${request.analysis.plainEnglish}` },
  ];
}

function buildLocalFollowUp(question: string, analysis: ClaritiAnalysis) {
  const lower = question.toLowerCase();
  const point = analysis.keyPoints[0];
  const pointText = `${point.label} - ${point.detail.replace(/\s+/g, " ").replace(/\.+$/, ".")}`;

  if (/schedule|follow-up|follow up|call back|phone follow|reminder|set.*time/.test(lower)) {
    return buildFollowUpPlanningReply(analysis, analysis.nextActions[0] ?? "review this document with the relevant clinician or provider");
  }

  if (/cancer|tumou?r|malignan|mass|lesion/.test(lower)) {
    return `Clariti cannot tell from this report whether you have cancer. The saved analysis does not include a cancer, tumour, malignancy, mass, or lesion finding; it highlights: ${pointText} Source: ${point.sourceAnchor}. Ask your clinician to confirm what the report rules in and rules out.`;
  }

  if (/ignore|safe to ignore|nothing to do|leave it|wait and see/.test(lower)) {
    return `Do not treat this as something to ignore. The grounded takeaway is: ${pointText} Source: ${point.sourceAnchor}. A safer next step is to ${(analysis.nextActions[0] ?? "review this with your clinician").toLowerCase()}. ${analysis.safetyNote}`;
  }

  const metric = analysis.metrics.find((item) => /\$|£|amount|paid|due|responsibility|billed/i.test(`${item.label} ${item.value}`));
  if (metric) {
    return `Based on the saved analysis, ${metric.label.toLowerCase()} is ${metric.value}. ${metric.caveat ?? ""} Source: ${analysis.sourceAnchors[0] ?? "saved analysis"}.`;
  }
  return `From the saved analysis: ${pointText} Source: ${point.sourceAnchor}. Question asked: ${question}`;
}

function buildFollowUpPlanningReply(analysis: ClaritiAnalysis, action: string) {
  const point = analysis.keyPoints[0];
  const pointText = `${point.label} - ${point.detail.replace(/\s+/g, " ").replace(/\.+$/, ".")}`;
  const questions = analysis.questions.slice(0, 2).join(" ");
  return `Yes. I can help set this up as a focused phone follow-up, but I need the best phone number to call and a preferred time before scheduling. Purpose: ${action}. Reason: the saved analysis highlights ${pointText} Source: ${point.sourceAnchor}. Suggested default: tomorrow morning, unless symptoms are worsening or the document mentions urgent instructions. Reply with the phone number and timing, for example: "+44 7123 456789 tomorrow morning", and tell me whether this call should prepare clinician questions, review next steps, or remind you to contact the provider. Useful prompts: ${questions} ${analysis.safetyNote}`;
}

function extractPhoneNumber(value: string) {
  const match = value.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
  return match?.[0].replace(/\s+/g, " ").trim() ?? null;
}

function inferScheduledFor(value: string) {
  const lower = value.toLowerCase();
  const date = new Date();
  if (/tomorrow/.test(lower)) date.setDate(date.getDate() + 1);
  if (/next week/.test(lower)) date.setDate(date.getDate() + 7);

  if (/evening/.test(lower)) {
    date.setHours(18, 0, 0, 0);
  } else if (/afternoon/.test(lower)) {
    date.setHours(14, 0, 0, 0);
  } else if (/noon|midday/.test(lower)) {
    date.setHours(12, 0, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }

  const explicitTime = value.match(/\b([01]?\d|2[0-3])(?::([0-5]\d)|\s*(am|pm))\b/i);
  if (explicitTime) {
    let hour = Number(explicitTime[1]);
    const minute = explicitTime[2] ? Number(explicitTime[2]) : 0;
    const period = explicitTime[3]?.toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    date.setHours(hour, minute, 0, 0);
  }

  if (date.getTime() < Date.now() + 15 * 60 * 1000) date.setDate(date.getDate() + 1);
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
    analysis,
    persisted: {
      session: { id: session.id, title: session.title, status: session.status },
      document: document ? { id: document.id, file_name: document.file_name, kind: document.kind, status: document.status } : null,
      artifact: artifact ? { id: artifact.id, kind: artifact.kind, title: artifact.title } : null,
    },
  };
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
  return {
    id: request.kind,
    title: label.title,
    tag: label.tag,
    fileName: request.fileName || `${request.kind.replaceAll("_", "-")}.txt`,
    meta: request.fileName ? `Attached document · ${request.fileName}` : "Attached text document",
  };
}
