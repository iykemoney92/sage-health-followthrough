"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BellRing, Check, FolderHeart, HeartPulse, MessageCircle, Mic, Moon, Pill, Upload } from "lucide-react";
import { useState } from "react";
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

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([
    "Stress or emotional wellbeing",
    "Medication follow-through",
    "GP or clinic follow-up",
  ]);
  const [channel, setChannel] = useState("WhatsApp");

  const toggle = (item: string) => {
    setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  };

  return (
    <main className={`onboarding mobile-onboarding step-${step}`}>
      {step === 1 ? (
        <section className="mobile-welcome-screen">
          <div className="mobile-welcome-brand"><NuraLogo size={54} /></div>
          <div className="mobile-welcome-copy">
            <h1>Your AI health<br/>companion</h1>
            <p>Nura listens, organises what matters, and follows up so you can focus on living.</p>
          </div>
          <div className="mobile-welcome-art" aria-hidden="true">
            <span className="welcome-orbit orbit-one" />
            <span className="welcome-orbit orbit-two" />
            <div className="welcome-person">
              <span className="welcome-head" />
              <span className="welcome-hair" />
              <span className="welcome-body" />
              <span className="welcome-phone" />
            </div>
            <span className="welcome-leaf leaf-one" />
            <span className="welcome-leaf leaf-two" />
          </div>
          <div className="mobile-welcome-actions">
            <button className="primary-cta onboarding-primary" onClick={() => setStep(2)}>Get started</button>
            <Link href="/login" className="welcome-login">I already have an account</Link>
          </div>
        </section>
      ) : (
        <>
          <header className="onboarding-header">
            <button className="onboarding-back" aria-label="Go back" onClick={() => setStep(step - 1)}><ArrowLeft /></button>
            <NuraLogo compact size={28} />
            <small>{step - 1} of 4</small>
          </header>
          <div className="onboarding-progress"><span style={{ width: `${((step - 1) / 4) * 100}%` }} /></div>

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
                <span className="auth-kicker">FIRST INTAKE</span>
                <h1>Tell Nura what’s going on</h1>
                <p className="onboarding-intro">Start with anything. Nura will take care of the rest.</p>
                <div className="prompt-suggestions">
                  <button>I saw my GP today…</button>
                  <button>I’ve been feeling overwhelmed at work…</button>
                  <button>I started a new medication…</button>
                  <button>I want help keeping track of my sleep…</button>
                </div>
                <div className="first-intake mobile-first-intake">
                  <textarea placeholder="Type a message…" />
                  <div className="intake-tools"><button aria-label="Upload"><Upload /></button><button aria-label="Voice note"><Mic /></button></div>
                </div>
              </>
            )}

            <footer className="onboarding-footer">
              {step < 5 ? (
                <button className="primary-cta onboarding-primary" onClick={() => setStep(step + 1)}>Continue <ArrowRight /></button>
              ) : (
                <Link href="/today" className="primary-cta onboarding-primary">Continue <ArrowRight /></Link>
              )}
            </footer>
          </section>
        </>
      )}
    </main>
  );
}
