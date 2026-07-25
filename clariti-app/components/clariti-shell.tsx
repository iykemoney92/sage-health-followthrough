"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, History, Home, Settings } from "lucide-react";
import { MouseEvent, useEffect, useState } from "react";
import { ClaritiAuthModal } from "@/components/clariti-auth-modal";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  ["Home", "/", Home],
  ["History", "/history", History],
  ["Documents", "/documents", FileText],
  ["Settings", "/settings", Settings],
] as const;

export function ClaritiShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isWorkspace = pathname.startsWith("/workspace");
  const [authenticated, setAuthenticated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive || !payload?.ok) return;
        setAuthenticated(Boolean(payload.authenticated));
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const handleProtectedClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href === "/" || authenticated) return;
    event.preventDefault();
    setPendingHref(href);
    setAuthOpen(true);
  };

  const handleSignInClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (authenticated) return;
    event.preventDefault();
    setPendingHref(pathname);
    setAuthOpen(true);
  };

  const continueAfterAuth = () => {
    setAuthenticated(true);
    setAuthOpen(false);
    router.push(pendingHref ?? "/");
  };

  return (
    <main className="clariti-app-shell" data-shell-version="mobile-nav-fixed-v2">
      <header className="clariti-topbar">
        <Link href="/" className="clariti-brand">
          <span className="clariti-mark">C</span>
          <strong>Clariti</strong>
        </Link>
        <nav className="clariti-desktop-nav" aria-label="Primary navigation">
          {nav.map(([label, href, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""} onClick={(event) => handleProtectedClick(event, href)}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="clariti-account-actions">
          {authenticated ? (
            <>
              <button className="clariti-avatar" aria-label="Profile">IA</button>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="clariti-login-link" onClick={handleSignInClick}>Sign in</Link>
          )}
        </div>
      </header>

      {children}

      {!isWorkspace && (
        <nav className="clariti-shell-mobile-nav" aria-label="Clariti mobile navigation">
          {nav.map(([label, href, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""} onClick={(event) => handleProtectedClick(event, href)}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}

      {authOpen && (
        <ClaritiAuthModal
          modeDefault="signin"
          kicker="SIGN IN TO CONTINUE"
          title="Sign in without losing your ask"
          copy="Create or sign in to Clariti. We will keep you on this screen and open the page you selected after auth."
          onClose={() => setAuthOpen(false)}
          onAuthenticated={continueAfterAuth}
        />
      )}

      <style jsx global>{`
        .clariti-desktop-nav {
          justify-self: center;
          align-self: stretch;
          display: flex;
          align-items: stretch;
          justify-content: center;
          gap: 4px;
        }

        .clariti-desktop-nav a {
          min-width: 74px;
          padding: 8px 10px !important;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-align: center;
          line-height: 1.1;
        }

        .clariti-desktop-nav a svg {
          width: 20px;
          height: 20px;
          flex: none;
          stroke-width: 1.9;
        }

        .clariti-desktop-nav a span {
          display: block;
          font-size: 11px;
        }

        .clariti-desktop-nav a.active {
          color: #2f6e66;
          background: #edf5f2;
        }

        .clariti-account-actions {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .clariti-login-link {
          border: 1px solid #dfe7e4;
          border-radius: 10px;
          color: #426f67;
          font-size: 11px;
          font-weight: 800;
          padding: 8px 10px;
          text-decoration: none;
        }

        .clariti-signout {
          width: 38px;
          height: 38px;
          border: 1px solid #dfe7e4;
          border-radius: 12px;
          background: #fff;
          color: #68756f;
          display: grid;
          place-items: center;
        }

        .clariti-signout svg {
          width: 16px;
          height: 16px;
        }

        .clariti-shell-mobile-nav { display: none !important; }

        @media (max-width: 760px) {
          .clariti-desktop-nav { display: none !important; }
          .clariti-shell-mobile-nav {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 95;
            display: grid !important; grid-template-columns: repeat(4,minmax(0,1fr));
            min-height: 68px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
            background: rgba(255,255,255,.98); backdrop-filter: blur(18px);
            border-top: 1px solid #e4ebe7; box-shadow: 0 -8px 24px rgba(31,52,45,.05);
          }
          .clariti-shell-mobile-nav a {
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            gap:4px; min-width:0; border-radius:12px; text-decoration:none; color:#7a8884;
            font-size:9px; font-weight:700; padding:6px 4px;
          }
          .clariti-shell-mobile-nav a svg { width:19px; height:19px; stroke-width:1.9; }
          .clariti-shell-mobile-nav a.active { color:#2f6e66; background:#edf5f2; }
        }
      `}</style>
    </main>
  );
}
