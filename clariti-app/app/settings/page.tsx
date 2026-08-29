"use client";

import {
  Bell,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileLock,
  FileText,
  LockKeyhole,
  LogOut,
  ScrollText,
  Video,
  X,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClaritiShell } from "@/components/clariti-shell";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { ExportDataButton } from "@/components/export-data-button";
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

type SettingsPanel = "videos" | "preferences" | "account" | "privacy" | "safety" | "about" | null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** settings.css only clamps the email line, so a long display name would widen the card. */
const CLAMP_LINE = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

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
  const [billing, setBilling] = useState<{ hasPlus: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [panel, setPanel] = useState<SettingsPanel>(null);

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const [authResponse, documentsResponse, sessionsResponse, followUpsResponse, billingResponse] = await Promise.all([
          fetch("/api/auth/status"),
          fetch("/api/documents"),
          fetch("/api/sessions"),
          fetch("/api/follow-ups"),
          fetch("/api/billing/access").catch(() => null),
        ]);

        const authPayload = await authResponse.json();
        const documentsPayload = documentsResponse.ok ? await documentsResponse.json() : null;
        const sessionsPayload = sessionsResponse.ok ? await sessionsResponse.json() : null;
        const followUpsPayload = followUpsResponse.ok ? await followUpsResponse.json() : null;
        const billingPayload = billingResponse?.ok ? await billingResponse.json() : null;

        if (!alive) return;

        setAccount({
          configured: Boolean(authPayload?.configured),
          authenticated: Boolean(authPayload?.authenticated),
          user: authPayload?.user ?? null,
        });
        setCounts({
          documents: documentsPayload?.ok ? documentsPayload.documents.length : 0,
          conversations: sessionsPayload?.ok ? sessionsPayload.sessions.length : 0,
          followUps: followUpsPayload?.ok ? (followUpsPayload.followUps ?? []).length : 0,
        });
        setBilling(billingPayload?.ok ? { hasPlus: Boolean(billingPayload.hasPlus), status: billingPayload.status } : null);
      } catch {
        if (!alive) return;
        setAccount({ configured: false, authenticated: false, user: null });
        setCounts({ documents: 0, conversations: 0, followUps: 0 });
        setBilling(null);
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
    { Icon: Bell, title: "Email check-ins", copy: "Clariti emails you later to ask if anything changed", meta: loading ? "..." : String(counts.followUps), action: () => router.push("/follow-ups") },
    { Icon: Video, title: "Explainer videos", copy: "Turn a saved analysis into a narrated walkthrough", meta: "", action: () => setPanel("videos") },
    { Icon: SlidersHorizontal, title: "Analysis preferences", copy: "Plain language, source-grounded explanations", meta: "Default", action: () => setPanel("preferences") },
  ];

  const claritiRows: SettingsRowData[] = [
    { Icon: BrainCircuit, title: "Saved analyses", copy: "Conversations created from your documents", meta: loading ? "..." : String(counts.conversations), action: () => router.push("/history") },
    { Icon: FileText, title: "Documents", copy: "Health documents attached to Clariti", meta: loading ? "..." : String(counts.documents), action: () => router.push("/documents") },
    { Icon: CreditCard, title: "Clariti Plus", copy: "Unlimited analyses, videos, compare, and check-ins", meta: loading ? "..." : billing?.hasPlus ? "Plus" : "Free", action: () => router.push("/billing") },
    { Icon: UserRound, title: "Account", copy: account.configured ? "Email sign-in is connected" : "Sign-in is not configured", meta: account.authenticated ? "Signed in" : "Signed out", action: () => setPanel("account") },
  ];

  const trustRows: SettingsRowData[] = [
    { Icon: LockKeyhole, title: "Privacy & data", copy: "Your documents are scoped to your account", meta: "", action: () => setPanel("privacy") },
    { Icon: ShieldCheck, title: "Safety boundaries", copy: "Clariti explains documents; it does not diagnose", meta: "", action: () => setPanel("safety") },
    { Icon: FileLock, title: "Privacy policy", copy: "What Clariti collects and who else processes it", meta: "", action: () => router.push("/privacy") },
    { Icon: ScrollText, title: "Terms of use", copy: "How Clariti is meant to be used, and how Plus is billed", meta: "", action: () => router.push("/terms") },
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
          <p>Manage your Clariti account, saved document context, check-in preferences and privacy controls.</p>
        </header>

        <section className="settings-profile-card" aria-label="Profile">
          <div className="settings-profile-avatar">{loading ? "C" : initials}</div>
          <div className="settings-profile-copy">
            <h2 style={CLAMP_LINE}>{loading ? "Loading account..." : displayName}</h2>
            <p>{loading ? "Checking your session" : displayEmail}</p>
          </div>
          <span className="settings-edit-link" style={{ flex: "none", whiteSpace: "nowrap" }}>
            {account.authenticated ? "Active" : "Signed out"}
          </span>
        </section>

        <section className="settings-connection-card" aria-label="Clariti account status">
          <div className="settings-connection-top">
            <div className="settings-connection-icon"><ShieldCheck /></div>
            <div className="settings-connection-copy">
              <h3>Clariti account</h3>
              <p>{account.authenticated ? "Your analyses and documents are saved to this account." : "Sign in to save analyses and documents."}</p>
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

        <section className="settings-section">
          <h2 className="settings-section-title">Your data</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <ExportDataButton />
            <DeleteAccountButton />
          </div>
          <p className="settings-footnote" style={{ textAlign: "left" }}>
            Export gives you every row Clariti holds for your account as a JSON file. Delete removes all of it —
            documents, analyses, videos and check-ins — permanently, and cannot be undone.
          </p>
        </section>

        <div className="settings-danger">
          <button className="settings-signout" type="button" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut /> {signingOut ? "Signing out..." : "Sign out"}
          </button>
          <p className="settings-footnote">Clariti keeps your health information private and under your control.</p>
        </div>

        {panel ? (
          <SettingsModal panel={panel} account={account} counts={counts} onClose={() => setPanel(null)} />
        ) : null}
      </main>
    </ClaritiShell>
  );
}

