"use client";

import Link from "next/link";
import { Bell, CalendarDays, Leaf, MessageCircle, Mic, Plus, UserRound } from "lucide-react";
import { PrototypeAction } from "@/components/prototype-action";

const nav = [
  ["Today", "/today"],
  ["My Plans", "/my-plans"],
  ["Calendar", "/calendar"],
  ["Me", "/me"],
] as const;

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <main className="app-page">
      <header className="app-header">
        <div className="app-width app-header-inner">
          <Link href="/today" className="app-brand"><span className="app-mark"><Leaf /></span><strong>Sage</strong></Link>
          <nav className="app-nav">
            {nav.map(([label, href]) => <Link key={href} className={active === label ? "active" : ""} href={href}>{label}</Link>)}
          </nav>
          <div className="app-actions">
            <PrototypeAction className="app-icon-btn" label={<Bell />} title="Notifications" description="Your recent Sage reminders and plan updates.">
              <div className="prototype-list"><div><b>Sleep reset</b><span>Check-in today at 7:00 PM</span></div><div><b>Plan progress</b><span>You’re 43% through Stabilise My Week.</span></div></div>
            </PrototypeAction>
            <Link href="/me" className="app-avatar" aria-label="Open profile"><UserRound /></Link>
          </div>
        </div>
      </header>
      {children}
      <nav className="app-mobile-nav">
        {nav.map(([label, href]) => <Link key={href} className={active === label ? "active" : ""} href={href}>{label}</Link>)}
      </nav>
    </main>
  );
}

export function PrimaryActions() {
  return <div className="app-action-row">
    <PrototypeAction className="app-btn primary" label={<><MessageCircle /> Message Sage</>} title="Message Sage" description="A WhatsApp-style conversation surface for your active plan.">
      <div className="prototype-chat"><div className="prototype-bubble">Hi Ike 👋 What would you like help with today?</div><div className="prototype-compose">Type a message…</div></div>
    </PrototypeAction>
    <PrototypeAction className="app-btn outline" label={<><Mic /> Voice check-in</>} title="Voice check-in" description="Preview the voice check-in experience before the ElevenLabs integration is connected.">
      <div className="prototype-voice"><div className="prototype-wave">••••••••••</div><b>Ready when you are</b><span>Tap the microphone during the live demo to speak with Sage.</span></div>
    </PrototypeAction>
  </div>;
}

export function NewPlanButton() {
  return <Link href="/onboarding/help" className="app-btn primary small"><Plus /> Start a new plan</Link>;
}

export function ChannelPill({ voice = false }: { voice?: boolean }) {
  return <span className="channel-pill">{voice ? <Mic /> : <MessageCircle />}{voice ? "WhatsApp voice" : "WhatsApp"}</span>;
}

export function DateIcon() { return <CalendarDays />; }
