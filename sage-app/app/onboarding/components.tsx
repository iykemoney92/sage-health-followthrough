import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

export const steps = [
  ["Welcome", "/onboarding/welcome"],
  ["What you need\nhelp with", "/onboarding/help"],
  ["Tell Sage", "/onboarding/tell-sage"],
  ["Connect\nWhatsApp", "/onboarding/connect-whatsapp"],
  ["Plan created", "/onboarding/plan"],
  ["You’re all set", "/onboarding/complete"],
] as const;

export function SageMark() {
  return (
    <svg className="ob-logo-mark" viewBox="0 0 36 42" aria-hidden="true">
      <path d="M18.7 37.8c.2-9.2 4.1-18.3 11.8-27.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.8 21.8C8.1 22.2 3.4 16.6 3 7.1c8.6.2 14.5 4.7 14.8 14.7Z" fill="currentColor" />
      <path d="M21.7 15.1C20.9 7 25.7 2.7 33.6 2c-.1 7.8-4 12.6-11.9 13.1Z" fill="currentColor" />
      <path d="M13.7 35.7c-5.6-2.3-8-6.8-7.2-13.4 6.1 1.4 9.7 5.9 7.2 13.4Z" fill="currentColor" opacity=".86" />
    </svg>
  );
}

export function OnboardingHeader({ active }: { active: number }) {
  return (
    <>
      <header className="ob-header">
        <Link className="ob-brand" href="/"><SageMark /><strong>Sage</strong></Link>
        <Link className="ob-login" href="/auth/sign-in">Log in</Link>
      </header>
      <div className="ob-stepper" aria-label="Onboarding progress">
        {steps.map(([label, href], index) => {
          const n = index + 1;
          const complete = n < active;
          const current = n === active;
          return (
            <div className="ob-step-wrap" key={href}>
              {index > 0 && <span className={complete || current ? "ob-line done" : "ob-line"} />}
              <Link className="ob-step" href={href} aria-current={current ? "step" : undefined}>
                <span className={`ob-step-circle ${complete ? "complete" : ""} ${current ? "current" : ""}`}>
                  {complete ? <Check size={14} /> : n}
                </span>
                <span className="ob-step-label">{label.split("\n").map((part, i) => <span key={i}>{part}</span>)}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function OnboardingShell({
  active,
  children,
  aside,
  backHref,
  nextHref,
  nextLabel = "Continue",
  hideNext = false,
}: {
  active: number;
  children: ReactNode;
  aside?: ReactNode;
  backHref?: string;
  nextHref?: string;
  nextLabel?: string;
  hideNext?: boolean;
}) {
  return (
    <main className="ob-page">
      <div className="ob-shell">
        <OnboardingHeader active={active} />
        <div className={`ob-content ${aside ? "with-aside" : "single"}`}>
          <section className="ob-card">{children}</section>
          {aside && <aside className="ob-aside">{aside}</aside>}
        </div>
        <footer className="ob-footer">
          <div>{backHref && <Link className="ob-back" href={backHref}><ArrowLeft size={17}/> Back</Link>}</div>
          <div className="ob-dots">{steps.map((_, i) => <span key={i} className={i + 1 === active ? "active" : ""} />)}</div>
          <div>{!hideNext && nextHref && <Link className="ob-continue" href={nextHref}>{nextLabel}<ArrowRight size={17}/></Link>}</div>
        </footer>
      </div>
    </main>
  );
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return <div className="ob-privacy"><ShieldCheck size={18}/><span>{children}</span></div>;
}

export function GentleAside() {
  return (
    <div className="ob-gentle-aside">
      <div className="ob-calm-art">
        <span className="ob-calm-head" />
        <span className="ob-calm-body" />
        <span className="ob-calm-hand" />
        <span className="ob-leaf one" />
        <span className="ob-leaf two" />
        <span className="ob-chat-dot"><MessageCircle size={22}/></span>
      </div>
      <h3>It doesn’t have to be<br/>perfect.</h3>
      <p>Share whatever feels important right now. Sage will help make sense of it with you.</p>
      <div className="ob-aside-note"><Heart size={17}/> You can change or add more context later.</div>
    </div>
  );
}
