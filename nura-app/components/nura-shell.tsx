"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, LockKeyhole, MessageCircle, Search, Settings } from "lucide-react";
import { NuraLogo, NuraMark } from "@/components/nura-logo";

const nav = [
  ["Today", "/today", Home],
  ["Threads", "/plans", MessageCircle],
  ["Calendar", "/calendar", CalendarDays],
  ["Me", "/me", Settings],
] as const;

export function NuraShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell product-shell">
      <aside className="companion-rail">
        <NuraLogo href="/today" />
        <div className="companion-copy">
          <h2>Nura is here for the moments between appointments.</h2>
          <p>Nura listens, organises what matters, and follows up so you can focus on living.</p>
        </div>
        <div className="companion-points">
          <div><MessageCircle/><span><b>Conversational</b><small>Talk or type naturally</small></span></div>
          <div><span className="point-icon">▱</span><span><b>Organising</b><small>Nura keeps things together in Threads</small></span></div>
          <div><Bell/><span><b>Proactive</b><small>Check-ins and reminders at the right time</small></span></div>
          <div><LockKeyhole/><span><b>Private & secure</b><small>Your data stays yours</small></span></div>
        </div>
        <div className="companion-art" aria-hidden="true"><NuraMark size={118} className="rail-watermark"/><div className="companion-person"><span className="head"/><span className="body"/><span className="laptop"/></div></div>
      </aside>

      <aside className="app-sidebar product-sidebar">
        <NuraLogo href="/today" compact />
        <nav>
          {nav.map(([label, href, Icon]) => {
            const active = pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "active" : ""}><Icon/><span>{label}</span></Link>;
          })}
        </nav>
        <Link href="/workspace" className="message-nura"><MessageCircle/> Message Nura</Link>
        <div className="sidebar-illustration" aria-hidden="true"><NuraMark size={54}/><div/></div>
      </aside>

      <section className="app-main product-main">
        <header className="app-topbar product-topbar">
          <label className="global-search"><Search/><input placeholder="Search Nura" aria-label="Search Nura" /></label>
          <div className="app-user"><Link href="/notifications" aria-label="Notifications" className="icon-link"><Bell/></Link><span className="avatar">IA</span><b>Ike Okonkwo</b></div>
        </header>
        {children}
      </section>

      <nav className="mobile-nav">
        {nav.map(([label, href, Icon]) => <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}><Icon/><span>{label}</span></Link>)}
      </nav>
    </main>
  );
}