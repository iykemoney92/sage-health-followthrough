import { ChevronRight, Database, Download, HeartPulse, Link2, MessageCircle, Settings, ShieldCheck, UserRound } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const items = [
  ["Preferences", "Reminders, check-ins and quiet hours", Settings],
  ["Health information", "Medications, conditions and contacts", HeartPulse],
  ["Memory & privacy", "What Nura remembers and why", Database],
  ["Data & export", "Export or delete your data", Download],
  ["Support & safety", "Get help and crisis resources", ShieldCheck],
  ["Connected apps", "Manage integrations", Link2],
] as const;

export default function MePage() {
  return <NuraShell><div className="dashboard-page"><div className="page-title-row"><div><p className="eyebrow">ME</p><h1>Me</h1><p>Your preferences, privacy and the health context you choose to keep with Nura.</p></div></div>
  <div className="settings-grid">
    <section className="profile-card"><div className="profile-photo"><UserRound/></div><div><h2>Ike Okonkwo</h2><p>ike@example.com</p><small>+44 7711 123456</small></div><button className="secondary-button">Edit profile</button></section>
    <section className="channel-card"><span className="quick-icon"><MessageCircle/></span><div><small>Preferred follow-up channel</small><h3>WhatsApp</h3><p>We&apos;ll use this for check-ins and important updates.</p></div><button className="secondary-button">Change</button></section>
    <section className="settings-list">{items.map(([title,copy,Icon])=><button key={title}><span className="settings-icon"><Icon/></span><span><b>{title}</b><small>{copy}</small></span><ChevronRight/></button>)}</section>
  </div></div></NuraShell>;
}