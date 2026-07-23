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
    <main className="clariti-app-shell" data-shell-version="mobile-nav-fixed-v2">
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

      <style jsx global>{`
        .clariti-shell-mobile-nav {
          display: none !important;
        }

        @media (max-width: 760px) {
          .clariti-shell-mobile-nav {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 95;
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            min-height: 68px;
            padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(18px);
            border-top: 1px solid #e4ebe7;
            box-shadow: 0 -8px 24px rgba(31, 52, 45, 0.05);
          }

          .clariti-shell-mobile-nav a {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            min-width: 0;
            border-radius: 12px;
            text-decoration: none;
            color: #7a8884;
            font-size: 9px;
            font-weight: 700;
            padding: 6px 4px;
          }

          .clariti-shell-mobile-nav a svg {
            width: 19px;
            height: 19px;
            stroke-width: 1.9;
          }

          .clariti-shell-mobile-nav a.active {
            color: #2f6e66;
            background: #edf5f2;
          }
        }
      `}</style>
    </main>
  );
}
