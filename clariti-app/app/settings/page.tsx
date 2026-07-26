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
  X,
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
  followUps: number;
};

type SettingsRowData = {
  Icon: typeof Bell;
  title: string;
  copy: string;
  meta: string;
  action: () => void;
};

type FollowUpRow = {
  id: string;
  action: string;
  document_title: string;
  phone_number?: string | null;
  scheduled_for: string;
  call_status?: string | null;
};

type SettingsPanel = "voice" | "followups" | "preferences" | "account" | "privacy" | "safety" | "about" | null;

function SettingsRow({ row }: { row: SettingsRowData }) {
  const { Icon, title, copy, meta } = row;

  return (
    <button className="settings-row" type="button" onClick={row.action}>
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
  const [counts, setCounts] = useState<CountsState>({ documents: 0, conversations: 0, followUps: 0 });
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [panel, setPanel] = useState<SettingsPanel>(null);

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const [authResponse, documentsResponse, sessionsResponse, followUpsResponse] = await Promise.all([
          fetch("/api/auth/status"),
          fetch("/api/documents"),
          fetch("/api/sessions"),
          fetch("/api/follow-ups"),
        ]);

        const authPayload = await authResponse.json();
        const documentsPayload = documentsResponse.ok ? await documentsResponse.json() : null;
        const sessionsPayload = sessionsResponse.ok ? await sessionsResponse.json() : null;
        const followUpsPayload = followUpsResponse.ok ? await followUpsResponse.json() : null;
        const savedFollowUps = followUpsPayload?.ok ? followUpsPayload.followUps ?? [] : [];

        if (!alive) return;

        setAccount({
          configured: Boolean(authPayload?.configured),
          authenticated: Boolean(authPayload?.authenticated),
          user: authPayload?.user ?? null,
        });
        setCounts({
          documents: documentsPayload?.ok ? documentsPayload.documents.length : 0,
          conversations: sessionsPayload?.ok ? sessionsPayload.sessions.length : 0,
          followUps: savedFollowUps.length,
        });
        setFollowUps(savedFollowUps);
      } catch {
        if (!alive) return;
        setAccount({ configured: false, authenticated: false, user: null });
        setCounts({ documents: 0, conversations: 0, followUps: 0 });
        setFollowUps([]);
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
    { Icon: Mic2, title: "Voice explanation", copy: "Clariti call context for document follow-ups", meta: "Ready", action: () => setPanel("voice") },
    { Icon: Bell, title: "Follow-up reminders", copy: "Phone follow-ups scheduled from document actions", meta: loading ? "..." : String(counts.followUps), action: () => router.push("/follow-ups") },
    { Icon: SlidersHorizontal, title: "Analysis preferences", copy: "Plain language, source-grounded explanations", meta: "Default", action: () => setPanel("preferences") },
  ];

  const claritiRows: SettingsRowData[] = [
    { Icon: BrainCircuit, title: "Saved analyses", copy: "Conversations created from your documents", meta: loading ? "..." : String(counts.conversations), action: () => router.push("/history") },
    { Icon: FileText, title: "Documents", copy: "Health documents attached to Clariti", meta: loading ? "..." : String(counts.documents), action: () => router.push("/documents") },
    { Icon: UserRound, title: "Account", copy: account.configured ? "Supabase authentication connected" : "Supabase not configured", meta: account.authenticated ? "Signed in" : "Signed out", action: () => setPanel("account") },
  ];

  const trustRows: SettingsRowData[] = [
    { Icon: LockKeyhole, title: "Privacy & data", copy: "Your documents are scoped to your account", meta: "", action: () => setPanel("privacy") },
    { Icon: ShieldCheck, title: "Safety boundaries", copy: "Clariti explains documents; it does not diagnose", meta: "", action: () => setPanel("safety") },
    { Icon: CircleHelp, title: "About Clariti", copy: "Product information and support", meta: "", action: () => setPanel("about") },
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

        {panel ? (
          <SettingsModal panel={panel} account={account} counts={counts} followUps={followUps} onClose={() => setPanel(null)} />
        ) : null}
      </main>
    </ClaritiShell>
  );
}

