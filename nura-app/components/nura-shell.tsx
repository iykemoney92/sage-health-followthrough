"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronDown, ClipboardList, Home, MessageCircle, Search, Settings, UserRound } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { CalendarNavBadge } from "@/components/calendar-nav-badge";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { TimezoneSync } from "@/components/timezone-sync";

const nav = [
  ["Today", "/today", Home],
  ["Care plans", "/plans", ClipboardList],
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
  const router = useRouter();
  const userInitials = initialsFor(userName);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [profileOpen]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/plans?q=${encodeURIComponent(q)}` : "/plans");
  }

  return (
    <main className="app-shell product-shell">
      <TimezoneSync />
      <PullToRefresh />
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
          <form className="global-search" onSubmit={onSearch} role="search">
            <Search aria-hidden />
            <input
              placeholder="Search Care plans"
              aria-label="Search Care plans"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </form>
          <div className="app-user" ref={menuRef}>
            <Link href="/notifications" aria-label="Notifications" className="icon-link"><Bell/></Link>
            <button
              className="profile-trigger"
              type="button"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="avatar" style={userAvatarUrl ? { backgroundImage: `url(${userAvatarUrl})` } : undefined}>{userAvatarUrl ? "" : userInitials}</span>
              <b>{userName}</b>
              <ChevronDown/>
            </button>
            {profileOpen && (
              <div className="profile-menu" role="menu">
                <Link href="/me/profile" className="profile-menu-item" role="menuitem" onClick={() => setProfileOpen(false)}><UserRound/> Profile</Link>
                <SignOutButton className="profile-menu-item danger" />
              </div>
            )}
          </div>
        </header>
        {children}
      </section>

      <nav className="mobile-nav" aria-label="Primary">
        <Link href="/today" className={pathname.startsWith("/today") ? "active" : ""}>
          <span className="nav-icon-wrap"><Home/></span>
          <span>Today</span>
        </Link>
        <Link href="/plans" className={pathname.startsWith("/plans") ? "active" : ""}>
          <span className="nav-icon-wrap"><ClipboardList/></span>
          <span>Plans</span>
        </Link>
        <Link href="/workspace" className={`mobile-nav-chat${pathname.startsWith("/workspace") ? " active" : ""}`} aria-label="Message Nura">
          <span className="nav-icon-wrap"><MessageCircle/></span>
          <span>Chat</span>
        </Link>
        <Link href="/calendar" className={pathname.startsWith("/calendar") ? "active" : ""}>
          <span className="nav-icon-wrap"><CalendarDays/><CalendarNavBadge /></span>
          <span>Calendar</span>
        </Link>
        <Link href="/me" className={pathname.startsWith("/me") ? "active" : ""}>
          <span className="nav-icon-wrap"><Settings/></span>
          <span>Me</span>
        </Link>
      </nav>
    </main>
  );
}
