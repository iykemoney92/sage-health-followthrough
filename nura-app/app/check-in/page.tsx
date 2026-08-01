"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Frown,
  HelpCircle,
  Loader2,
  Meh,
  Mic,
  Smile,
} from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { useToast } from "@/components/toast";
import {
  pickRecorderMimeType,
  voiceMicDeniedMessage,
  voiceRecordingFileName,
  voiceUnavailableMessage,
} from "@/lib/client/voice-recording";

const NOTE_LIMIT = 500;
const MAX_VOICE_MS = 45_000;

const moods = [
  { label: "Better", hint: "Things have eased a bit", Icon: Smile },
  { label: "About the same", hint: "No big change", Icon: Meh },
  { label: "Worse", hint: "It’s been harder", Icon: Frown },
  { label: "Not sure", hint: "Hard to tell yet", Icon: HelpCircle },
] as const;

function CheckInFlow() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const planId = searchParams.get("planId");
  const planTitle = searchParams.get("title")?.trim() || "your Care plan";
  const promptParam = searchParams.get("prompt")?.trim() || "";

  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [nextStep, setNextStep] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question =
    promptParam ||
    `How have things been with ${planTitle === "your Care plan" ? "this" : planTitle} since we last spoke?`;

  const releaseMicStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    clearVoiceTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    releaseMicStream();
  }, []);

  async function transcribeRecording(blob: Blob) {
    if (blob.size === 0) {
      toast({ tone: "info", title: "Didn’t catch that", message: "Try again, or type a note." });
      return;
    }
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, voiceRecordingFileName(blob.type || "audio/webm"));
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || typeof data.text !== "string") {
        toast({
          tone: "warning",
          title: "Couldn’t use that clip",
          message: data?.error || "Try again, or type a note.",
        });
        return;
      }
      const transcript = data.text.trim();
      if (!transcript) return;
      setNote((current) => {
        const next = current ? `${current} ${transcript}` : transcript;
        return next.slice(0, NOTE_LIMIT);
      });
    } catch {
      toast({ tone: "warning", title: "Couldn’t use that clip", message: "Try again, or type a note." });
    } finally {
      setTranscribing(false);
    }
  }

  function stopVoiceRecording() {
    clearVoiceTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      releaseMicStream();
      setListening(false);
    }
  }

  async function startVoiceRecording() {
    if (mediaRecorderRef.current || transcribing) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({ tone: "info", title: "Voice unavailable", message: voiceUnavailableMessage() });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        releaseMicStream();
        setListening(false);
        void transcribeRecording(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setListening(true);
      voiceTimerRef.current = setTimeout(() => stopVoiceRecording(), MAX_VOICE_MS);
    } catch {
      releaseMicStream();
      setListening(false);
      toast({ tone: "warning", title: "Microphone blocked", message: voiceMicDeniedMessage() });
    }
  }

  function handleVoiceInput() {
    if (transcribing) return;
    if (listening || mediaRecorderRef.current) {
      stopVoiceRecording();
      return;
    }
    void startVoiceRecording();
  }

  async function handleContinue() {
    if (!planId) {
      setError("No Care plan selected for this check-in.");
      return;
    }
    if (!selected) {
      setError("Pick how things have been, then continue.");
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
      setNextStep(typeof data.nextStep === "string" ? data.nextStep : "");
      setDone(true);
    } catch {
      setError("Couldn't save your check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="focused-flow checkin-flow">
      <header className="focused-header">
        <Link href="/today" className="icon-only-btn" aria-label="Back to Today">
          <ArrowLeft />
        </Link>
        <NuraLogo compact href="/today" />
        <span className="focused-header-spacer" aria-hidden />
      </header>

      <section className="checkin-card">
        {done ? (
          <div className="completion-state">
            <span className="completion-icon" aria-hidden>
              <CheckCircle2 />
            </span>
            <h1>Check-in saved</h1>
            <p>
              Thanks — this update is on your <b>{planTitle}</b> Care plan
              {selected ? <> as <b>{selected.toLowerCase()}</b></> : null}.
            </p>
            {nextStep ? <p className="completion-next">{nextStep}</p> : null}
            <Link href={`/summary${planId ? `?planId=${planId}` : ""}`} className="primary-cta full">
              View updated summary
            </Link>
            <Link href="/today" className="text-link">
              Back to Today
            </Link>
          </div>
        ) : (
          <>
            <div className="checkin-eyebrow">
              <span>Check-in</span>
              <span className="checkin-journey-name" title={planTitle}>
                {planTitle}
              </span>
            </div>
            <h1>{question}</h1>
            <p className="checkin-lead">Pick the closest answer. Add a note if you want — optional.</p>

            <div className="answer-list" role="radiogroup" aria-label="How things have been">
              {moods.map(({ label, hint, Icon }) => {
                const isSelected = selected === label;
                return (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={isSelected ? "selected" : ""}
                    onClick={() => {
                      setSelected(label);
                      setError("");
                    }}
                  >
                    <span className="answer-icon" aria-hidden>
                      <Icon />
                    </span>
                    <span className="answer-copy">
                      <b>{label}</b>
                      <small>{hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="thought-box">
              <span>Anything else to add?</span>
              <div className={`thought-box-field${listening ? " listening" : ""}`}>
                <textarea
                  placeholder="Optional — a symptom, sleep note, or how the day felt…"
                  value={note}
                  maxLength={NOTE_LIMIT}
                  rows={3}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className={listening || transcribing ? "listening" : ""}
                  aria-label={
                    transcribing
                      ? "Transcribing"
                      : listening
                        ? "Stop recording"
                        : "Record a voice note"
                  }
                  title={
                    transcribing
                      ? "Turning speech into text…"
                      : listening
                        ? "Recording — tap to stop"
                        : "Tap to record a short note"
                  }
                  disabled={transcribing}
                  onClick={handleVoiceInput}
                >
                  {transcribing ? <Loader2 className="spin" /> : <Mic />}
                </button>
              </div>
              <div className="thought-box-meta">
                <small>{listening ? "Recording… tap mic to finish" : transcribing ? "Turning that into text…" : " "}</small>
                <small className="note-count">
                  {note.length}/{NOTE_LIMIT}
                </small>
              </div>
            </label>

            {error && (
              <p className="auth-error">
                <AlertCircle /> {error}
              </p>
            )}

            <button
              type="button"
              className="primary-cta full"
              onClick={() => void handleContinue()}
              disabled={submitting || !selected}
            >
              {submitting ? (
                <>
                  <Loader2 className="spin" /> Saving…
                </>
              ) : (
                "Save check-in"
              )}
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
