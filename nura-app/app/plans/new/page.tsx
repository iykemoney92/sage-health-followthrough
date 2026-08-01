"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderHeart,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NuraLogo } from "@/components/nura-logo";
import { useToast } from "@/components/toast";
import {
  pickRecorderMimeType,
  voiceMicDeniedMessage,
  voiceRecordingFileName,
  voiceUnavailableMessage,
} from "@/lib/client/voice-recording";
import { applyIntakePrompt, onboardingInterests, promptsForInterests } from "@/lib/onboarding/intake-prompts";

type IntakeAttachment = {
  id: string;
  name: string;
  type: string;
  kind: "image" | "audio" | "document" | "file";
  text?: string;
  base64?: string;
};

type CheckInChannel = "whatsapp" | "in_app" | "voice";

const TOTAL_STEPS = 3;
const MAX_INTAKE_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_INTAKE_ATTACHMENTS = 4;
const MAX_VOICE_MS = 60_000;

const CHECKIN_OPTIONS = [
  ["in_app", "In the app", "Gentle reminders stay inside Nura.", Smartphone],
  ["whatsapp", "WhatsApp", "Check-in messages on WhatsApp.", MessageCircle],
  ["voice", "Phone call", "A short voice check-in call.", Phone],
] as const;

function toggleValue<T extends string>(current: T[], value: T) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function attachmentKind(file: File): IntakeAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.includes("pdf") || file.type.includes("document") || file.name.match(/\.(pdf|doc|docx|txt|md)$/i)) {
    return "document";
  }
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

async function readIntakeAttachment(file: File): Promise<IntakeAttachment> {
  const kind = attachmentKind(file);
  const canReadText = file.type.startsWith("text/") || Boolean(file.name.match(/\.(txt|md|csv|json)$/i));
  const type = file.type || "application/octet-stream";
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `att-${Date.now()}-${Math.random()}`;
  if (canReadText) {
    return { id, name: file.name, type, kind, text: (await file.text()).slice(0, 4000) };
  }
  return { id, name: file.name, type, kind, base64: await fileToBase64(file) };
}

