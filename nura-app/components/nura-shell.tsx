"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, HeartPulse, Home, ListChecks, Settings } from "lucide-react";

const nav = [
  ["Today", "/", Home],
  ["My Plans", "/plans", ListChecks],
  ["Calendar", "/calendar", CalendarDays],
  ["Me", "/me", Settings],
] as const;

export function NuraShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="nura-app-shell">
      <header className="nura-topbar">
        <Link href="/" className="nura-brand">
          <span className="nura-mark"><HeartPulse /></span>
          <strong>Nura</strong>
        </Link>
        <nav className="nura-nav" aria-label="Primary navigation">
          {nav.map(([label, href, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button className="nura-avatar" aria-label="Profile">IA</button>
      </header>
      {children}
    </main>
  );
}
