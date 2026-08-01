"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CreditCard,
  FileText,
  FolderHeart,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Smartphone,
  X,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { NuraLogo } from "@/components/nura-logo";
import { PhoneNumberInput } from "@/components/phone-number-input";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import { useToast } from "@/components/toast";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import {
  pickRecorderMimeType,
  voiceMicDeniedMessage,
  voiceRecordingFileName,
  voiceUnavailableMessage,
} from "@/lib/client/voice-recording";
import { applyIntakePrompt, onboardingInterests, promptsForInterests } from "@/lib/onboarding/intake-prompts";
import { NURA_PRODUCT } from "@/lib/product/nura-story";

type IntakeAttachment = {
  id: string;
  name: string;
  type: string;
  kind: "image" | "audio" | "document" | "file";
  text?: string;
  base64?: string;
};

const TOTAL_STEPS = 5;
const MAX_INTAKE_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_INTAKE_ATTACHMENTS = 4;
const MAX_VOICE_MS = 60_000;

const howItWorks = [
  [MessageCircle, "Tell Nura what’s going on", "A message, a note from the visit, or just say it out loud."],
  [FolderHeart, "It becomes a Care plan", "Nura keeps the important parts together so the care after the appointment doesn’t scatter."],
  [BellRing, "Care continues", "Gentle check-ins so the next step — and the sense someone’s with you — doesn’t slip away."],
] as const;

