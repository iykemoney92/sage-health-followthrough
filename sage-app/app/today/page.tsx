import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, Moon, Sparkles } from "lucide-react";
import { AppShell, PrimaryActions } from "@/components/app-shell";

export default function TodayPage() {
  const days = [["Thu","23"],["Fri","24"],["Sat","25"],["Sun","26"],["Mon","27"],["Tue","28"],["Wed","29"]];
  return (
    <AppShell active="Today">
      <section className="app-width app-main">
        <div className="page-eyebrow">Thursday, 23 July</div>
        <h1 className="page-title">Good morning, Ike.</h1>
        <p className="page-subtitle">Here’s what needs your attention today. Keep it light — one step at a time.</p>

        <div className="today-grid">
          <section className="panel next-card">
            <div className="panel-label">NEXT CHECK-IN</div>
            <h2>Sleep reset</h2>
            <p className="muted">7:00 PM · WhatsApp check-in</p>
            <PrimaryActions />
          </section>

          <section className="panel plan-highlight">
            <div className="plan-highlight-top"><div><div className="panel-label">ACTIVE PLAN</div><h2>Stabilise My Week</h2></div><strong>43%</strong></div>
            <div className="progress-line"><i /></div>
            <div className="plan-meta-row"><CalendarDays /> Day 3 of 7</div>
            <Link className="text-link" href="/my-plans/stabilise-my-week">View plan <ChevronRight size={16}/></Link>
          </section>
        </div>

        <section className="panel week-panel">
          <div className="week-head"><div><h3>This week</h3><p className="muted">Your upcoming Sage check-ins and gentle actions.</p></div><Link className="text-link" href="/calendar">Open calendar</Link></div>
          <div className="week-strip">{days.map(([day,date],i)=><div className={`day-card ${i===0?"active":""}`} key={day}><span>{day}</span><b>{date}</b></div>)}</div>
        </section>

        <div className="today-bottom">
          <section className="panel tracking">
            <div className="section-head"><div><div className="panel-label">WHAT SAGE IS TRACKING</div><h2>Your focus this week</h2></div></div>
            <div className="tracking-list">
              <div className="track"><b>Sleep</b><span>Build a steadier wind-down routine</span></div>
              <div className="track"><b>Medication routine</b><span>Keep your daily check-in consistent</span></div>
              <div className="track"><b>Movement</b><span>One gentle 10-minute walk</span></div>
            </div>
          </section>
          <section className="panel quick-sage">
            <div className="panel-label">A GENTLE NUDGE</div>
            <h3>You don’t have to do everything today.</h3>
            <p className="muted">Your next step is just the sleep check-in at 7:00 PM. Sage will meet you there.</p>
            <div className="plan-meta-row"><CheckCircle2 /> 3 of 7 plan days complete</div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}