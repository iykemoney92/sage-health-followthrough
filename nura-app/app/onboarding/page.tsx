"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BellRing, Check, FolderHeart, HeartPulse, Loader2, MessageCircle, Mic, Moon, Pill, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { NuraLogo } from "@/components/nura-logo";

const interests = [
  ["Stress or emotional wellbeing", HeartPulse],
  ["Medication follow-through", Pill],
  ["GP or clinic follow-up", MessageCircle],
  ["Symptoms I want to track", HeartPulse],
  ["Sleep and routine", Moon],
  ["Recovery or return to work", HeartPulse],
  ["General health organisation", FolderHeart],
  ["Something else", MessageCircle],
] as const;

const howItWorks = [
  [MessageCircle, "Tell Nura what’s going on", "Share a message, upload a note, or talk it out."],
  [FolderHeart, "Nura organises it", "Important things become Threads that Nura keeps track of."],
  [BellRing, "Nura follows up", "Check-ins, reminders and summaries help you stay on track."],
] as const;

type SpeechRecognitionResultEvent = {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function WelcomeArt() {
  return (
    <div className="mobile-welcome-art" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- static onboarding illustration, no responsive/CDN sizing needed */}
      <img src="/illustrations/onboarding-welcome.png" alt="" className="welcome-illustration" />
    </div>
  );
}

