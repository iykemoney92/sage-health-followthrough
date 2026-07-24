import Link from "next/link";
import { CalendarDays, ChevronRight, HeartPulse, MessageCircle, Stethoscope, SunMedium } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { NuraActions, RescheduleButton } from "@/components/nura-actions";

const threads = [
  { title: "Work Stress", tag: "Wellbeing", meta: "Last talked about yesterday", next: "Nura will check in tonight", tone: "wellbeing", progress: 50 },
  { title: "Headaches", tag: "Health", meta: "2 updates this week", next: "GP review in 18 days", tone: "health", progress: 50 },
  { title: "New Medication", tag: "Medication", meta: "Started 5 days ago", next: "Next check-in tomorrow", tone: "medication", progress: 71 },
] as const;

export default function TodayPage() {
  return <NuraShell><div className="dashboard-page today-page">
    <header className="dashboard-heading"><span className="auth-kicker">TODAY</span><h1>Good evening, Ike <SunMedium /></h1><p>Here&apos;s what needs your attention today.</p></header>
    <div className="today-layout"><section className="today-main-column">
      <article className="hero-checkin"><div className="card-label"><span>Next check-in</span><CalendarDays /></div><h2>Work Stress</h2><p className="meta">Today, 7:30 PM · WhatsApp voice</p><p className="checkin-copy">We&apos;ll check in about how today&apos;s shift went and how you&apos;re feeling now.</p><div className="button-row"><Link href="/check-in" className="primary-cta">Start check-in</Link><RescheduleButton/></div></article>
      <div className="section-title-row"><h2>Active Threads</h2><Link href="/plans">View all <ChevronRight /></Link></div>
      <div className="thread-grid">{threads.map(thread=><Link href={thread.title === "Headaches" ? "/plans/headaches" : "/plans"} className="thread-card" key={thread.title}><div className="thread-card-heading"><span className={`thread-icon ${thread.tone}`}><HeartPulse /></span><span className={`tag ${thread.tone}`}>{thread.tag}</span></div><h3>{thread.title}</h3><p>{thread.meta}</p><small>{thread.next}</small><div className="thread-progress"><span style={{ width: `${thread.progress}%` }} /></div></Link>)}</div>
      <div className="section-title-row week-title"><h2>This week</h2><Link href="/calendar">View calendar <ChevronRight /></Link></div><div className="week-strip">{[['Mon','21','1'],['Tue','22','2'],['Wed','23','1'],['Thu','24','2'],['Fri','25','1'],['Sat','26','0'],['Sun','27','1']].map(([d,n,c])=><div key={d}><small>{d}</small><b>{n}</b><span className={c === '0' ? 'empty' : ''}>{c === '0' ? '—' : c}</span></div>)}</div>
    </section>
    <aside className="today-rail"><article className="rail-card quick-actions-card"><h3>Quick actions</h3><NuraActions compact/></article><article className="rail-card upcoming-card"><h3>Upcoming</h3><div className="upcoming"><Stethoscope /><span><b>GP appointment</b><small>14 Aug, 10:00 AM</small></span></div><div className="upcoming"><CalendarDays /><span><b>Blood test</b><small>16 Aug, 8:30 AM</small></span></div><Link className="rail-calendar-link" href="/calendar">View calendar <ChevronRight /></Link></article></aside></div>
    <Link href="/workspace" className="mobile-message-nura"><MessageCircle /> Message Nura</Link>
  </div></NuraShell>;
}