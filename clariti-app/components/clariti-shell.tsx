"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, History, Home, Settings } from "lucide-react";

const nav = [
  ["Home", "/", Home],
  ["Documents", "/documents", FileText],
  ["History", "/history", History],
  ["Settings", "/settings", Settings],
] as const;

export function ClaritiShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith("/workspace");

  return (
    <main className="clariti-app-shell">
      <header className="clariti-topbar">
        <Link href="/" className="clariti-brand">
          <span className="clariti-mark">C</span>
          <strong>Clariti</strong>
        </Link>
        <nav>
          {nav.map(([label, href, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        <button className="clariti-avatar" aria-label="Profile">IA</button>
      </header>
      {children}
      {!isWorkspace && (
        <nav className="clariti-shell-mobile-nav" aria-label="Clariti mobile navigation">
          {nav.map(([label, href, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
