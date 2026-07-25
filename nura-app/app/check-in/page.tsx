"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Mic, Smile, Meh, Frown, HelpCircle, CheckCircle2 } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";

const NOTE_LIMIT = 500;

const moods = [
  { label: "Better", Icon: Smile },
  { label: "About the same", Icon: Meh },
  { label: "Worse", Icon: Frown },
  { label: "Not sure", Icon: HelpCircle },
];

function CheckInFlow() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const planTitle = searchParams.get("title") ?? "your Thread";

  const [selected, setSelected] = useState("About the same");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    if (!planId) {
      setError("No Thread selected for this check-in.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/check-ins/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, mood: selected, note }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Something went wrong");
      setDone(true);
    } catch {
      setError("Couldn't save your check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="focused-flow">
      <header className="focused-header">
        <Link href="/today"><ArrowLeft /></Link>
        <NuraLogo compact href="/today" />
        <span />
      </header>
      <section className="checkin-card">
        {done ? (
          <div className="completion-state">
            <CheckCircle2 />
            <h1>Check-in complete</h1>
            <p>Thanks for sharing. Nura has added this update to your {planTitle} Thread and kept the context for your next follow-up.</p>
            <Link href={`/summary${planId ? `?planId=${planId}` : ""}`} className="primary-cta">View updated summary</Link>
            <Link href="/today" className="text-link">Back to Today</Link>
          </div>
        ) : (
          <>
            <div className="flow-kicker">CHECK-IN · {planTitle.toUpperCase()}</div>
            <h1>How have things been since we last spoke?</h1>
            <p>Select the closest answer. You can add more context below.</p>
            <div className="answer-list">
              {moods.map(({ label, Icon }) => (
                <button key={label} className={selected === label ? "selected" : ""} onClick={() => setSelected(label)}>
                  <Icon /><span>{label}</span>
                </button>
              ))}
            </div>
            <label className="thought-box">
              <span>Anything else you&apos;d like to add?</span>
              <div>
                <textarea
                  placeholder="Type your thoughts…"
                  value={note}
                  maxLength={NOTE_LIMIT}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Mic />
              </div>
              <small className="note-count">{note.length}/{NOTE_LIMIT}</small>
            </label>
            {error && <p className="auth-error"><AlertCircle /> {error}</p>}
            <button className="primary-cta full" onClick={handleContinue} disabled={submitting}>
              {submitting ? "Saving…" : "Continue"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInFlow />
    </Suspense>
  );
}