function attachmentKind(file: File): IntakeAttachment["kind"] {
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

async function readIntakeAttachment(file: File): Promise<IntakeAttachment> {
  const kind = attachmentKind(file);
  const canReadText = file.type.startsWith("text/") || Boolean(file.name.match(/\.(txt|md|csv|json)$/i));
  const type = file.type || "application/octet-stream";
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}-${Math.random()}`;
  if (canReadText) {
    return { id, name: file.name, type, kind, text: (await file.text()).slice(0, 4000) };
  }
  return { id, name: file.name, type, kind, base64: await fileToBase64(file) };
}

const chatChannels = [
  ["In the app", "Message Nura inside the app.", Smartphone],
  ["WhatsApp", "Keep the conversation going on WhatsApp.", MessageCircle],
] as const;

const checkinChannels = [
  ["In the app", "Gentle reminders stay inside Nura.", BellRing],
  ["WhatsApp", "Check-in messages on WhatsApp.", MessageCircle],
  ["Phone call", "A short voice check-in call.", Phone],
] as const;

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function mapChatChannel(selected: string[]) {
  const app = selected.includes("In the app");
  const wa = selected.includes("WhatsApp");
  if (app && wa) return "Both";
  if (wa) return "WhatsApp";
  return "In the app";
}

function WelcomeArt() {
  return (
    <div className="mobile-welcome-art" aria-hidden="true">
      <span className="welcome-art-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static onboarding illustration, no responsive/CDN sizing needed */}
      <img src="/illustrations/onboarding-welcome.png" alt="" className="welcome-illustration" />
      <span className="welcome-float-chip welcome-float-heart" />
      <span className="welcome-float-chip welcome-float-mic" />
    </div>
  );
}

function DesktopCopy({ step }: { step: number }) {
  const copy =
    step === 2
      ? ["You talk. Nura organises. Life keeps moving.", "Three moves: share what’s going on, let it become a Care plan, and let Nura bring the next step back when you need it."]
      : step === 3
        ? ["What do you want help with?", "Pick what matters most right now — Nura tailors your first Care plan and check-ins around it."]
        : step === 4
          ? ["Start with a real conversation.", "Tap one starter, edit it, and attach notes if you have them. Nura turns that into your first Care plan."]
          : step === 5
            ? ["How Nura reaches you.", "Pick every channel that fits — chat in the app and/or WhatsApp, and check-ins by app, WhatsApp, or phone."]
            : step === 6
              ? ["Connect WhatsApp to this account.", "Open WhatsApp with your unique link code so Nura can match messages and check-ins to you."]
              : step === 7
                ? ["Stay in the loop.", "Turn on browser notifications so a check-in or reply from Nura reaches you even when the tab isn’t open. Optional — skip it if you’d rather not."]
                : ["Start your free trial.", `Add a card to unlock Nura fully. You won’t be charged for ${CARD_TRIAL_DAYS} days, and you can cancel anytime before then.`];

  return (
    <aside className="onboarding-desktop-copy">
      <NuraLogo />
      <span className="auth-kicker">SET UP YOUR NURA</span>
      <h2>{copy[0]}</h2>
      <p>{copy[1]}</p>
      <div className="onboarding-desktop-note">
        <b>How this works</b>
        <span>You share what’s going on → Nura creates a Care plan → check-ins come back through the channel you choose.</span>
      </div>
    </aside>
  );
}

function OnboardingFlow() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  // Stripe/RevenueCat checkout cancellations land back here with ?paywall=1 —
  // send those users straight back to the paywall step instead of step 1.
  const [step, setStep] = useState(() => (searchParams.get("paywall") === "1" ? 8 : 1));
  const [selected, setSelected] = useState<string[]>([]);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [chatChannelsSelected, setChatChannelsSelected] = useState<string[]>(["In the app"]);
  const [checkinChannelsSelected, setCheckinChannelsSelected] = useState<string[]>(["In the app"]);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [intake, setIntake] = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [intakeAttachments, setIntakeAttachments] = useState<IntakeAttachment[]>([]);
  const [attachingFiles, setAttachingFiles] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // While the user is on the "connect WhatsApp" step, poll for the link completing so
  // switching back from WhatsApp shows a connected state instead of looking unchanged.
  useEffect(() => {
    if (step !== 6 || whatsappLinked) return;

    let cancelled = false;
    const checkLinked = async () => {
      try {
        const response = await fetch("/api/whatsapp/link?status=1", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!cancelled && data?.linked) setWhatsappLinked(true);
      } catch {
        // ignore - next poll will retry
      }
    };

    void checkLinked();
    const interval = setInterval(checkLinked, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, whatsappLinked]);

  const chatNeedsWhatsApp = chatChannelsSelected.includes("WhatsApp");
  const checkinNeedsWhatsApp = checkinChannelsSelected.includes("WhatsApp");
  const checkinNeedsCall = checkinChannelsSelected.includes("Phone call");
  const needsPhone = chatNeedsWhatsApp || checkinNeedsWhatsApp || checkinNeedsCall;
  const needsWhatsappLink = chatNeedsWhatsApp || checkinNeedsWhatsApp;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneIsValid = !needsPhone || phoneDigits.length >= 10;
  const channelsReady = chatChannelsSelected.length > 0 && checkinChannelsSelected.length > 0;
  const hasIntakeContent = Boolean(intake.trim()) || intakeAttachments.length > 0;
  const visiblePrompts = promptsForInterests(selected);
  const phoneLabel = checkinNeedsCall && !chatNeedsWhatsApp && !checkinNeedsWhatsApp
    ? "Phone number"
    : checkinNeedsCall
      ? "Phone / WhatsApp number"
      : "WhatsApp number";
  const contentStep = Math.min(step - 1, TOTAL_STEPS);
  const progressStep = Math.min(step - 1, TOTAL_STEPS);

  const toggle = (item: string) => {
    setSelected((current) => toggleValue(current, item));
  };

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
      const selected = Array.from(fileList).slice(0, Math.max(room, 0));
      if (selected.length === 0) {
        setIntakeError(`You can attach up to ${MAX_INTAKE_ATTACHMENTS} files.`);
        return;
      }
      const oversized = selected.find((file) => file.size > MAX_INTAKE_ATTACHMENT_BYTES);
      if (oversized) {
        setIntakeError(`“${oversized.name}” is too large. Keep each file under 4MB.`);
        return;
      }
      const next = await Promise.all(selected.map(readIntakeAttachment));
      setIntakeAttachments((current) => [...current, ...next].slice(0, MAX_INTAKE_ATTACHMENTS));
    } catch {
      setIntakeError("Couldn’t read that file. Try a photo, PDF, or text note.");
    } finally {
      setAttachingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setIntakeAttachments((current) => current.filter((file) => file.id !== id));
  };

  const toggleChatChannel = (title: string) => {
    setChatChannelsSelected((current) => toggleValue(current, title));
    setChannelError(null);
  };

  const toggleCheckinChannel = (title: string) => {
    setCheckinChannelsSelected((current) => toggleValue(current, title));
    setChannelError(null);
  };

  const updatePhone = (value: string) => {
    setPhone(value);
    if (phoneError) setPhoneError(null);
  };

  const assertChannelsReady = () => {
    if (chatChannelsSelected.length === 0 || checkinChannelsSelected.length === 0) {
      setChannelError("Pick at least one chat option and one check-in option.");
      return false;
    }
    setChannelError(null);
    return true;
  };

  const assertPhoneReady = () => {
    if (!needsPhone) return true;
    if (phoneDigits.length < 10) {
      setPhoneError(
        checkinNeedsCall && !chatNeedsWhatsApp && !checkinNeedsWhatsApp
          ? "Enter a full phone number so Nura can call you."
          : "Enter a full number, including country code.",
      );
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const goNext = () => {
    if (step === 3) {
      if (selected.length === 0) {
        setInterestError("Pick at least one so Nura knows where to start.");
        return;
      }
      setInterestError(null);
    }
    if (step === 5) {
      if (!assertChannelsReady() || !assertPhoneReady()) return;
      void completeOnboarding();
      return;
    }
    setStep((current) => current + 1);
  };

  const completeOnboarding = async (options?: { skipIntake?: boolean }) => {
    if (submitting) return;
    if (!assertChannelsReady() || !assertPhoneReady()) {
      setStep(5);
      return;
    }
    const skip = options?.skipIntake || (!intake.trim() && intakeAttachments.length === 0);
    if (!skip && !intake.trim() && intakeAttachments.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: selected,
          channel: mapChatChannel(chatChannelsSelected),
          checkinChannels: checkinChannelsSelected,
          phone: needsPhone ? phoneDigits : "",
          intake: skip ? "" : intake,
          attachments: skip
            ? []
            : intakeAttachments.map(({ name, type, kind, text, base64 }) => ({ name, type, kind, text, base64 })),
          skip,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.error === "phone_required") {
          setPhoneError("A phone number is required for WhatsApp or phone check-ins.");
          setStep(5);
          setSubmitting(false);
          return;
        }
        if (data?.error === "channels_required") {
          setChannelError("Pick at least one chat option and one check-in option.");
          setStep(5);
          setSubmitting(false);
          return;
        }
        throw new Error("Could not save your details. Please try again.");
      }

      // WhatsApp next (if chosen), then enforced trial paywall last before dashboard.
      setStep(needsWhatsappLink ? 6 : 7);
      setSubmitting(false);
    } catch {
      setSubmitError("Something went wrong saving that. Please try again.");
      setSubmitting(false);
    }
  };

  const transcribeRecording = async (blob: Blob) => {
    if (blob.size === 0) {
      toast({
        tone: "info",
        title: "Didn’t catch that",
        message: "Try the mic again, or type it in.",
      });
      return;
    }

    setTranscribing(true);
    try {
      const formData = new FormData();
      const fileName = voiceRecordingFileName(blob.type || "audio/webm");
      formData.append("audio", blob, fileName);
      const res = await fetch("/api/onboarding/transcribe", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || typeof data.text !== "string") {
        toast({
          tone: "warning",
          title: "Couldn’t use that clip",
          message: data?.error || "Try again, or type it in.",
        });
        return;
      }
      const transcript = data.text.trim();
      if (!transcript) {
        toast({
          tone: "info",
          title: "Didn’t catch that",
          message: "Try the mic again, or type it in.",
        });
        return;
      }
      setIntake((current) => (current ? `${current} ${transcript}` : transcript));
      setIntakeError(null);
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

  const stopVoiceRecording = () => {
    clearVoiceTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      releaseMicStream();
      setListening(false);
    }
  };

  const startVoiceRecording = async () => {
    if (mediaRecorderRef.current || transcribing) return;
    if (typeof MediaRecorder === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({
        tone: "info",
        title: "Voice unavailable",
        message: voiceUnavailableMessage(),
      });
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
      recorder.onerror = () => {
        mediaRecorderRef.current = null;
        releaseMicStream();
        setListening(false);
        toast({
          tone: "warning",
          title: "Recording failed",
          message: "Try again, or type it in.",
        });
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
      // Timeslice keeps chunks flowing on iOS WKWebView; without it some devices yield an empty blob.
      recorder.start(250);
      setListening(true);
      voiceTimerRef.current = setTimeout(() => stopVoiceRecording(), MAX_VOICE_MS);
    } catch {
      releaseMicStream();
      setListening(false);
      toast({
        tone: "warning",
        title: "Microphone blocked",
        message: voiceMicDeniedMessage(),
      });
    }
  };

  const handleVoiceInput = () => {
    if (transcribing) return;
    if (listening || mediaRecorderRef.current) {
      stopVoiceRecording();
      return;
    }
    void startVoiceRecording();
  };

  return (
    <main className={`onboarding mobile-onboarding step-${step}`}>
      {step === 1 ? (
        <section className="mobile-welcome-screen">
          <div className="welcome-desktop-copy">
            <NuraLogo />
            <span className="auth-kicker">CARE BETWEEN CLINICAL MOMENTS</span>
            <h1>{NURA_PRODUCT.onboardingHeadline}</h1>
            <p>{NURA_PRODUCT.onboardingSupport}</p>
            <div className="welcome-desktop-points">
              <span>Message, voice or upload context</span>
              <span>Builds Care plans from what matters</span>
              <span>Follows up through your preferred channel</span>
            </div>
          </div>
          <div className="mobile-welcome-content">
            <div className="mobile-welcome-brand">
              <NuraLogo />
            </div>
            <div className="mobile-welcome-copy">
              <span className="auth-kicker">WELCOME TO NURA</span>
              <h1>{NURA_PRODUCT.heroHeadline}</h1>
              <p>{NURA_PRODUCT.shortSummary}</p>
            </div>
            <WelcomeArt />
            <div className="mobile-welcome-actions">
              <button className="primary-cta onboarding-primary" onClick={() => setStep(2)}>
                Get started
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <header className="onboarding-header">
            {step === 6 ? (
              <span className="onboarding-header-spacer" aria-hidden="true" />
            ) : (
              <button className="onboarding-back" aria-label="Go back" onClick={() => setStep(step - 1)}>
                <ArrowLeft />
              </button>
            )}
            <span className="onboarding-step-count" aria-label={step >= 8 ? "Almost done" : `Step ${contentStep} of ${TOTAL_STEPS}`}>
              {step >= 8 ? "Almost done" : `${contentStep} of ${TOTAL_STEPS}`}
            </span>
            <span className="onboarding-header-spacer" aria-hidden="true" />
          </header>
          <div className="onboarding-progress">
            <span style={{ width: `${(step >= 8 ? TOTAL_STEPS : progressStep) / TOTAL_STEPS * 100}%` }} />
          </div>

          <div className="onboarding-desktop-layout">
            <DesktopCopy step={step} />
            <section className="onboarding-card">
              {step === 2 && (
                <>
                  <span className="auth-kicker">HOW NURA WORKS</span>
                  <h1>Three simple moves.</h1>
                  <p className="onboarding-intro how-intro">
                    You talk. Nura organises. Then it brings the next step back when life gets busy.
                  </p>
                  <ol className="how-it-works-list how-flow">
                    {howItWorks.map(([Icon, title, copy], index) => (
                      <li
                        key={title}
                        className="how-flow-step"
                        style={{ ["--how-i" as string]: index }}
                      >
                        <span className="how-flow-rail" aria-hidden="true">
                          <span className="how-flow-icon">
                            <Icon size={18} strokeWidth={2.1} />
                          </span>
                        </span>
                        <div className="how-flow-copy">
                          <span className="how-flow-index">0{index + 1}</span>
                          <h3>{title}</h3>
                          <p>{copy}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {step === 3 && (
                <>
                  <span className="auth-kicker">WHY NURA</span>
                  <h1>What do you want help with?</h1>
                  <p className="onboarding-intro interest-intro">
                    Pick at least one — Nura tailors your first Care plan and check-ins around it.
                  </p>
                  {selected.length > 0 && (
                    <p className="interest-count" aria-live="polite">
                      {selected.length} selected
                    </p>
                  )}
                  <div
                    className="interest-grid mobile-interest-list interest-flow"
                    role="group"
                    aria-label="What you want help with"
                  >
                    {onboardingInterests.map(([label, Icon], index) => {
                      const isSelected = selected.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggle(label)}
                          className={isSelected ? "selected" : ""}
                          aria-pressed={isSelected}
                          style={{ ["--interest-i" as string]: index }}
                        >
                          <span className="interest-icon" aria-hidden="true">
                            <Icon size={18} strokeWidth={2.1} />
                          </span>
                          <span className="interest-label">{label}</span>
                          <span className="selection-check" aria-hidden="true">
                            {isSelected && <Check size={13} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {interestError && <p className="auth-error">{interestError}</p>}
                </>
              )}

              {step === 4 && (
                <div className="final-intake-screen intake-flow">
                  <span className="auth-kicker">YOUR FIRST CARE PLAN</span>
                  <h1>Tell Nura what’s going on</h1>
                  <p className="onboarding-intro intake-intro">
                    Starters below are shaped by what you picked — tap one to begin, then edit in your own words. Attach notes, summaries, or drug info if you have them.
                  </p>
                  <div className="prompt-suggestions final-intake-prompts intake-prompt-grid" role="group" aria-label="Sample starters">
                    {visiblePrompts.map(([label]) => {
                      const isSelected = activePrompt === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          className={isSelected ? "selected" : ""}
                          aria-pressed={isSelected}
                          onClick={() => choosePrompt(label)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {intakeError && <p className="auth-error">{intakeError}</p>}
                  <div className="final-intake-composer intake-composer">
                    <textarea
                      placeholder="Add anything else in your own words…"
                      aria-label="What you want Nura to remember"
                      value={intake}
                      rows={4}
                      onChange={(e) => {
                        setIntake(e.target.value);
                        setActivePrompt(null);
                        setIntakeError(null);
                      }}
                    />
                    {(listening || transcribing) && (
                      <p className="intake-voice-status" role="status">
                        {transcribing ? "Turning that into text…" : "Recording… tap the mic when you’re done."}
                      </p>
                    )}
                    <div className="intake-composer-actions">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        accept="image/*,.pdf,.doc,.docx,.txt,.md,application/pdf"
                        multiple
                        onChange={(event) => void handleAttachFiles(event.target.files)}
                      />
                      <button
                        aria-label="Attach notes or documents"
                        title="Attach notes, summaries, or drug info"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={attachingFiles || intakeAttachments.length >= MAX_INTAKE_ATTACHMENTS}
                      >
                        {attachingFiles ? <Loader2 className="spin" /> : <Paperclip />}
                      </button>
                      <button
                        aria-label={
                          transcribing
                            ? "Transcribing voice note"
                            : listening
                              ? "Stop recording"
                              : "Record a voice note"
                        }
                        title={
                          transcribing
                            ? "Turning speech into text…"
                            : listening
                              ? "Recording — tap to stop"
                              : "Tap to record, tap again to stop"
                        }
                        type="button"
                        className={listening || transcribing ? "listening" : ""}
                        aria-pressed={listening}
                        disabled={transcribing}
                        onClick={handleVoiceInput}
                      >
                        {transcribing ? <Loader2 className="spin" /> : <Mic />}
                        {listening ? <span className="intake-mic-pulse" aria-hidden /> : null}
                      </button>
                    </div>
                  </div>
                  {intakeAttachments.length > 0 && (
                    <ul className="intake-attachment-list">
                      {intakeAttachments.map((file) => (
                        <li key={file.id}>
                          <FileText size={14} aria-hidden="true" />
                          <span>{file.name}</span>
                          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(file.id)}>
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="reach-prefs">
                  <span className="auth-kicker">HOW NURA REACHES YOU</span>
                  <h1>How should Nura reach you?</h1>
                  <p className="onboarding-intro channel-intro">
                    Select all that apply. Chat and check-ins can use different channels — change anytime from Me.
                  </p>

                  <section className="reach-section" aria-labelledby="chat-pref-heading">
                    <div className="reach-section-head">
                      <h2 id="chat-pref-heading">Chat with Nura</h2>
                      <p>Where you talk things through. Select one or both.</p>
                    </div>
                    <div className="channel-options mobile-channel-options channel-flow" role="group" aria-labelledby="chat-pref-heading">
                      {chatChannels.map(([title, copy, Icon], index) => {
                        const isSelected = chatChannelsSelected.includes(title);
                        return (
                          <button
                            key={title}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleChatChannel(title)}
                            className={isSelected ? "selected" : ""}
                            style={{ ["--channel-i" as string]: index }}
                          >
                            <span className="channel-icon" aria-hidden="true">
                              <Icon size={18} strokeWidth={2.1} />
                            </span>
                            <span>
                              <b>{title}</b>
                              <small>{copy}</small>
                            </span>
                            <span className="selection-check" aria-hidden="true">
                              {isSelected && <Check size={13} strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="reach-section" aria-labelledby="checkin-pref-heading">
                    <div className="reach-section-head">
                      <h2 id="checkin-pref-heading">Check-ins from Nura</h2>
                      <p>How Nura brings the next step back. Select any that work.</p>
                    </div>
                    <div className="channel-options mobile-channel-options channel-flow" role="group" aria-labelledby="checkin-pref-heading">
                      {checkinChannels.map(([title, copy, Icon], index) => {
                        const isSelected = checkinChannelsSelected.includes(title);
                        return (
                          <button
                            key={title}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleCheckinChannel(title)}
                            className={isSelected ? "selected" : ""}
                            style={{ ["--channel-i" as string]: index + 2 }}
                          >
                            <span className="channel-icon" aria-hidden="true">
                              <Icon size={18} strokeWidth={2.1} />
                            </span>
                            <span>
                              <b>{title}</b>
                              <small>{copy}</small>
                            </span>
                            <span className="selection-check" aria-hidden="true">
                              {isSelected && <Check size={13} strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {channelError && (
                    <p className="field-error channel-error" role="alert">
                      {channelError}
                    </p>
                  )}

                  {needsPhone && (
                    <label className={`onboarding-phone-field${phoneError ? " has-error" : ""}`} htmlFor="onboarding-phone">
                      <span>
                        {phoneLabel} <em className="required-mark">Required</em>
                      </span>
                      <PhoneNumberInput id="onboarding-phone" value={phone} onChange={updatePhone} />
                      {phoneError ? (
                        <small className="field-error" role="alert">{phoneError}</small>
                      ) : (
                        <small>
                          {checkinNeedsCall && !chatNeedsWhatsApp && !checkinNeedsWhatsApp
                            ? "Required for voice check-ins. Never shared — remove anytime from Me."
                            : "Required so Nura can reach this number. Connecting WhatsApp with your link code still happens after setup."}
                        </small>
                      )}
                    </label>
                  )}

                  {needsWhatsappLink && (
                    <div className="whatsapp-connect-preview">
                      <b>WhatsApp comes next</b>
                      <p>
                        Choosing WhatsApp saves your preference. After you finish setup, you’ll open WhatsApp with a unique link code so Nura can match chat and check-ins to this account.
                      </p>
                    </div>
                  )}

                  {submitError && <p className="auth-error">{submitError}</p>}

                  <div className="control-note">We’ll never message or call without a reason you chose.</div>
                </div>
              )}

              {step === 6 && whatsappLinked && (
                <div className="whatsapp-connect-screen whatsapp-connect-screen--linked">
                  <span className="auth-kicker">CONNECT WHATSAPP</span>
                  <h1>WhatsApp connected</h1>
                  <p className="onboarding-intro channel-intro">
                    Your number is linked to this account. Nura will follow up here from now on.
                  </p>
                  <div className="whatsapp-connected-badge" role="status">
                    <Check size={16} strokeWidth={3} /> Connected
                  </div>
                  <WhatsAppOpenButton className="secondary-cta whatsapp-connect-cta" linked />
                </div>
              )}

              {step === 6 && !whatsappLinked && (
                <div className="whatsapp-connect-screen">
                  <span className="auth-kicker">CONNECT WHATSAPP</span>
                  <h1>Link WhatsApp to Nura</h1>
                  <p className="onboarding-intro channel-intro">
                    Tap Connect WhatsApp. We’ll open a chat with a one-time code for this account — send that message so Nura can recognise you.
                  </p>
                  <ol className="whatsapp-connect-steps">
                    <li>Open WhatsApp with your link code</li>
                    <li>Send the prefilled message to Nura</li>
                    <li>Come back here — you’re connected</li>
                  </ol>
                  <WhatsAppOpenButton className="primary-cta onboarding-primary whatsapp-connect-cta" />
                  <p className="control-note">
                    You can also connect later from Today or Workspace. Phone number alone doesn’t complete the link — the code does.
                  </p>
                </div>
              )}

              {step === 7 && (
                <div className="whatsapp-connect-screen">
                  <span className="auth-kicker">STAY IN THE LOOP</span>
                  <h1>Turn on notifications</h1>
                  <p className="onboarding-intro channel-intro">
                    Optional — get a nudge in this browser when Nura has a check-in or reply for you, even if the tab isn’t open. You can skip this and turn it on later from Me.
                  </p>
                  <PushNotificationsToggle />
                  <p className="control-note">You can change this anytime from Me → Notifications.</p>
                </div>
              )}

              {step === 8 && (
                <div className="paywall-screen">
                  <span className="auth-kicker">START YOUR TRIAL</span>
                  <h1>Start your {CARD_TRIAL_DAYS}-day free trial</h1>
                  <p className="onboarding-intro paywall-intro">
                    Last step before your dashboard. Add a card to keep Nura going after the trial. You won’t be charged for {CARD_TRIAL_DAYS} days, and you can cancel anytime before then.
                  </p>
                  <ul className="paywall-benefits">
                    <li><Check size={14} strokeWidth={3} /> Unlimited Care plans and check-ins</li>
                    <li><Check size={14} strokeWidth={3} /> Voice, WhatsApp, and document uploads</li>
                    <li><Check size={14} strokeWidth={3} /> Cancel anytime before the trial ends</li>
                  </ul>
                  <a href="/api/billing/checkout" className="primary-cta onboarding-primary paywall-cta">
                    <CreditCard size={18} /> Start {CARD_TRIAL_DAYS}-day free trial
                  </a>
                  <p className="control-note">
                    A card is required to start the trial — you won’t be charged until day {CARD_TRIAL_DAYS + 1}.
                  </p>
                </div>
              )}

              {step !== 8 && (
                <footer className="onboarding-footer">
                  {step === 4 ? (
                    <>
                      <button
                        className="primary-cta onboarding-primary"
                        type="button"
                        onClick={() => setStep(5)}
                        disabled={!hasIntakeContent}
                      >
                        Continue <ArrowRight />
                      </button>
                      <button
                        className="skip-intake-button"
                        type="button"
                        onClick={() => {
                          setIntake("");
                          setActivePrompt(null);
                          setIntakeAttachments([]);
                          setStep(5);
                        }}
                      >
                        Skip for now
                      </button>
                    </>
                  ) : step === 5 ? (
                    <button
                      className="primary-cta onboarding-primary"
                      type="button"
                      onClick={goNext}
                      disabled={submitting || !channelsReady || (needsPhone && !phoneIsValid)}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="spin" /> Saving…
                        </>
                      ) : (
                        <>
                          Continue <ArrowRight />
                        </>
                      )}
                    </button>
                  ) : step === 6 ? (
                    <button
                      className="primary-cta onboarding-primary"
                      type="button"
                      onClick={() => setStep(7)}
                    >
                      Continue <ArrowRight />
                    </button>
                  ) : (
                    <button
                      className="primary-cta onboarding-primary"
                      type="button"
                      onClick={goNext}
                      disabled={step === 3 && selected.length === 0}
                    >
                      Continue <ArrowRight />
                    </button>
                  )}
                </footer>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

export default function Onboarding() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  );
}
