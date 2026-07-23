import { CalendarDays, CheckCircle2, HeartPulse, MessageCircle, Moon, ShieldCheck } from "lucide-react";
import { OnboardingShell } from "../components";

function WelcomeIllustration() {
  return (
    <div className="ob-welcome-illustration" aria-hidden="true">
      <div className="ob-illustration-halo" />
      <svg className="ob-person" viewBox="0 0 320 260">
        <path d="M105 209c10-48 38-72 70-72 37 0 63 28 73 72" fill="#f6f8f2" stroke="#6f927e" strokeWidth="2" />
        <path d="M130 94c0-31 19-53 46-53 29 0 48 22 48 53 0 29-20 50-47 50-27 0-47-21-47-50Z" fill="#fbfaf6" stroke="#6f927e" strokeWidth="2" />
        <path d="M132 84c8-39 51-54 80-28 8 7 13 17 15 30-11-12-24-19-40-22-12 13-31 22-55 20Z" fill="#315f4b" opacity=".95" />
        <path d="M157 113c7 6 14 8 21 8 8 0 14-2 20-8" fill="none" stroke="#6f927e" strokeWidth="2" strokeLinecap="round" />
        <path d="M181 165c-17 6-29 18-36 37m36-37c16 5 29 16 38 35" fill="none" stroke="#6f927e" strokeWidth="2" strokeLinecap="round" />
        <path d="M161 171c12 16 25 22 39 20" fill="none" stroke="#6f927e" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="ob-float-icon ob-float-chat"><MessageCircle size={20}/></span>
      <span className="ob-float-icon ob-float-heart"><HeartPulse size={19}/></span>
      <span className="ob-float-icon ob-float-calendar"><CalendarDays size={19}/></span>
      <span className="ob-sprig ob-sprig-left" />
      <span className="ob-sprig ob-sprig-right" />
    </div>
  );
}

function MomentsAside() {
  return (
    <div className="ob-moments">
      <h3>Sage is for moments like:</h3>
      <div className="ob-moment-row"><i><HeartPulse size={19}/></i><div><b>Feeling overwhelmed</b><span>When life feels like too much to hold alone.</span></div></div>
      <div className="ob-moment-row"><i><Moon size={19}/></i><div><b>Sleep &amp; energy</b><span>Build better sleep and more energy, little by little.</span></div></div>
      <div className="ob-moment-row"><i><ShieldCheck size={19}/></i><div><b>Following health advice</b><span>Turn guidance into simple steps you can actually keep up with.</span></div></div>
      <div className="ob-moment-row"><i><MessageCircle size={19}/></i><div><b>When you need a nudge</b><span>Get calm check-ins through WhatsApp at the right time.</span></div></div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <OnboardingShell active={1} nextHref="/onboarding/help" nextLabel="Continue" aside={<MomentsAside />}>
      <div className="ob-welcome-pd">
        <div className="ob-kicker">STEP 1 OF 6</div>
        <h1 className="ob-title">Welcome to Sage <span className="ob-title-leaf">🌿</span></h1>
        <p className="ob-subtitle">Sage helps you turn what you’re dealing with into a simple plan—and checks in to help you keep going.</p>
        <WelcomeIllustration />
        <div className="ob-welcome-benefits">
          <div><CheckCircle2 size={18}/><span>Personalized plans based on what matters to you</span></div>
          <div><CheckCircle2 size={18}/><span>Proactive WhatsApp text and voice check-ins</span></div>
          <div><CheckCircle2 size={18}/><span>Your progress, in one simple place</span></div>
          <div><CheckCircle2 size={18}/><span>You’re in control—always</span></div>
        </div>
      </div>
    </OnboardingShell>
  );
}
