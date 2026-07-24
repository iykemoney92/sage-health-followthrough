"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, LockKeyhole, MessageCircle, Search, Settings } from "lucide-react";

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
        <Link href="/today" className="companion-brand">
          <span className="companion-leaf">❦</span>
          <span>
            <b>Nura</b>
            <small>Your AI health companion</small>
          </span>
        </Link>

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

        <div className="companion-art" aria-hidden="true">
          <span className="plant plant-one">❧</span>
          <span className="plant plant-two">❦</span>
          <div className="companion-person">
            <span className="head"/>
            <span className="body"/>
            <span className="laptop"/>
          </div>
        </div>
      </aside>

      <aside className="app-sidebar product-sidebar">
        <Link href="/today" className="mini-app-brand"><span>❦</span><b>Nura</b></Link>
        <nav>
          {nav.map(([label, href, Icon]) => {
            const active = pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "active" : ""}><Icon/><span>{label}</span></Link>;
          })}
        </nav>
        <Link href="/workspace" className="message-nura"><MessageCircle/> Message Nura</Link>
        <div className="sidebar-illustration" aria-hidden="true"><span>❦</span><div/></div>
      </aside>

      <section className="app-main product-main">
        <header className="app-topbar product-topbar">
          <label className="global-search"><Search/><input placeholder="Search Nura" aria-label="Search Nura" /></label>
          <div className="app-user"><button aria-label="Notifications"><Bell/></button><span className="avatar">IA</span><b>Ike Okonkwo</b></div>
        </header>
        {children}
      </section>

      <nav className="mobile-nav">
        {nav.map(([label, href, Icon]) => <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}><Icon/><span>{label}</span></Link>)}
      </nav>
    </main>
  );
}