function SettingsModal({
  account,
  counts,
  onClose,
  panel,
}: {
  account: AccountState;
  counts: CountsState;
  onClose: () => void;
  panel: Exclude<SettingsPanel, null>;
}) {
  const content = getPanelContent(panel, account, counts);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // The settings rows are the only route back into the list for keyboard and VoiceOver
    // users, so focus has to land inside the panel and return to the row that opened it.
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="settings-modal-backdrop" onMouseDown={onClose}>
      <section
        ref={cardRef}
        className="settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="settings-modal-close" type="button" aria-label="Close settings panel" onClick={onClose}><X /></button>
        <p className="clariti-kicker">{content.kicker}</p>
        <h2 id="settings-panel-title">{content.title}</h2>
        <p style={{ overflowWrap: "anywhere" }}>{content.copy}</p>

        <ul className="settings-modal-points">
          {content.points.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </section>
    </div>
  );
}

function getPanelContent(panel: Exclude<SettingsPanel, null>, account: AccountState, counts: CountsState) {
  const email = account.user?.email ?? "No signed-in email found";

  const panels = {
    videos: {
      kicker: "VIDEO",
      title: "Explainer videos",
      copy: "Clariti can turn a saved analysis into a short narrated video that walks through what the document says.",
      points: [
        "Built from the analysis Clariti already wrote, not from the original file.",
        "Generated scenes are stitched into one video and kept private to your account.",
        "One video is included on the free plan; Plus removes the limit.",
      ],
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
      points: [account.authenticated ? "Signed in, and saving to this account." : "Signed out.", `${counts.conversations} saved analyses.`, `${counts.documents} saved documents.`],
    },
    privacy: {
      kicker: "PRIVACY",
      title: "Privacy & data",
      copy: "Your documents and analyses are scoped to your signed-in account, and only you can read them.",
      points: [
        "Uploaded files are stored privately and opened through short-lived signed links.",
        "Your documents are used to write your own explanation. They are never used to train AI models.",
        "Export or permanently delete everything from Your data, further down this page.",
      ],
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
      copy: "Clariti turns one confusing health document at a time into plain English, then helps you act on it — questions worth asking, sensible next steps, and a check-in so nothing gets forgotten.",
      points: [
        "Reads medical bills, insurance EOBs, lab results, radiology reports and discharge notes.",
        "Every explanation points back at the wording in your document it came from.",
        "Clariti explains and organises. It does not diagnose, prescribe, or decide coverage.",
        "Questions or feedback: support@useclariti.app",
      ],
    },
  };

  return panels[panel];
}
