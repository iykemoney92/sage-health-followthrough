"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, ChevronDown, Home, MessageCircle, Search, Settings, UserRound } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { CalendarNavBadge } from "@/components/calendar-nav-badge";

const nav = [
  ["Today", "/today", Home],
  ["Threads", "/plans", MessageCircle],
  ["Calendar", "/calendar", CalendarDays],
  ["Me", "/me", Settings],
] as const;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function NuraShell({
  children,
  userName = "You",
  userAvatarUrl,
}: {
  children: React.ReactNode;
  userName?: string;
  userAvatarUrl?: string;
}) {
  const pathname = usePathname();
  const userInitials = initialsFor(userName);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <main className="app-shell product-shell">
      <aside className="app-sidebar product-sidebar">
        <NuraLogo href="/today" compact />
        <nav>
          {nav.map(([label, href, Icon]) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <span className="nav-icon-wrap"><Icon/>{href === "/calendar" && <CalendarNavBadge />}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <Link href="/workspace" className="message-nura"><MessageCircle/> Message Nura</Link>
        <div className="between-card"><b>Nura is here for the moments between appointments.</b></div>
      </aside>

      <section className="app-main product-main">
        <header className="app-topbar product-topbar">
          <label className="global-search"><Search/><input placeholder="Search Nura" aria-label="Search Nura" /></label>
          <div className="app-user">
            <Link href="/notifications" aria-label="Notifications" className="icon-link"><Bell/></Link>
            <button className="profile-trigger" type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
              <span className="avatar" style={userAvatarUrl ? { backgroundImage: `url(${userAvatarUrl})` } : undefined}>{userAvatarUrl ? "" : userInitials}</span>
              <b>{userName}</b>
              <ChevronDown/>
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <Link href="/me/profile" className="profile-menu-item" onClick={() => setProfileOpen(false)}><UserRound/> Profile</Link>
                <SignOutButton className="profile-menu-item danger" />
              </div>
            )}
          </div>
        </header>
        {children}
      </section>

      <nav className="mobile-nav">
        {nav.map(([label, href, Icon]) => (
          <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}>
            <span className="nav-icon-wrap"><Icon/>{href === "/calendar" && <CalendarNavBadge />}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