function SettingsModal({
  account,
  counts,
  followUps,
  onClose,
  panel,
}: {
  account: AccountState;
  counts: CountsState;
  followUps: FollowUpRow[];
  onClose: () => void;
  panel: Exclude<SettingsPanel, null>;
}) {
  const content = getPanelContent(panel, account, counts);

  return (
    <div className="settings-modal-backdrop" role="dialog" aria-modal="true" aria-label={content.title}>
      <section className="settings-modal-card">
        <button className="settings-modal-close" type="button" aria-label="Close settings panel" onClick={onClose}><X /></button>
        <p className="clariti-kicker">{content.kicker}</p>
        <h2>{content.title}</h2>
        <p>{content.copy}</p>

        {panel === "followups" ? (
          <div className="settings-followup-list">
            {followUps.length > 0 ? followUps.map((followUp) => (
              <article key={followUp.id}>
                <strong>{followUp.action}</strong>
                <span>{followUp.document_title}</span>
                <small>
                  {new Date(followUp.scheduled_for).toLocaleString()}
                  {followUp.phone_number ? ` · ${followUp.phone_number}` : ""}
                  {followUp.call_status ? ` · ${followUp.call_status}` : ""}
                </small>
              </article>
            )) : (
              <article>
                <strong>No follow-ups yet</strong>
                <span>Use “Set phone follow-up” inside a document analysis to save one here.</span>
              </article>
            )}
          </div>
        ) : (
          <ul className="settings-modal-points">
            {content.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function getPanelContent(panel: Exclude<SettingsPanel, null>, account: AccountState, counts: CountsState) {
  const email = account.user?.email ?? "No signed-in email found";

  const panels = {
    voice: {
      kicker: "VOICE",
      title: "Voice explanation",
      copy: "Clariti uses the saved analysis as call context when you ask for a phone conversation.",
      points: ["ElevenLabs voice calls are available from a workspace.", "Clariti sends the report summary and safety boundaries as context.", "Calls are for explanation and next-step planning, not diagnosis."],
    },
    followups: {
      kicker: "REMINDERS",
      title: "Follow-up reminders",
      copy: `${counts.followUps} saved phone follow-up${counts.followUps === 1 ? "" : "s"} on this account.`,
      points: [],
    },
    preferences: {
      kicker: "ANALYSIS",
      title: "Analysis preferences",
      copy: "Current defaults keep responses concise, plain-English and grounded in the uploaded document.",
      points: ["Plain language explanations.", "Source anchors included when available.", "No diagnosis, prescribing, or final payment decisions."],
    },
    account: {
      kicker: "ACCOUNT",
      title: "Account",
      copy: email,
      points: [account.authenticated ? "Signed in and saving to Supabase." : "Signed out.", `${counts.conversations} saved analyses.`, `${counts.documents} saved documents.`],
    },
    privacy: {
      kicker: "PRIVACY",
      title: "Privacy & data",
      copy: "Your documents and analyses are scoped to your signed-in Supabase account.",
      points: ["History and documents are loaded from your account only.", "Uploaded document text is used to generate grounded analysis.", "Sign out returns you to the home screen."],
    },
    safety: {
      kicker: "SAFETY",
      title: "Safety boundaries",
      copy: "Clariti explains report wording and billing documents. It does not replace a clinician, insurer, or emergency care.",
      points: ["No diagnosis or treatment instructions.", "No final coverage or payment determinations.", "Urgent symptoms should go to emergency or clinical care."],
    },
    about: {
      kicker: "ABOUT",
      title: "About Clariti",
      copy: "Clariti helps people understand one health document at a time and continue into chat, calls, and follow-ups.",
      points: ["Supports radiology reports, medical bills, and insurance EOBs.", "Uses AI for grounded analysis and optional human explainer video.", "Built for the healthcare hackathon demo flow."],
    },
  };

  return panels[panel];
}
