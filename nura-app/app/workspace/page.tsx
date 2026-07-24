import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  HeartPulse,
  MessageSquareText,
  Phone,
  ShieldCheck,
} from "lucide-react";

const activity = [
  ["GP note", "Daily walking and four-week review imported as clinician-provided context."],
  ["User goal", "Stabilise sleep and reduce the pressure around difficult work shifts."],
  ["Next check-in", "Tomorrow, 19:30 by WhatsApp-style message."],
] as const;

export default function WorkspacePage() {
  return (
    <main className="nura-workspace">
      <aside className="nura-plan-sidebar">
        <Link href="/" className="nura-brand">
          <span className="nura-mark"><HeartPulse /></span>
          <strong>Nura</strong>
        </Link>
        <p className="nura-kicker">ACTIVE PLANS</p>
        <button className="plan-nav active">
          <b>Stabilise My Week</b>
          <span>Stress, sleep, walking, review</span>
        </button>
        <button className="plan-nav">
          <b>Headache Follow-Up</b>
          <span>Monitoring paused</span>
        </button>
        <div className="sidebar-note">
          <ShieldCheck />
          <p>Clinician instructions, user goals, and AI suggestions stay clearly separated.</p>
        </div>
      </aside>

      <section className="nura-chat-panel">
        <header className="workspace-header">
          <div>
            <p className="nura-kicker">LIVING PLAN</p>
            <h1>Stabilise My Week</h1>
          </div>
          <Link href="/plans" className="header-link">View all plans</Link>
        </header>

        <div className="nura-chat-scroll">
          <div className="nura-user-message">
            <span className="nura-attachment"><FileText /><span><b>demo-gp-note.pdf</b><small>GP note uploaded</small></span></span>
            <p>I’m overwhelmed, badly rested, and my GP said I should try daily walking before a review.</p>
          </div>
          <div className="nura-ai-message">
            <span className="nura-ai-avatar">N</span>
            <div>
              <p>I can organise this into one Plan so it is easier to follow through.</p>
              <p>I’ll keep the GP note separate from your own goals, then check in gently around sleep, stress, walking, and the review date.</p>
              <div className="nura-inline-note"><ShieldCheck /> Confirm imported instructions before reminders go live</div>
            </div>
          </div>
          <div className="nura-ai-message">
            <span className="nura-ai-avatar">N</span>
            <div>
              <p>Proposed next step: a short check-in tomorrow evening asking how sleep was, whether you walked, and what made the day harder or easier.</p>
              <div className="nura-quick-actions">
                <button><CheckCircle2 /> Confirm plan</button>
                <button><Bell /> Change check-in</button>
                <button><Phone /> Voice check-in</button>
              </div>
            </div>
          </div>
        </div>

        <div className="nura-workspace-composer">
          <button aria-label="Attach context"><FileText /></button>
          <input aria-label="Reply to Nura" placeholder="Add an update to this Plan..." />
          <button className="send" aria-label="Send"><MessageSquareText /></button>
        </div>
      </section>

      <aside className="nura-plan-canvas">
        <header>
          <div>
            <p className="nura-kicker">CURRENT STATUS</p>
            <h2>Follow-through ready</h2>
          </div>
          <CalendarDays />
        </header>
        <section className="plan-card plan-status">
          <span>Next check-in</span>
          <strong>Tomorrow 19:30</strong>
          <small>Message check-in with sleep, stress, and walking prompts</small>
        </section>
        <section className="plan-card">
          <h3>Plan context</h3>
          <ul className="context-list">
            {activity.map(([title, copy]) => (
              <li key={title}><CheckCircle2 /><span><b>{title}</b><small>{copy}</small></span></li>
            ))}
          </ul>
        </section>
        <section className="plan-card">
          <h3>Appointment summary draft</h3>
          <p>Reported poor sleep and work stress. GP note recommends daily walking and review in four weeks. User wants manageable check-ins rather than a heavy routine.</p>
        </section>
        <footer>Nura is a health organisation companion. Urgent symptoms and crisis language should route to appropriate professional support.</footer>
      </aside>
    </main>
  );
}