function DesktopCopy({ step }: { step: number }) {
  const copy = step === 2
    ? ["Nura turns conversations into follow-through.", "This short setup helps Nura understand how to organise your care context, create Threads and bring the right next step back at the right time."]
    : step === 3
      ? ["Choose what Nura should remember first.", "These choices guide the first Threads Nura creates for you. You can change them later from Me."]
      : step === 4
        ? ["Pick how Nura should check in.", "Nura only follows up through channels you choose, and every check-in stays tied to the relevant Thread."]
        : step === 5
          ? ["How should Nura reach you?", "Optional, and only used for the check-ins you ask for. You can add or remove this anytime from Me."]
          : ["Start with the real-life context.", "A normal message is enough. Nura uses it to create your first Thread and prepare useful follow-up."];

  return (
    <aside className="onboarding-desktop-copy">
      <NuraLogo />
      <span className="auth-kicker">SET UP YOUR NURA</span>
      <h2>{copy[0]}</h2>
      <p>{copy[1]}</p>
      <div className="onboarding-desktop-note">
        <b>Demo path</b>
        <span>Sarah tells Nura what happened, Nura creates a Thread, then schedules check-ins and reminders.</span>
      </div>
    </aside>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [channel, setChannel] = useState("WhatsApp");
  const [checkinMethod, setCheckinMethod] = useState("WhatsApp");
  const [phone, setPhone] = useState("");
  const [intake, setIntake] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const toggle = (item: string) => {
    setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  };

  const handleFinish = async () => {
    if (!intake.trim() || submitting || skipping) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected, channel, intake, phone }),
      });
      if (!res.ok) throw new Error("Could not save your details. Please try again.");
      router.push("/today");
      router.refresh();
    } catch {
      setSubmitError("Something went wrong saving that. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (submitting || skipping) return;
    setSkipping(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected, channel, phone, skip: true }),
      });
      if (!res.ok) throw new Error("Could not skip setup. Please try again.");
      router.push("/today");
      router.refresh();
    } catch {
      setSubmitError("Something went wrong skipping this. Please try again.");
      setSkipping(false);
    }
  };

  const handleVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSubmitError("Voice input is not available in this browser. You can type it instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setListening(true);
      setSubmitError(null);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
      setSubmitError("I couldn't hear that clearly. Try again or type it in.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setIntake((current) => current ? `${current} ${transcript}` : transcript);
      }
    };

    recognition.start();
  };

  return (
    <main className={`onboarding mobile-onboarding step-${step}`}>
      {step === 1 ? (
        <section className="mobile-welcome-screen">
          <div className="welcome-desktop-copy">
            <NuraLogo />
            <span className="auth-kicker">CONVERSATION-FIRST HEALTH MEMORY</span>
            <h1>Your health, remembered between appointments.</h1>
            <p>Tell Nura what is happening in plain language. Nura turns the important parts into Threads, reminders and check-ins, so follow-through does not disappear after the appointment.</p>
            <div className="welcome-desktop-points">
              <span>Message, voice or upload context</span>
              <span>Builds Threads from what matters</span>
              <span>Follows up through your preferred channel</span>
            </div>
          </div>
          <div className="mobile-welcome-content">
            <div className="mobile-welcome-brand"><NuraLogo /></div>
            <div className="mobile-welcome-copy">
              <span className="auth-kicker">WELCOME TO NURA</span>
              <h1>Health follow-through that starts with a conversation.</h1>
              <p>Share what is going on, and Nura keeps the context organised for you.</p>
            </div>
            <WelcomeArt />
            <div className="mobile-welcome-actions">
              <button className="primary-cta onboarding-primary" onClick={() => setStep(2)}>Get started</button>
              <Link href="/login" className="welcome-login">I already have an account</Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <header className="onboarding-header">
            <button className="onboarding-back" aria-label="Go back" onClick={() => setStep(step - 1)}><ArrowLeft /></button>
            <span className="onboarding-step-count" aria-label={`Step ${step - 1} of 5`}>{step - 1} of 5</span>
            <span className="onboarding-header-spacer" aria-hidden="true" />
          </header>
          <div className="onboarding-progress"><span style={{ width: `${((step - 1) / 5) * 100}%` }} /></div>

          <div className="onboarding-desktop-layout">
            <DesktopCopy step={step} />
            <section className="onboarding-card">
              {step === 2 && (
                <>
                  <span className="auth-kicker">HOW NURA WORKS</span>
                  <h1>How Nura works</h1>
                  <p className="onboarding-intro">You do not need to organise everything yourself. Start naturally and Nura keeps the important parts together.</p>
                  <div className="how-it-works-list">
                    {howItWorks.map(([Icon, title, copy]) => (
                      <article key={title}><span><Icon /></span><div><h3>{title}</h3><p>{copy}</p></div></article>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <span className="auth-kicker">WHAT BRINGS YOU HERE</span>
                  <h1>What would you like help with?</h1>
                  <p className="onboarding-intro">Select all that apply.</p>
                  <div className="interest-grid mobile-interest-list">
                    {interests.map(([label, Icon]) => (
                      <button key={label} onClick={() => toggle(label)} className={selected.includes(label) ? "selected" : ""}>
                        <span className="interest-icon"><Icon /></span><span>{label}</span><span className="selection-circle">{selected.includes(label) && <Check />}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <span className="auth-kicker">FOLLOW-UP CHANNEL</span>
                  <h1>Where should Nura follow up with you?</h1>
                  <p className="onboarding-intro">You can change this anytime.</p>
                  <div className="channel-options mobile-channel-options">
                    {[
                      ["In the app", "Get notifications here.", BellRing],
                      ["WhatsApp", "Nura will message you on WhatsApp.", MessageCircle],
                      ["Both", "App notifications + WhatsApp.", MessageCircle],
                    ].map(([title, copy, Icon]) => (
                      <button key={title as string} onClick={() => setChannel(title as string)} className={channel === title ? "selected" : ""}>
                        <span className="channel-icon"><Icon /></span><span><b>{title as string}</b><small>{copy as string}</small></span><span className="selection-circle">{channel === title && <Check />}</span>
                      </button>
                    ))}
                  </div>
                  <div className="control-note">We’ll never message you without a reason. You’re in control.</div>
                </>
              )}

              {step === 5 && (
                <>
                  <span className="auth-kicker">CHECK-IN METHOD</span>
                  <h1>How should Nura check in on you?</h1>
                  <p className="onboarding-intro">Optional — you can add this later from Me if you&apos;d rather skip it now.</p>
                  <div className="channel-options mobile-channel-options">
                    {[
                      ["WhatsApp", "Text-based check-ins on WhatsApp.", MessageCircle],
                      ["Phone call", "A short voice check-in call.", BellRing],
                    ].map(([title, copy, Icon]) => (
                      <button key={title as string} onClick={() => setCheckinMethod(title as string)} className={checkinMethod === title ? "selected" : ""}>
                        <span className="channel-icon"><Icon /></span><span><b>{title as string}</b><small>{copy as string}</small></span><span className="selection-circle">{checkinMethod === title && <Check />}</span>
                      </button>
                    ))}
                  </div>
                  <label className="onboarding-phone-field">
                    <span>Phone number (optional)</span>
                    <input
                      type="tel"
                      placeholder="+44 7000 000000"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                    <small>Only used for check-in calls you ask for. Never shared, and you can remove it anytime from Me.</small>
                  </label>
                  <div className="control-note">Your number and messages are private to your account and only used to run the check-ins you choose. We never sell or share your data.</div>
                </>
              )}

              {step === 6 && (
                <div className="final-intake-screen">
                  <h1>Tell Nura what’s going on</h1>
                  <p className="onboarding-intro">Start with anything. Nura will take care of the rest.</p>
                  <div className="prompt-suggestions final-intake-prompts">
                    <button type="button" onClick={() => setIntake("I saw my GP today...")}>&quot;I saw my GP today...&quot;</button>
                    <button type="button" onClick={() => setIntake("I've been feeling overwhelmed at work...")}>&quot;I&apos;ve been feeling overwhelmed at work...&quot;</button>
                    <button type="button" onClick={() => setIntake("I started a new medication...")}>&quot;I started a new medication...&quot;</button>
                    <button type="button" onClick={() => setIntake("I want help keeping track of my sleep...")}>&quot;I want help keeping track of my sleep...&quot;</button>
                  </div>
                  {submitError && <p className="auth-error">{submitError}</p>}
                  <div className="final-intake-composer">
                    <input
                      placeholder="Type a message..."
                      aria-label="Message Nura"
                      value={intake}
                      onChange={(e) => setIntake(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleFinish()}
                    />
                    <button
                      aria-label={listening ? "Listening" : "Use microphone"}
                      title={listening ? "Listening..." : "Use microphone"}
                      type="button"
                      className={listening ? "listening" : ""}
                      onClick={handleVoiceInput}
                    >
                      <Mic />
                    </button>
                    <button
                      className="final-send-button"
                      aria-label="Send message"
                      type="button"
                      onClick={handleFinish}
                      disabled={!intake.trim() || submitting || skipping}
                    >
                      {submitting ? <Loader2 className="spin" /> : <SendHorizontal />}
                    </button>
                  </div>
                  <button className="skip-intake-button" type="button" onClick={handleSkip} disabled={submitting || skipping}>
                    {skipping ? "Skipping..." : "Skip for now"}
                  </button>
                </div>
              )}

              {step < 6 && (
                <footer className="onboarding-footer">
                  <button
                    className="primary-cta onboarding-primary"
                    onClick={() => setStep(step + 1)}
                  >
                    Continue <ArrowRight />
                  </button>
                </footer>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
