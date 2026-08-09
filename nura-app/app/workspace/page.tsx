"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileAudio, FileText, Image as ImageIcon, ListChecks, Mic, Paperclip, Send, Sparkles, X } from "lucide-react";
import { NuraLogo, NuraMark } from "@/components/nura-logo";
import { CareDisclaimer } from "@/components/care-disclaimer";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";
import { CalendarNavBadge } from "@/components/calendar-nav-badge";
import { track } from "@/lib/analytics";
import {
  pickRecorderMimeType,
  voiceMicDeniedMessage,
  voiceRecordingFileName,
  voiceUnavailableMessage,
} from "@/lib/client/voice-recording";

type ChatMessage = {
  id: string;
  plan_id: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  attachments?: { name: string; kind: ChatAttachment["kind"] }[];
};

type ChatAttachment = {
  id: string; // client-only stable key, used for staging/removal - never sent to the server
  name: string;
  type: string;
  kind: "image" | "audio" | "document" | "file";
  text?: string;
  base64?: string;
};

function AttachmentIcon({ kind }: { kind: ChatAttachment["kind"] }) {
  if (kind === "image") return <ImageIcon />;
  if (kind === "audio") return <FileAudio />;
  return <FileText />;
}

const LEGACY_ATTACHMENT_SUFFIX = /\n*\s*Shared \d+ attachments?: (.+)\.?\s*$/i;

function inferAttachmentKind(name: string): ChatAttachment["kind"] {
  if (/\.(png|jpe?g|gif|webp|heic)$/i.test(name)) return "image";
  if (/\.(mp3|wav|m4a|ogg|webm|aac)$/i.test(name)) return "audio";
  if (/\.(pdf|doc|docx|txt|md)$/i.test(name)) return "document";
  return "file";
}

