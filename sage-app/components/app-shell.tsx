import Link from "next/link";
import { Bell, CalendarDays, Leaf, MessageCircle, Mic, Plus, UserRound } from "lucide-react";

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
          <div className="app-actions"><button><Bell /></button><span className="app-avatar"><UserRound /></span></div>
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
  return <div className="app-action-row"><button className="app-btn primary"><MessageCircle /> Message Sage</button><button className="app-btn outline"><Mic /> Voice check-in</button></div>;
}

export function NewPlanButton() {
  return <Link href="/onboarding/help" className="app-btn primary small"><Plus /> Start a new plan</Link>;
}

export function ChannelPill({ voice = false }: { voice?: boolean }) {
  return <span className="channel-pill">{voice ? <Mic /> : <MessageCircle />}{voice ? "WhatsApp voice" : "WhatsApp"}</span>;
}

export function DateIcon() { return <CalendarDays />; }
