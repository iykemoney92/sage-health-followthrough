"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, ListChecks, Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { NuraLogo, NuraMark } from "@/components/nura-logo";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";

type ChatMessage = {
  id: string;
  plan_id: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ChatAttachment = {
  name: string;
  type: string;
  kind: "image" | "audio" | "document" | "file";
  text?: string;
};

function attachmentKind(file: File): ChatAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.includes("pdf") || file.type.includes("document") || file.name.match(/\.(pdf|doc|docx|txt|md)$/i)) return "document";
  return "file";
}

async function readAttachment(file: File): Promise<ChatAttachment> {
  const kind = attachmentKind(file);
  const canReadText = file.type.startsWith("text/") || file.name.match(/\.(txt|md|csv|json)$/i);
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    kind,
    text: canReadText ? (await file.text()).slice(0, 4000) : "",
  };
}

export default function WorkspacePage() {
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialDraft = initialParams?.get("draft") ?? "";
  const initialPlanId = initialParams?.get("planId") ?? null;
  const initialPlanTitle = initialParams?.get("planTitle") ?? null;
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [sending, setSending] = useState(false);
  const [activePlan, setActivePlan] = useState<{ id: string; title: string } | null>(
    initialPlanId && initialPlanTitle ? { id: initialPlanId, title: initialPlanTitle } : null,
  );
  const [targetPlanId] = useState<string | null>(initialPlanId);
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pendingIntake = sessionStorage.getItem("nura-intake");
    sessionStorage.removeItem("nura-intake");

    fetch("/api/messages")
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.ok ? data.messages : []);
        if (data.ok && data.activePlan && !initialPlanId) setActivePlan(data.activePlan);
      })
      .catch(() => setMessages([]))
      .finally(() => {
        if (pendingIntake) send(pendingIntake);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(overrideContent?: string, attachments: ChatAttachment[] = []) {
    const content = (overrideContent ?? draft).trim();
    if ((!content && attachments.length === 0) || sending) return;
    setSending(true);
    setDraft("");

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      plan_id: activePlan?.id ?? null,
      role: "user",
      content: content || `Shared ${attachments.map((file) => file.name).join(", ")}`,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || "Shared media context with Nura.", planId: targetPlanId, attachments }),
      });
      const data = await res.json();
      if (data.ok) {
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
      }
    } finally {
      setSending(false);
    }
  }

  const hasMessages = messages && messages.length > 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const attachments = await Promise.all(Array.from(files).slice(0, 4).map(readAttachment));
    const names = attachments.map((file) => file.name).join(", ");
    await send(`I’m sharing this with Nura so it can update my health Thread: ${names}`, attachments);
  }

  return (
    <main className="chat-page">
      <header>
        <Link href="/today"><ArrowLeft /></Link>
        <NuraLogo compact href="/today" />
        <div className="chat-header-actions">
          <Link href="/calendar" className="icon-only-btn" title="Calendar" aria-label="Calendar">
            <CalendarDays />
          </Link>
          {whatsappHref && <WhatsAppOpenButton className="icon-only-btn" linked={whatsappLinked} iconOnly />}
          <Link href="/plans" className="icon-only-btn" title="View Threads" aria-label="View Threads">
            <ListChecks />
          </Link>
        </div>
      </header>
      <section className="chat-layout">
        <div className="chat-main">
          {!hasMessages && (
            <div className="chat-intro">
              <span className="chat-orb"><NuraMark size={44} /></span>
              <h1>What&apos;s going on?</h1>
              <p>Start anywhere. Nura will help keep the important parts organised.</p>
            </div>
          )}
          <div className="messages" ref={listRef}>
            {messages?.map((message) =>
              message.role === "user" ? (
                <div className="user-message" key={message.id}>{message.content}</div>
              ) : (
                <div className="nura-message" key={message.id}>
                  <NuraMark size={30} />
                  <div><p>{message.content}</p></div>
                </div>
              )
            )}
            {sending && (
              <div className="nura-message subtle">
                <Sparkles />
                <div><p>Nura is thinking…</p></div>
              </div>
            )}
          </div>
          <div className="chat-composer" aria-label="Message Nura">
            <label className="composer-file-button" aria-label="Attach image, document, audio, or file">
              <Paperclip />
              <input
                type="file"
                multiple
                accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.md,.csv,.json"
                onChange={(event) => handleFiles(event.target.files)}
                disabled={sending}
              />
            </label>
            <textarea
              placeholder="Message Nura..."
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
              aria-label="Send voice note"
              title="Send demo voice note"
              onClick={() => send("Voice note transcript: I slept badly again, work feels heavy, and I want a gentle check-in tomorrow evening.")}
              disabled={sending}
            >
              <Mic />
            </button>
            <button type="button" className="send-button" onClick={() => send()} disabled={sending || !draft.trim()}>
              <Send />
            </button>
          </div>
        </div>
        <aside className="context-panel">
          <span className="auth-kicker">RELATED CONTEXT</span>
          {activePlan ? (
            <>
              <h2>{activePlan.title}</h2>
              <p>Nura has connected this conversation to this Thread.</p>
            </>
          ) : (
            <>
              <h2>No Thread yet</h2>
              <p>Nura will connect what you share to a Thread as the conversation continues.</p>
            </>
          )}
          <article>
            <FileText />
            <div><b>Conversation-first memory</b><span>Messages, context notes, and voice notes update Threads.</span></div>
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