function shortFileName(name: string, max = 18) {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  const dot = trimmed.lastIndexOf(".");
  if (dot > 0 && trimmed.length - dot <= 5) {
    const ext = trimmed.slice(dot);
    const base = trimmed.slice(0, Math.max(1, max - ext.length - 1));
    return `${base}…${ext}`;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Split legacy "Shared N attachments: a, b." text into clean body + chip metadata. */
function displayMessage(message: ChatMessage): {
  text: string;
  attachments: { name: string; kind: ChatAttachment["kind"] }[];
} {
  const stored = Array.isArray(message.attachments) ? message.attachments : [];
  if (stored.length > 0) {
    return { text: message.content.replace(LEGACY_ATTACHMENT_SUFFIX, "").trim(), attachments: stored };
  }
  const match = message.content.match(LEGACY_ATTACHMENT_SUFFIX);
  if (!match?.[1]) return { text: message.content, attachments: [] };
  const names = match[1].split(",").map((part) => part.trim()).filter(Boolean);
  return {
    text: message.content.replace(LEGACY_ATTACHMENT_SUFFIX, "").trim(),
    attachments: names.map((name) => ({ name, kind: inferAttachmentKind(name) })),
  };
}

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4MB per file
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4MB combined per send

function attachmentKind(file: File): ChatAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.includes("pdf") || file.type.includes("document") || file.name.match(/\.(pdf|doc|docx|txt|md)$/i)) return "document";
  return "file";
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function newAttachmentId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}-${Math.random()}`;
}

// Tracks the newest message timestamp the user has actually seen rendered in this browser.
// A proactive check-in composes and stores its opener ahead of delivery (so WhatsApp/push
// can carry the real text immediately) - without this, reopening the chat would just show
// that text already sitting there, flat, instead of feeling like Nura is present and says
// it to you live.
const LAST_SEEN_MESSAGE_KEY = "nura-last-seen-message-ts";

function randomThinkingDelay() {
  return 900 + Math.random() * 600;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAttachment(file: File): Promise<ChatAttachment> {
  const kind = attachmentKind(file);
  const canReadText = file.type.startsWith("text/") || file.name.match(/\.(txt|md|csv|json)$/i);
  const type = file.type || "application/octet-stream";
  const id = newAttachmentId();

  if (canReadText) {
    return { id, name: file.name, type, kind, text: (await file.text()).slice(0, 4000) };
  }

  // Images, PDFs, Word docs, and audio need the raw bytes so the server can send them
  // to Claude natively (vision/PDF) or run docx/speech extraction - a filename alone
  // tells Nura nothing about what's actually in the file.
  return { id, name: file.name, type, kind, base64: await fileToBase64(file) };
}

export default function WorkspacePage() {
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialDraft = initialParams?.get("draft") ?? "";
  const initialPlanId = initialParams?.get("planId") ?? null;
  const initialPlanTitle = initialParams?.get("planTitle") ?? null;
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [sending, setSending] = useState(false);
  const [checkinThinking, setCheckinThinking] = useState(false);
  const [activePlan, setActivePlan] = useState<{ id: string; title: string } | null>(
    initialPlanId && initialPlanTitle ? { id: initialPlanId, title: initialPlanTitle } : null,
  );
  const [targetPlanId] = useState<string | null>(initialPlanId);
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [attachingFiles, setAttachingFiles] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Reveals a trailing run of assistant messages one at a time, each preceded by a "Nura is
  // thinking…" beat, instead of dumping them onto the screen already-written - this is what
  // makes opening the chat off a check-in notification feel like Nura noticing you're here
  // and actually speaking, not like reading a message that's been sitting there for a while.
  async function revealPending(pending: ChatMessage[]) {
    for (const message of pending) {
      setCheckinThinking(true);
      await delay(randomThinkingDelay());
      setCheckinThinking(false);
      setMessages((prev) => [...(prev ?? []), message]);
      await delay(300);
    }
  }

  useEffect(() => {
    const pendingIntake = sessionStorage.getItem("nura-intake");
    sessionStorage.removeItem("nura-intake");

    fetch("/api/messages")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setMessages([]);
          return;
        }
        const all: ChatMessage[] = data.messages;
        if (data.activePlan && !initialPlanId) setActivePlan(data.activePlan);

        const lastSeenRaw = localStorage.getItem(LAST_SEEN_MESSAGE_KEY);
        const lastSeenTs = lastSeenRaw ? Number(lastSeenRaw) : null;

        // Walk back from the end: everything in that trailing run is an assistant message
        // that arrived after the user was last actually looking at this chat - i.e. Nura
        // reaching out while they were away, rather than something they already read.
        let splitIndex = all.length;
        if (lastSeenTs !== null) {
          for (let i = all.length - 1; i >= 0; i--) {
            const message = all[i];
            if (message.role === "assistant" && new Date(message.created_at).getTime() > lastSeenTs) {
              splitIndex = i;
            } else {
              break;
            }
          }
        }

        if (splitIndex === all.length) {
          // Nothing arrived while the user was away (or this is their first-ever visit) -
          // show history as-is with no reveal animation.
          setMessages(all);
          return;
        }

        setMessages(all.slice(0, splitIndex));
        void revealPending(all.slice(splitIndex));
      })
      .catch(() => setMessages([]))
      .finally(() => {
        if (pendingIntake) send(pendingIntake);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps "last seen" in step with whatever's actually on screen, including as pending
  // check-in messages get revealed one by one above - so leaving and coming back later
  // never replays something already shown in this session.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    const ts = new Date(newest.created_at).getTime();
    if (!Number.isNaN(ts)) localStorage.setItem(LAST_SEEN_MESSAGE_KEY, String(ts));
  }, [messages]);

  useEffect(() => {
    fetch("/api/whatsapp/link")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setWhatsappHref(data.href);
          setWhatsappCode(data.code ?? null);
          setWhatsappLinked(Boolean(data.linked));
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    // Keep the thread inside the messages scroller (composer is viewport-fixed).
    node.scrollTo({ top: node.scrollHeight, behavior: "auto" });
    // Prevent the document itself from sitting scrolled under mobile browser chrome.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    if (!voiceError) return;
    const timer = setTimeout(() => setVoiceError(""), 6000);
    return () => clearTimeout(timer);
  }, [voiceError]);

  async function send(overrideContent?: string, overrideAttachments?: ChatAttachment[]) {
    const attachments = overrideAttachments ?? pendingAttachments;
    const content = (overrideContent ?? draft).trim();
    if ((!content && attachments.length === 0) || sending || attachingFiles) return;
    setSending(true);
    setDraft("");
    setPendingAttachments([]);

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      plan_id: activePlan?.id ?? null,
      role: "user",
      content: content || (attachments.length > 0 ? "" : "Shared media context with Nura."),
      created_at: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments.map((file) => ({ name: file.name, kind: file.kind })) : undefined,
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring to omit `id` from the payload
      const outgoingAttachments = attachments.map(({ id: _id, ...rest }) => rest);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || "Shared media context with Nura.", planId: targetPlanId, attachments: outgoingAttachments }),
      });
      const data = await res.json();
      if (res.status === 402 && data.upgradeUrl) {
        track("chat_paywall_hit", { source: "workspace" });
        setMessages((prev) => [
          ...(prev ?? []),
          {
            id: `reply-${Date.now()}`,
            plan_id: activePlan?.id ?? null,
            role: "assistant",
            content: `${data.message} Open Billing to upgrade.`,
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }
      if (data.ok) {
        track("chat_send", {
          source: "workspace",
          has_attachments: attachments.length > 0,
          plan_linked: Boolean(data.planId || targetPlanId),
        });
        if (data.planId) setActivePlan({ id: data.planId, title: data.planTitle });
        setMessages((prev) => [
          ...(prev ?? []),
          {
            id: `reply-${Date.now()}`,
            plan_id: data.planId ?? null,
            role: "assistant",
            content: data.reply,
            created_at: new Date().toISOString(),
          },
        ]);

        // The reply already arrived by the time we check this, so it reflects whether the
        // user was actually away when it landed - not just when they sent the message (which
        // can be several seconds earlier for a slower reply).
        if (typeof document !== "undefined" && document.visibilityState === "hidden" && data.reply) {
          void fetch("/api/push/notify-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              body: String(data.reply).slice(0, 200),
              url: data.planId ? `/plans/${data.planId}` : "/workspace",
            }),
          }).catch(() => null);
        }
      }
    } finally {
      setSending(false);
    }
  }

  const hasMessages = messages && messages.length > 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = 4 - pendingAttachments.length;
    const selected = Array.from(files).slice(0, Math.max(room, 0));

    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-selecting the same file later

    if (selected.length === 0) {
      setVoiceError("You can attach up to 4 files per message.");
      return;
    }

    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setVoiceError(`${oversized.name} is too large (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB per file).`);
      return;
    }
    const totalBytes = [...pendingAttachments, ...selected].reduce(
      (sum, file) => sum + ("size" in file ? file.size : Math.round(((file as ChatAttachment).base64?.length ?? 0) * 0.75)),
      0,
    );
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      setVoiceError(`Those files are too large together (max ${Math.round(MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024)}MB per message). Try sending fewer or smaller files.`);
      return;
    }
    setVoiceError("");
    setAttachingFiles(true);
    try {
      const newAttachments = await Promise.all(selected.map(readAttachment));
      setPendingAttachments((prev) => [...prev, ...newAttachments]);
    } finally {
      setAttachingFiles(false);
    }
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((file) => file.id !== id));
  }

  function releaseMicStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (mediaRecorderRef.current) return; // already recording - avoid orphaning a prior stream
    setVoiceError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError(voiceUnavailableMessage());
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseMicStream();
        mediaRecorderRef.current = null;
        void transcribeAndSend(recorder.mimeType || mimeType || "audio/webm");
      };
      mediaRecorderRef.current = recorder;
      // Timeslice keeps chunks flowing on iOS WKWebView.
      recorder.start(250);
      setRecording(true);
    } catch {
      setVoiceError(voiceMicDeniedMessage());
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      releaseMicStream();
    }
    setRecording(false);
  }

  useEffect(() => releaseMicStream, []);

  async function transcribeAndSend(mimeType = "audio/webm") {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size === 0) return;

    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, voiceRecordingFileName(mimeType));
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) {
        if (res.status === 402 && data.upgradeUrl) {
          setVoiceError("Voice notes are a Nura Plus feature. Open Billing to upgrade.");
          return;
        }
        setVoiceError(data.error || "Couldn't transcribe that voice note. Please try again.");
        return;
      }
      await send(data.text);
    } catch {
      setVoiceError("Couldn't transcribe that voice note. Please try again.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <main className="chat-page">
      <header>
        <Link href="/today" className="icon-only-btn" aria-label="Back to Today">
          <ArrowLeft />
        </Link>
        <NuraLogo compact href="/today" />
        <div className="chat-header-actions">
          <Link href="/calendar" className="icon-only-btn nav-icon-wrap" title="Calendar" aria-label="Calendar">
            <CalendarDays />
            <CalendarNavBadge />
          </Link>
          {whatsappHref && <WhatsAppOpenButton className="icon-only-btn" linked={whatsappLinked} iconOnly />}
          <Link href="/plans" className="icon-only-btn" title="View Care plans" aria-label="View Care plans">
            <ListChecks />
          </Link>
        </div>
      </header>
      <section className="chat-layout">
        <div className="chat-main">
          <CareDisclaimer compact />
          {!hasMessages && (
            <div className="chat-intro">
              <span className="chat-orb"><NuraMark size={44} /></span>
              <h1>What&apos;s going on?</h1>
              <p>Start anywhere. Nura will help keep the important parts organised.</p>
            </div>
          )}
          <div className="messages" ref={listRef}>
            {messages?.map((message) => {
              if (message.role !== "user") {
                return (
                  <div className="nura-message" key={message.id}>
                    <NuraMark size={30} />
                    <div><p>{message.content}</p></div>
                  </div>
                );
              }
              const { text, attachments } = displayMessage(message);
              return (
                <div className="user-message" key={message.id}>
                  {attachments.length > 0 && (
                    <div className="message-attachments">
                      {attachments.map((file, index) => (
                        <span className="attachment-chip" key={`${file.name}-${index}`} title={file.name}>
                          <AttachmentIcon kind={file.kind} />
                          <span>{shortFileName(file.name)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {text ? <p className="user-message-text">{text}</p> : null}
                </div>
              );
            })}
            {(sending || checkinThinking) && (
              <div className="nura-message subtle">
                <Sparkles />
                <div><p>Nura is thinking…</p></div>
              </div>
            )}
          </div>
          {(pendingAttachments.length > 0 || attachingFiles || recording || transcribing || voiceError) && (
            <div className="composer-status-stack">
              {pendingAttachments.length > 0 && (
                <div className="pending-attachments">
                  {pendingAttachments.map((file) => (
                    <span className="pending-attachment-chip" key={file.id}>
                      <AttachmentIcon kind={file.kind} />
                      <span>{file.name}</span>
                      <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(file.id)}>
                        <X />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {attachingFiles && <p className="voice-note-status"><span>Attaching file…</span></p>}
              {(recording || transcribing || voiceError) && (
                <p className={`voice-note-status${voiceError ? " error" : ""}`}>
                  <span>{voiceError || (recording ? "Recording… tap the mic again to send." : "Transcribing your voice note…")}</span>
                  {voiceError && (
                    <button type="button" aria-label="Dismiss" onClick={() => setVoiceError("")}>
                      <X />
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="chat-composer" aria-label="Message Nura">
            <label className="composer-file-button" aria-label="Attach image, document, audio, or file">
              <Paperclip />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.md,.csv,.json"
                onChange={(event) => handleFiles(event.target.files)}
                disabled={sending}
              />
            </label>
            <textarea
              placeholder="Message Nura…"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              className={recording ? "recording" : ""}
              aria-label={recording ? "Stop recording and send voice note" : "Record a voice note"}
              title={transcribing ? "Transcribing…" : recording ? "Stop recording" : "Record a voice note"}
              onClick={() => (recording ? stopRecording() : startRecording())}
              disabled={sending || transcribing}
            >
              <Mic />
            </button>
            <button type="button" className="send-button" onClick={() => send()} disabled={sending || attachingFiles || (!draft.trim() && pendingAttachments.length === 0)}>
              <Send />
            </button>
          </div>
        </div>
        <aside className="context-panel">
          <span className="auth-kicker">RELATED CONTEXT</span>
          {activePlan ? (
            <>
              <h2>{activePlan.title}</h2>
              <p>Nura has connected this conversation to this Care plan.</p>
            </>
          ) : (
            <>
              <h2>No Care plan yet</h2>
              <p>Nura will connect what you share to a Care plan as the conversation continues — or start one in a few steps.</p>
              <Link href="/plans/new" className="secondary-cta">
                Start a Care plan
              </Link>
            </>
          )}
          <article>
            <FileText />
            <div><b>Conversation-first memory</b><span>Messages, context notes, and voice notes update Care plans.</span></div>
          </article>
          {whatsappLinked ? (
            <p className="checkin-copy">WhatsApp is linked to this Nura account.</p>
          ) : whatsappCode ? (
            <p className="checkin-copy">WhatsApp will link to this Nura account with code <b>{whatsappCode}</b>.</p>
          ) : null}
          {whatsappHref ? (
            <WhatsAppOpenButton className="primary-cta full" linked={whatsappLinked} />
          ) : (
            <p className="checkin-copy">Add `NEXT_PUBLIC_NURA_WHATSAPP_NUMBER` to enable WhatsApp handoff.</p>
          )}
          <Link href="/summary" className="secondary-cta full">View current summary</Link>
        </aside>
      </section>
    </main>
  );
}