export default function NewCarePlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [intake, setIntake] = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [intakeAttachments, setIntakeAttachments] = useState<IntakeAttachment[]>([]);
  const [attachingFiles, setAttachingFiles] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [checkinChannels, setCheckinChannels] = useState<CheckInChannel[]>(["in_app"]);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/checkin-channels", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data?.channels?.length) return;
        const filtered = (data.channels as string[]).filter(
          (c): c is CheckInChannel => c === "whatsapp" || c === "in_app" || c === "voice",
        );
        if (filtered.length > 0) setCheckinChannels(filtered);
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(
    () => () => {
      clearVoiceTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      releaseMicStream();
    },
    [],
  );

  const visiblePrompts = promptsForInterests(selected);
  const hasIntakeContent = Boolean(intake.trim()) || intakeAttachments.length > 0;

  const choosePrompt = (label: string) => {
    setActivePrompt(label);
    setIntake(applyIntakePrompt(label));
    setIntakeError(null);
  };

  const handleAttachFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setAttachingFiles(true);
    setIntakeError(null);
    try {
      const room = MAX_INTAKE_ATTACHMENTS - intakeAttachments.length;
      const picked = Array.from(fileList).slice(0, Math.max(room, 0));
      if (picked.length === 0) {
        setIntakeError(`You can attach up to ${MAX_INTAKE_ATTACHMENTS} files.`);
        return;
      }
      const oversized = picked.find((file) => file.size > MAX_INTAKE_ATTACHMENT_BYTES);
      if (oversized) {
        setIntakeError(`“${oversized.name}” is too large. Keep each file under 4MB.`);
        return;
      }
      const next = await Promise.all(picked.map(readIntakeAttachment));
      setIntakeAttachments((current) => [...current, ...next].slice(0, MAX_INTAKE_ATTACHMENTS));
    } catch {
      setIntakeError("Couldn’t read that file. Try a photo, PDF, or text note.");
    } finally {
      setAttachingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startVoice = async () => {
    if (listening || transcribing) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({ tone: "warning", title: "Voice unavailable", message: voiceUnavailableMessage() });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        clearVoiceTimer();
        releaseMicStream();
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 200) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, voiceRecordingFileName(recorder.mimeType));
          const res = await fetch("/api/onboarding/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok || typeof data.text !== "string") throw new Error("transcribe_failed");
          const transcript = data.text.trim();
          if (transcript) {
            setIntake((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
            setIntakeError(null);
          }
        } catch {
          toast({
            tone: "warning",
            title: "Couldn’t use that clip",
            message: "Try again, or type it in.",
          });
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
      voiceTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      }, MAX_VOICE_MS);
    } catch (error) {
      const denied =
        error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      toast({
        tone: "warning",
        title: denied ? "Microphone blocked" : "Voice unavailable",
        message: denied ? voiceMicDeniedMessage() : voiceUnavailableMessage(),
      });
      releaseMicStream();
    }
  };

  const stopVoice = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const goNext = () => {
    if (step === 1) {
      if (selected.length === 0) {
        setInterestError("Pick at least one so Nura knows where to start.");
        return;
      }
      setInterestError(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!hasIntakeContent) {
        setIntakeError("Share a bit about what’s going on, or attach a note.");
        return;
      }
      setIntakeError(null);
      setStep(3);
      return;
    }
    void submitCarePlan();
  };

  const submitCarePlan = async () => {
    if (submitting) return;
    if (checkinChannels.length === 0) {
      setChannelError("Pick at least one check-in channel.");
      return;
    }
    setChannelError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/plans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: selected,
          intake,
          checkinChannels,
          attachments: intakeAttachments.map(({ name, type, kind, text, base64 }) => ({
            name,
            type,
            kind,
            text,
            base64,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 402) {
        setSubmitError(data?.message ?? "Nura Plus is needed for more Care plans.");
        setSubmitting(false);
        return;
      }
      if (data?.error === "phone_required") {
        setSubmitError(data.message ?? "Add a phone number in Me → Channels for WhatsApp or call check-ins.");
        setSubmitting(false);
        return;
      }
      if (!res.ok || !data?.planId) {
        throw new Error(data?.error ?? "create_failed");
      }
      toast({ tone: "success", title: "Care plan ready", message: data.plan?.title ?? "Opened" });
      router.push(`/plans/${data.planId}`);
    } catch {
      setSubmitError("Couldn’t start that Care plan. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="mobile-onboarding care-plan-create">
      <header className="onboarding-top">
        <Link href="/plans" className="icon-only-btn" aria-label="Back to Care plans">
          <ArrowLeft />
        </Link>
        <NuraLogo compact href="/today" />
        <span className="onboarding-step-label">
          {step}/{TOTAL_STEPS}
        </span>
      </header>

      <div className="onboarding-progress" aria-hidden>
        <span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>

      {step === 1 && (
        <section className="onboarding-card">
          <span className="auth-kicker">NEW CARE PLAN</span>
          <h1>What do you want help with?</h1>
          <p className="onboarding-intro interest-intro">
            Pick at least one — Nura builds a Care plan from what you share next.
          </p>
          <div className="interest-grid mobile-interest-list interest-flow" role="group" aria-label="What you want help with">
            {onboardingInterests.map(([label, Icon], index) => {
              const active = selected.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  className={active ? "selected" : ""}
                  aria-pressed={active}
                  style={{ ["--interest-i" as string]: index }}
                  onClick={() => {
                    setSelected((current) => toggleValue(current, label));
                    setInterestError(null);
                  }}
                >
                  <span className="interest-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.1} />
                  </span>
                  <span className="interest-label">{label}</span>
                  <span className="selection-check" aria-hidden="true">
                    {active ? <Check size={13} strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {interestError ? <p className="auth-error">{interestError}</p> : null}
        </section>
      )}

      {step === 2 && (
        <section className="onboarding-card">
          <div className="final-intake-screen intake-flow">
            <span className="auth-kicker">SHARE CONTEXT</span>
            <h1>What’s going on?</h1>
            <p className="onboarding-intro intake-intro">
              Tap a starter, edit it, or attach notes. Nura turns this into your Care plan.
            </p>
            <div className="prompt-suggestions final-intake-prompts intake-prompt-grid" role="group" aria-label="Sample starters">
              {visiblePrompts.map(([label]) => (
                <button
                  key={label}
                  type="button"
                  className={activePrompt === label ? "selected" : ""}
                  onClick={() => choosePrompt(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            {intakeError ? <p className="auth-error">{intakeError}</p> : null}
            <div className="final-intake-composer intake-composer">
              <textarea
                rows={6}
                value={intake}
                onChange={(event) => {
                  setIntake(event.target.value);
                  setIntakeError(null);
                }}
                placeholder="In your own words…"
              />
              {(listening || transcribing) && (
                <p className="intake-voice-status" role="status">
                  {listening ? "Listening…" : "Transcribing…"}
                </p>
              )}
              <div className="intake-composer-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={attachingFiles}>
                  <Paperclip /> {attachingFiles ? "Adding…" : "Attach"}
                </button>
                <button type="button" onClick={() => (listening ? stopVoice() : void startVoice())} disabled={transcribing}>
                  {listening ? <span className="intake-mic-pulse" aria-hidden /> : null}
                  {transcribing ? <Loader2 className="spin" /> : <Mic />}
                  {listening ? "Stop" : transcribing ? "Listening…" : "Voice"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  accept="image/*,audio/*,.pdf,.txt,.md,.doc,.docx"
                  onChange={(event) => void handleAttachFiles(event.target.files)}
                />
              </div>
            </div>
            {intakeAttachments.length > 0 && (
              <ul className="intake-attachment-list">
                {intakeAttachments.map((file) => (
                  <li key={file.id}>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setIntakeAttachments((current) => current.filter((item) => item.id !== file.id))}
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="onboarding-card">
          <span className="auth-kicker">CHECK-INS</span>
          <h1>How should Nura check in?</h1>
          <p className="onboarding-intro channel-intro">
            Uses your saved preferences — change them for this Care plan if you like.
          </p>
          <div className="channel-options mobile-channel-options channel-flow" role="group" aria-label="Check-in channels">
            {CHECKIN_OPTIONS.map(([value, title, copy, Icon]) => {
              const active = checkinChannels.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={active ? "selected" : ""}
                  aria-pressed={active}
                  onClick={() => {
                    setCheckinChannels((current) => toggleValue(current, value));
                    setChannelError(null);
                  }}
                >
                  <span className="channel-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <div>
                    <b>{title}</b>
                    <span>{copy}</span>
                  </div>
                  <span className="selection-check" aria-hidden="true">
                    {active ? <Check size={13} strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {channelError ? <p className="field-error channel-error" role="alert">{channelError}</p> : null}
          {submitError ? <p className="auth-error" role="alert">{submitError}</p> : null}
          {submitError?.includes("Plus") ? (
            <Link href="/billing" className="text-link">
              View Nura Plus
            </Link>
          ) : null}
        </section>
      )}

      <footer className="onboarding-footer">
        {step > 1 ? (
          <button type="button" className="secondary-cta" onClick={() => setStep((current) => current - 1)} disabled={submitting}>
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="primary-cta onboarding-primary" onClick={goNext} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="spin" /> Building Care plan…
            </>
          ) : step === 3 ? (
            <>
              <FolderHeart /> Start Care plan
            </>
          ) : (
            <>
              Continue <ArrowRight />
            </>
          )}
        </button>
      </footer>
    </main>
  );
}
