"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, MessageCircle, Search, Settings, Sparkles } from "lucide-react";

const nav = [
  ["Today", "/", Home],
  ["Threads", "/plans", MessageCircle],
  ["Calendar", "/calendar", CalendarDays],
  ["Me", "/me", Settings],
] as const;

export function NuraShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="nura-app-shell">
      <aside className="nura-sidebar">
        <Link href="/" className="nura-brand">
          <span className="nura-leaf">✦</span>
          <span><strong>Nura</strong><small>Your AI health companion</small></span>
        </Link>
        <nav className="nura-side-nav" aria-label="Primary navigation">
          {nav.map(([label, href, Icon]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "active" : ""}><Icon/><span>{label}</span></Link>;
          })}
        </nav>
        <Link href="/workspace" className="message-nura"><MessageCircle/> Message Nura</Link>
        <div className="sidebar-promise"><Sparkles/><p>Nura is here for the moments between appointments.</p></div>
      </aside>
      <section className="nura-main">
        <header className="nura-desktop-topbar">
          <label className="nura-search"><Search/><input aria-label="Search Nura" placeholder="Search Nura" /></label>
          <div className="nura-top-actions"><button aria-label="Notifications"><Bell/></button><span className="profile-dot">IA</span><b>Ike Okonkwo</b></div>
        </header>
        {children}
      </section>
      <nav className="nura-mobile-nav" aria-label="Mobile navigation">
        {nav.map(([label, href, Icon]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? "active" : ""}><Icon/><span>{label}</span></Link>;
        })}
      </nav>
    </main>
  );
}