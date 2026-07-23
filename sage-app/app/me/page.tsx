"use client";

import { useState } from "react";
import {
  Bell,
  FileText,
  LockKeyhole,
  MessageCircle,
  Mic,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

const tabs = [
  { id: "connection", label: "Connection", icon: MessageCircle },
  { id: "voice", label: "Voice & reminders", icon: Mic },
  { id: "memory", label: "Memory & context", icon: UserRound },
  { id: "uploads", label: "Uploads", icon: FileText },
  { id: "privacy", label: "Privacy & data", icon: LockKeyhole },
  { id: "support", label: "Support & safety", icon: ShieldCheck },
] as const;

type TabId = (typeof tabs)[number]["id"];

function SettingsRows({ active }: { active: TabId }) {
  if (active === "connection") {
    return <>
      <h2>Connection</h2>
      <p className="muted">Manage how Sage reaches you for check-ins.</p>
      <div className="setting-row"><div><b>WhatsApp</b><span>+44 7123 456789 · Connected</span></div><button className="app-btn outline">Manage</button></div>
      <div className="setting-row"><div><b>Connection status</b><span>Sage can currently send scheduled WhatsApp check-ins.</span></div><span className="channel-pill">Connected</span></div>
      <div className="setting-row"><div><b>Reconnect number</b><span>Change the WhatsApp number connected to this account.</span></div><button className="app-btn outline">Reconnect</button></div>
    </>;
  }

  if (active === "voice") {
    return <>
      <h2>Voice & reminders</h2>
      <p className="muted">Choose how Sage speaks with you and when reminders arrive.</p>
      <div className="setting-row"><div><b>Voice check-ins</b><span>Allow Sage to use voice for scheduled check-ins.</span></div><div className="toggle" /></div>
      <div className="setting-row"><div><b>Preferred voice</b><span>Warm, calm and conversational.</span></div><button className="app-btn outline">Change voice</button></div>
      <div className="setting-row"><div><b>Reminder timing</b><span>Send a gentle reminder before a scheduled check-in.</span></div><button className="app-btn outline">30 minutes</button></div>
      <div className="setting-row"><div><b>Quiet hours</b><span>Sage will avoid non-urgent check-ins during this period.</span></div><button className="app-btn outline">10 PM – 7 AM</button></div>
    </>;
  }

  if (active === "memory") {
    return <>
      <h2>Memory & context</h2>
      <p className="muted">Review and control what Sage remembers across your plans.</p>
      <div className="setting-row"><div><b>Personal context</b><span>Sleep difficulty, work stress and preferred check-in style.</span></div><button className="app-btn outline">Review</button></div>
      <div className="setting-row"><div><b>Health guidance</b><span>GP advice and plan-related notes Sage currently references.</span></div><button className="app-btn outline">View context</button></div>
      <div className="setting-row"><div><b>Memory controls</b><span>Choose what Sage can keep, forget or stop using.</span></div><button className="app-btn outline">Manage memory</button></div>
    </>;
  }

  if (active === "uploads") {
    return <>
      <h2>Uploads</h2>
      <p className="muted">Manage files you have shared to give Sage more context.</p>
      <div className="setting-row"><div><b>GP note.pdf</b><span>PDF · Added during onboarding</span></div><button className="app-btn outline">View</button></div>
      <div className="setting-row"><div><b>therapy-goals.jpg</b><span>Image · Added to wellbeing context</span></div><button className="app-btn outline">View</button></div>
      <div className="setting-row"><div><b>Add more context</b><span>Upload another document, screenshot or note.</span></div><button className="app-btn primary">Upload file</button></div>
    </>;
  }

  if (active === "privacy") {
    return <>
      <h2>Privacy & data</h2>
      <p className="muted">Control your information, exports and stored Sage data.</p>
      <div className="setting-row"><div><b>Download your data</b><span>Export your plans, context and check-in history.</span></div><button className="app-btn outline">Export data</button></div>
      <div className="setting-row"><div><b>Delete saved context</b><span>Remove information Sage currently remembers.</span></div><button className="app-btn outline">Review data</button></div>
      <div className="setting-row"><div><b>Delete account</b><span>Permanently remove your account and stored information.</span></div><button className="app-btn outline">Delete account</button></div>
    </>;
  }

  return <>
    <h2>Support & safety</h2>
    <p className="muted">Get help with Sage and find urgent-support resources.</p>
    <div className="setting-row"><div><b>Help centre</b><span>Find answers about plans, check-ins and account settings.</span></div><button className="app-btn outline">Open help</button></div>
    <div className="setting-row"><div><b>Contact support</b><span>Get help with your Sage account or experience.</span></div><button className="app-btn outline">Contact us</button></div>
    <div className="setting-row"><div><b>Urgent support</b><span>Sage is not emergency care. Access crisis and urgent-support resources here.</span></div><button className="app-btn outline">View support</button></div>
  </>;
}

export default function MePage() {
  const [active, setActive] = useState<TabId>("connection");

  return (
    <AppShell active="Me">
      <section className="app-width app-main">
        <div className="page-eyebrow">PROFILE & PREFERENCES</div>
        <h1 className="page-title">Me</h1>
        <p className="page-subtitle">Your connection, preferences, privacy and support controls in one place.</p>

        <div className="settings-grid" style={{ marginTop: 30 }}>
          <aside className="panel settings-menu" role="tablist" aria-label="Profile settings">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active === id}
                className={active === id ? "active" : ""}
                onClick={() => setActive(id)}
              >
                <Icon /> {label}
              </button>
            ))}
          </aside>

          <section className="panel settings-content" role="tabpanel">
            <SettingsRows active={active} />
          </section>
        </div>
      </section>
    </AppShell>
  );
}
