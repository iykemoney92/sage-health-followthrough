"use client";

import {
  Bell,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  FileText,
  LockKeyhole,
  LogOut,
  Mic2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClaritiShell } from "@/components/clariti-shell";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import "./settings.css";

type AccountState = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; email?: string; name?: string } | null;
};

type CountsState = {
  documents: number;
  conversations: number;
};

type SettingsRowData = {
  Icon: typeof Bell;
  title: string;
  copy: string;
  meta: string;
};

function SettingsRow({ row }: { row: SettingsRowData }) {
  const { Icon, title, copy, meta } = row;

  return (
    <button className="settings-row" type="button">
      <span className="settings-row-icon"><Icon /></span>
      <span className="settings-row-copy">
        <strong>{title}</strong>
        <span>{copy}</span>
      </span>
      <span className="settings-row-meta">
        {meta ? <span>{meta}</span> : null}
        <ChevronRight />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState>({ configured: false, authenticated: false, user: null });
  const [counts, setCounts] = useState<CountsState>({ documents: 0, conversations: 0 });
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const [authResponse, documentsResponse, sessionsResponse] = await Promise.all([
          fetch("/api/auth/status"),
          fetch("/api/documents"),
          fetch("/api/sessions"),
        ]);

        const authPayload = await authResponse.json();
        const documentsPayload = documentsResponse.ok ? await documentsResponse.json() : null;
        const sessionsPayload = sessionsResponse.ok ? await sessionsResponse.json() : null;

        if (!alive) return;

        setAccount({
          configured: Boolean(authPayload?.configured),
          authenticated: Boolean(authPayload?.authenticated),
          user: authPayload?.user ?? null,
        });
        setCounts({
          documents: documentsPayload?.ok ? documentsPayload.documents.length : 0,
          conversations: sessionsPayload?.ok ? sessionsPayload.sessions.length : 0,
        });
      } catch {
        if (!alive) return;
        setAccount({ configured: false, authenticated: false, user: null });
        setCounts({ documents: 0, conversations: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      alive = false;
    };
  }, []);

  const displayName = account.user?.name || account.user?.email?.split("@")[0] || "Clariti user";
  const displayEmail = account.user?.email || "Signed in account";
  const initials = useMemo(() => {
    const source = displayName || displayEmail;
    return source
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C";
  }, [displayEmail, displayName]);

  const preferenceRows: SettingsRowData[] = [
    { Icon: Mic2, title: "Voice explanation", copy: "Clariti call context for document follow-ups", meta: "Ready" },
    { Icon: Bell, title: "Follow-up reminders", copy: "Phone follow-ups scheduled from document actions", meta: "Account" },
    { Icon: SlidersHorizontal, title: "Analysis preferences", copy: "Plain language, source-grounded explanations", meta: "Default" },
  ];

  const claritiRows: SettingsRowData[] = [
    { Icon: BrainCircuit, title: "Saved analyses", copy: "Conversations created from your documents", meta: loading ? "..." : String(counts.conversations) },
    { Icon: FileText, title: "Documents", copy: "Health documents attached to Clariti", meta: loading ? "..." : String(counts.documents) },
    { Icon: UserRound, title: "Account", copy: account.configured ? "Supabase authentication connected" : "Supabase not configured", meta: account.authenticated ? "Signed in" : "Signed out" },
  ];

  const trustRows: SettingsRowData[] = [
    { Icon: LockKeyhole, title: "Privacy & data", copy: "Your documents are scoped to your account", meta: "" },
    { Icon: ShieldCheck, title: "Safety boundaries", copy: "Clariti explains documents; it does not diagnose", meta: "" },
    { Icon: CircleHelp, title: "About Clariti", copy: "Product information and support", meta: "" },
  ];

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <ClaritiShell>
      <main className="clariti-settings-page">
        <header className="settings-heading">
          <p className="clariti-kicker">YOUR CLARITI</p>
          <h1>Me</h1>
          <p>Manage your Clariti account, saved document context, follow-up preferences and privacy controls.</p>
        </header>

        <section className="settings-profile-card" aria-label="Profile">
          <div className="settings-profile-avatar">{loading ? "C" : initials}</div>
          <div className="settings-profile-copy">
            <h2>{loading ? "Loading account..." : displayName}</h2>
            <p>{loading ? "Checking Supabase session" : displayEmail}</p>
          </div>
          <span className="settings-edit-link">{account.authenticated ? "Active" : "Signed out"}</span>
        </section>

        <section className="settings-connection-card" aria-label="Clariti account status">
          <div className="settings-connection-top">
            <div className="settings-connection-icon"><ShieldCheck /></div>
            <div className="settings-connection-copy">
              <h3>Clariti account</h3>
              <p>{account.authenticated ? "Your analyses and documents save to Supabase." : "Sign in to save analyses and documents."}</p>
            </div>
            <span className={`settings-status ${account.authenticated ? "connected" : ""}`}>
              {account.authenticated ? "Connected" : "Not connected"}
            </span>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Preferences</h2>
          <div className="settings-list">
            {preferenceRows.map((row) => <SettingsRow key={row.title} row={row} />)}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Your Clariti</h2>
          <div className="settings-list settings-memory">
            {claritiRows.map((row) => <SettingsRow key={row.title} row={row} />)}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Privacy & support</h2>
          <div className="settings-list settings-privacy">
            {trustRows.map((row) => <SettingsRow key={row.title} row={row} />)}
          </div>
        </section>

        <div className="settings-danger">
          <button className="settings-signout" type="button" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut /> {signingOut ? "Signing out..." : "Sign out"}
          </button>
          <p className="settings-footnote">Clariti keeps your health information private and under your control.</p>
        </div>
      </main>
    </ClaritiShell>
  );
}
