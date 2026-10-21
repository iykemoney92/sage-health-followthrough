"use client";

import { useState } from "react";
import { MessageSquareQuote, Phone, Undo2 } from "lucide-react";
import type { CircleNote } from "@/lib/care-circle-notes";

const MAX_CHARS = 500;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Owner side of pass-on notes: write something for the circle in your own words, and see (and
 * take back) everything that was passed on - including what you asked Nura to pass on during a call.
 */
export function CirclePassOnCard({ planId, initialNotes }: { planId: string; initialNotes: CircleNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/plans/${planId}/circle/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error === "limit" ? "You've passed on a few things today - try again tomorrow." : "Couldn't pass that on just now. Please try again.");
        return;
      }
      setNotes((prev) => [data.note as CircleNote, ...prev.filter((note) => note.id !== data.note.id)]);
      setDraft("");
    } catch {
      setError("Couldn't pass that on just now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function withdraw(noteId: string) {
    if (withdrawing) return;
    setWithdrawing(noteId);
    setError("");
    try {
      const res = await fetch(`/api/plans/${planId}/circle/notes/${noteId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("Couldn't take that back just now. Please try again.");
        return;
      }
      setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, withdrawn: true } : note)));
    } catch {
      setError("Couldn't take that back just now. Please try again.");
    } finally {
      setWithdrawing(null);
    }
  }

  return (
    <section className="detail-card circle-pass-on-card" aria-label="Pass something on to your circle">
      <h3>
        <MessageSquareQuote aria-hidden /> Pass something on
      </h3>
      <p className="circle-pass-on-intro">
        Your circle sees exactly these words, nothing else from your conversations. Nura may also ask at the end of a call
        if there&apos;s anything you&apos;d like passed on, and only sends it once you say yes.
      </p>
      <label className="circle-pass-on-compose">
        <span className="sr-only">Message for your circle</span>
        <textarea
          value={draft}
          maxLength={MAX_CHARS}
          rows={2}
          placeholder="e.g. Had a better week - thanks for the calls, they help."
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className="circle-pass-on-actions">
        <small>{draft.length > MAX_CHARS - 80 ? `${MAX_CHARS - draft.length} characters left` : ""}</small>
        <button type="button" className="primary-cta" onClick={send} disabled={sending || !draft.trim()}>
          {sending ? "Passing on…" : "Pass on"}
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="circle-pass-on-list">
          {notes.map((note) => (
            <li key={note.id} className={note.withdrawn ? "withdrawn" : undefined}>
              <p>&ldquo;{note.body}&rdquo;</p>
              <div className="circle-pass-on-meta">
                <small>
                  {note.source === "voice_call" && <Phone aria-hidden />}
                  {formatWhen(note.createdAt)}
                  {note.source === "voice_call" ? " · on a call with Nura" : ""}
                  {note.withdrawn ? " · taken back" : ""}
                </small>
                {!note.withdrawn && (
                  <button
                    type="button"
                    className="circle-pass-on-withdraw"
                    onClick={() => withdraw(note.id)}
                    disabled={withdrawing === note.id}
                    aria-label="Take this message back from your circle"
                  >
                    <Undo2 /> {withdrawing === note.id ? "Taking back…" : "Take back"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="care-circle-error">{error}</p>}
    </section>
  );
}
