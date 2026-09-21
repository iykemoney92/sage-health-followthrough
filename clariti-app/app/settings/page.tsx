"use client";

import {
  Bell,
  BrainCircuit,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileLock,
  FileText,
  KeyRound,
  LockKeyhole,
  LogOut,
  ScrollText,
  Video,
  X,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ClaritiShell } from "@/components/clariti-shell";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { ExportDataButton } from "@/components/export-data-button";
import {
  ANALYTICS_CONSENT_EVENT,
  getAnalyticsConsent,
  isNativeShell,
  setAnalyticsConsent,
} from "@/lib/analytics-consent";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import "./settings.css";

type AccountState = {
  configured: boolean;
  authenticated: boolean;
  aiConsent: boolean;
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

type AnalyticsControlState = "unknown" | "native" | "granted" | "denied";

function subscribeAnalyticsConsent(onChange: () => void) {
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onChange);
  return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChange);
}

function readAnalyticsConsentState(): AnalyticsControlState {
  // The shells hard-deny analytics so the ATT requirement never applies (see
  // lib/analytics-consent.ts), which would make this a switch that cannot move.
  if (isNativeShell()) return "native";
  return getAnalyticsConsent() === "granted" ? "granted" : "denied";
}

/**
 * Turning analytics back off, which the cookie banner cannot do: it only appears
 * while no choice is stored, so the first tap was final.
 */
function AnalyticsConsentControl() {
  // Neither the stored choice nor the Capacitor bridge is readable during the
  // server render, so this takes UpgradeCta's approach: the server snapshot
  // renders nothing and the client's first pass renders the true state instead
  // of flashing the wrong label. Unlike there the subscription is real — the
  // cookie banner writes the same key and fires this event.
  const state = useSyncExternalStore<AnalyticsControlState>(
    subscribeAnalyticsConsent,
    readAnalyticsConsentState,
    () => "unknown",
  );

  if (state === "unknown" || state === "native") return null;

  const granted = state === "granted";

  return (
    <div>
      <button
        type="button"
        className="settings-signout"
        onClick={() => setAnalyticsConsent(granted ? "denied" : "granted")}
      >
        <ChartColumn /> {granted ? "Turn off usage analytics" : "Turn on usage analytics"}
      </button>
      <p className="settings-footnote" style={{ textAlign: "left", marginTop: 8 }} role="status">
        {granted
          ? "Analytics are on. Google Analytics sees which screens you open — never your documents or anything written in them."
          : "Analytics are off. Only the cookies that keep you signed in are loaded."}
      </p>
    </div>
  );
}

/**
 * Withdrawing the consent recorded at /ai-consent. Until this existed the only
 * way to take it back was deleting the whole account.
 */
function AiConsentControl({ granted, onWithdrawn }: { granted: boolean; onWithdrawn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  async function revoke() {
    if (busy) return;
    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/ai-consent", { method: "DELETE" });
      const payload = await response.json().catch(() => null);

      // A 204 carries no body, so only an explicit `ok: false` counts as a refusal.
      if (!response.ok || payload?.ok === false) {
        setStatus({
          tone: "error",
          // The 401 body is a machine token here as it is everywhere else in the app.
          message: response.status === 401
            ? "Your session has expired. Sign in again, then withdraw your consent."
            : "Clariti could not withdraw your consent. Please try again.",
        });
        return;
      }

      setStatus({
        tone: "ok",
        message: "Withdrawn. Clariti will not send any of your documents to the AI model, and no new analysis will run, until you agree again. It will ask the next time you open Clariti.",
      });
      onWithdrawn();
    } catch {
      setStatus({ tone: "error", message: "Clariti could not reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  // proxy.ts leaves /settings reachable without consent so a decliner can still export
  // and delete, which makes this the first screen they see — it must not tell them they
  // agreed to something they refused.
  if (!granted) {
    return (
      <p className="settings-footnote" style={{ textAlign: "left" }} role="status">
        {status?.message
          ?? "You have not agreed to let Clariti send your documents to the AI model, so no analysis will run. Clariti will ask before it sends anything."}
      </p>
    );
  }

  return (
    <div>
      <button type="button" className="settings-signout" onClick={() => void revoke()} disabled={busy}>
        <ShieldOff /> {busy ? "Withdrawing consent..." : "Withdraw AI consent"}
      </button>
      <p
        className={status?.tone === "error" ? "auth-error" : "settings-footnote"}
        style={{ textAlign: "left", marginTop: 8 }}
        role="status"
      >
        {status?.message
          ?? "You agreed to let Clariti send your documents to the AI model that writes your explanations. Withdrawing stops that: no further analysis of your documents until you agree again. Everything already saved stays where it is."}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState>({ configured: false, authenticated: false, aiConsent: false, user: null });
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
          aiConsent: Boolean(authPayload?.aiConsent),
          user: authPayload?.user ?? null,
        });
        setCounts({
          documents: documentsPayload?.ok ? documentsPayload.documents.length : 0,
          conversations: sessionsPayload?.ok ? sessionsPayload.sessions.length : 0,
          followUps: followUpsPayload?.ok ? (followUpsPayload.followUps ?? []).length : 0,
        });
        setBilling(billingPayload?.ok ? { hasPlus: Boolean(billingPayload.hasPlus), status: billingPayload.status } : null);
      } catch (caught) {
        if (!alive) return;
        // A failed fetch says nothing about the account, so the old branch here — which
        // reset to signed-out and zero counts — turned a dropped connection into the
        // false claim "Signed out." and no saved documents. Keeping the last known state
        // is the honest reading; the reason goes to the console because this page has
        // nowhere to show it.
        console.error("[clariti] settings failed to load:", caught);
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

  // /auth/reset-password doubles as the change-password screen: reached this way it asks for
  // the current password first, and only a visitor arriving on a recovery link skips that. It
  // turns a signed-out visitor away, which is why the row only appears once we know there is
  // an account behind it.
  if (account.authenticated) {
    claritiRows.push({
      Icon: KeyRound,
      title: "Change password",
      copy: "Set a new password for email sign-in",
      meta: "",
      action: () => router.push("/auth/reset-password"),
    });
  }

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
          {/* Both consents have to be withdrawable from here. The cookie banner only shows
              while no analytics choice is stored and the gate only shows while AI consent is
              missing, so neither could be taken back once given — and GDPR Art. 7(3) requires
              withdrawal to be as easy as granting. Clariti sells in the EU. */}
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <AnalyticsConsentControl />
            {account.authenticated ? (
              <AiConsentControl
                granted={account.aiConsent}
                onWithdrawn={() => setAccount((current) => ({ ...current, aiConsent: false }))}
              />
            ) : null}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Your data</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {/* /connections has no home in the four-item mobile nav, and a page
                nothing links to may as well not exist. Here because it is about
                where a person's records come from, which is the same question
                the rest of this section answers. */}
            <Link className="settings-row-link" href="/connections">
              Where your records can come from
            </Link>
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
        "The finished video is kept private to your account.",
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
