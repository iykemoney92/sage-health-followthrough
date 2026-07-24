import Link from "next/link";
import { CalendarDays, Check, ChevronRight, Clock3, FileUp, HeartPulse, MessageCircle, Plus, Stethoscope, SunMedium } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const threads = [
  { title: "Work Stress", tag: "Wellbeing", meta: "Nura will check in tonight", tone: "wellbeing" },
  { title: "Headaches", tag: "Health", meta: "GP review in 18 days", tone: "health" },
  { title: "New Medication", tag: "Medication", meta: "Next check-in tomorrow", tone: "medication" },
  { title: "Sleep", tag: "Wellbeing", meta: "Last update: Poor night", tone: "sleep" },
];

export default function TodayPage() {
  return (
    <NuraShell>
      <div className="dashboard-page">
        <div className="dashboard-heading"><div><p className="eyebrow">TODAY</p><h1>Good evening, Ike <SunMedium/></h1><p>Here&apos;s what needs your attention today.</p></div></div>

        <div className="today-layout">
          <section className="today-primary">
            <article className="hero-checkin">
              <div className="card-label"><span>Next check-in</span><CalendarDays/></div>
              <h2>Work Stress</h2>
              <div className="checkin-meta"><span>Today, 7:30 PM</span><span>•</span><span>WhatsApp voice</span></div>
              <p>We&apos;ll check in about how today&apos;s shift went and how you&apos;re feeling now.</p>
              <div className="button-row"><button className="primary-button">Start check-in</button><button className="secondary-button">Reschedule</button></div>
            </article>

            <div className="section-title-row"><h2>Active threads</h2><Link href="/plans">View all <ChevronRight/></Link></div>
            <div className="thread-grid">
              {threads.map((thread) => (
                <Link href={thread.title === "Headaches" ? "/plans/headaches" : "/plans"} className="thread-card" key={thread.title}>
                  <div className={`thread-icon ${thread.tone}`}><HeartPulse/></div>
                  <div className="thread-card-top"><h3>{thread.title}</h3><span className={`tag ${thread.tone}`}>{thread.tag}</span></div>
                  <p>{thread.meta}</p><small>Last updated recently</small>
                </Link>
              ))}
            </div>

            <div className="section-title-row"><h2>This week</h2><Link href="/calendar">View calendar <ChevronRight/></Link></div>
            <div className="week-strip">
              {[['Mon','21','1'],['Tue','22','2'],['Wed','23','1'],['Thu','24','2'],['Fri','25','1'],['Sat','26','0'],['Sun','27','1']].map(([day,date,count]) => <div key={day}><small>{day}</small><b>{date}</b><span className={count==='0'?'empty':''}>{count==='0'?'—':count}</span></div>)}
            </div>
          </section>

          <aside className="today-rail">
            <section className="rail-card"><h3>Quick actions</h3>
              <Link href="/workspace"><span className="quick-icon"><MessageCircle/></span><span><b>Tell Nura something</b><small>Talk about something on your mind</small></span><ChevronRight/></Link>
              <button><span className="quick-icon blue"><Plus/></span><span><b>Log a note</b><small>Add a thought, symptom or update</small></span><ChevronRight/></button>
              <button><span className="quick-icon amber"><FileUp/></span><span><b>Upload document</b><small>Lab results, letters or notes</small></span><ChevronRight/></button>
            </section>
            <section className="rail-card"><h3>Upcoming</h3>
              <div className="upcoming-item"><Stethoscope/><span><b>GP appointment</b><small>14 Aug, 10:00 AM</small></span></div>
              <div className="upcoming-item"><Clock3/><span><b>Blood test</b><small>16 Aug, 8:30 AM</small></span></div>
              <div className="upcoming-item"><Check/><span><b>Weekly summary</b><small>Ready Sunday evening</small></span></div>
            </section>
          </aside>
        </div>
      </div>
    </NuraShell>
  );
}