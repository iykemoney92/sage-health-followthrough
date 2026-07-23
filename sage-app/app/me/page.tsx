import { Bell, FileText, LockKeyhole, MessageCircle, Mic, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function MePage(){return <AppShell active="Me"><section className="app-width app-main">
 <div className="page-eyebrow">PROFILE & PREFERENCES</div><h1 className="page-title">Me</h1><p className="page-subtitle">Your connection, preferences, privacy and support controls in one place.</p>
 <div className="settings-grid" style={{marginTop:30}}>
  <aside className="panel settings-menu"><a className="active" href="#connection"><MessageCircle/> Connection</a><a href="#voice"><Mic/> Voice & reminders</a><a href="#memory"><UserRound/> Memory & context</a><a href="#uploads"><FileText/> Uploads</a><a href="#privacy"><LockKeyhole/> Privacy & data</a><a href="#support"><ShieldCheck/> Support & safety</a></aside>
  <section className="panel settings-content"><h2>Connection</h2><p className="muted">Manage how Sage reaches you for check-ins.</p>
   <div className="setting-row"><div><b>WhatsApp</b><span>+44 7123 456789 · Connected</span></div><button className="app-btn outline">Manage</button></div>
   <div className="setting-row"><div><b>Voice check-ins</b><span>Allow Sage to use voice for scheduled check-ins.</span></div><div className="toggle"/></div>
   <div className="setting-row"><div><b>Reminder timing</b><span>Send a gentle reminder 30 minutes before a check-in.</span></div><button className="app-btn outline">30 minutes</button></div>
   <div className="setting-row"><div><b>Sage memory</b><span>Review and control the context Sage remembers across your plans.</span></div><button className="app-btn outline">Review memory</button></div>
   <div className="setting-row"><div><b>Uploaded context</b><span>GP note.pdf · therapy-goals.jpg</span></div><button className="app-btn outline">Manage files</button></div>
   <div className="setting-row"><div><b>Privacy & data</b><span>Export your information or delete your Sage account and stored context.</span></div><button className="app-btn outline">Open controls</button></div>
   <div className="setting-row"><div><b>Urgent support</b><span>Sage is not emergency care. Access crisis and urgent-support resources here.</span></div><button className="app-btn outline">View support</button></div>
  </section>
 </div>
 </section></AppShell>}