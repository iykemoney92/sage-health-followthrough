import {
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Mic2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";
import "./settings.css";

const preferenceRows = [
  [Clock3, "Check-ins & reminders", "Morning check-ins · WhatsApp", "Morning"],
  [Mic2, "Voice & conversations", "Warm voice · English", "English"],
  [Bell, "Notifications", "Important updates and reminders", "On"],
] as const;

const claritiRows = [
  [BrainCircuit, "What Clariti remembers", "Review and manage saved context", "7 saved"],
  [FileText, "Your context & uploads", "Documents and information you’ve shared", "3 items"],
  [SlidersHorizontal, "Personalisation", "Goals, routines and preferences", ""],
] as const;

const trustRows = [
  [LockKeyhole, "Privacy & data", "Manage, export or delete your data", ""],
  [ShieldCheck, "Safety & support", "Understand Clariti’s limits and get help", ""],
  [CircleHelp, "About Clariti", "Product information and legal", ""],
] as const;

function SettingsRow({
  Icon,
  title,
  copy,
  meta,
  className = "",
}: {
  Icon: typeof Bell;
  title: string;
  copy: string;
  meta: string;
  className?: string;
}) {
  return (
    <button className={`settings-row ${className}`} type="button">
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
  return (
    <ClaritiShell>
      <main className="clariti-settings-page">
        <header className="settings-heading">
          <p className="clariti-kicker">YOUR CLARITI</p>
          <h1>Me</h1>
          <p>Manage how Clariti supports you, what it remembers, and how your data is handled.</p>
        </header>

        <section className="settings-profile-card" aria-label="Profile">
          <div className="settings-profile-avatar">IK</div>
          <div className="settings-profile-copy">
            <h2>Ike</h2>
            <p>ike@example.com</p>
          </div>
          <button className="settings-edit-link" type="button">Edit</button>
        </section>

        <section className="settings-connection-card" aria-label="WhatsApp connection">
          <div className="settings-connection-top">
            <div className="settings-connection-icon"><MessageCircle /></div>
            <div className="settings-connection-copy">
              <h3>WhatsApp</h3>
              <p>Check-ins, reminders and conversations</p>
            </div>
            <span className="settings-status"><CheckCircle2 /> Connected</span>
          </div>
          <button className="settings-manage" type="button">
            <span>+44 •••• 8241 · Manage connection</span>
            <ChevronRight />
          </button>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Preferences</h2>
          <div className="settings-list">
            {preferenceRows.map(([Icon, title, copy, meta]) => (
              <SettingsRow key={title} Icon={Icon} title={title} copy={copy} meta={meta} />
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Your Clariti</h2>
          <div className="settings-list settings-memory">
            {claritiRows.map(([Icon, title, copy, meta]) => (
              <SettingsRow key={title} Icon={Icon} title={title} copy={copy} meta={meta} />
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Privacy & support</h2>
          <div className="settings-list settings-privacy">
            {trustRows.map(([Icon, title, copy, meta]) => (
              <SettingsRow key={title} Icon={Icon} title={title} copy={copy} meta={meta} />
            ))}
          </div>
        </section>

        <div className="settings-danger">
          <button className="settings-signout" type="button"><LogOut /> Sign out</button>
          <p className="settings-footnote">Clariti keeps your health information private and under your control.</p>
        </div>
      </main>
    </ClaritiShell>
  );
}
