import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, Cross, FileText, HeartPulse, LockKeyhole, MessageCircle, Pill, Stethoscope, UsersRound } from "lucide-react";

const features = [
  [MessageCircle,"Conversations that feel natural","Talk, type, send a voice note, or upload context. Nura understands and keeps the important parts."],
  [HeartPulse,"Threads that keep things together","Nura organises topics, documents, updates and check-ins into one ongoing context."],
  [BellRing,"Proactive follow-ups that fit your life","Check-ins arrive at useful moments through the app or WhatsApp-style flows."],
  [FileText,"Summaries that save you time","Get clean updates before appointments, reviews, therapy sessions or care conversations."],
  [LockKeyhole,"Private by design, always in control","You decide what Nura remembers and can review, export or remove information."],
] as const;

const careContexts = [
  {label:"NHS care",sub:"Appointments & follow-up",kind:"nhs" as const},
  {label:"GP care",sub:"Visits & reviews",Icon:Stethoscope},
  {label:"Pharmacy",sub:"Medication context",Icon:Pill},
  {label:"Wellbeing",sub:"Everyday support",Icon:HeartPulse},
  {label:"Therapy",sub:"Between-session context",Icon:Cross},
  {label:"Care teams",sub:"People supporting you",Icon:UsersRound},
] as const;

export default function LandingPage() {
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="brand brand-leaf"><span className="brand-leaf-mark">❦</span><span><b>Nura</b><small>Your AI health companion</small></span></Link><nav><a href="#how">How it works</a><a href="#why">Why Nura</a><a href="#features">Features</a><a href="#security">Security</a></nav><div className="nav-actions"><Link href="/login" className="text-link">Sign in</Link><Link href="/signup" className="primary-cta">Get started</Link></div></header>

    <section className="hero-section reconciled-hero"><div className="hero-copy"><h1>Your health.<br/><span>Organised. Remembered.</span><br/><em>Followed through.</em></h1><p>Nura listens, organises what matters, and gently checks in so nothing important gets lost between the moments of care.</p>
      <div className="hero-mini-features">
        <div><span><MessageCircle/></span><b>Talk or upload</b><small>Messages, voice notes, or documents</small></div>
        <div><span><HeartPulse/></span><b>Nura organises</b><small>Important things become Threads</small></div>
        <div><span><BellRing/></span><b>Nura follows up</b><small>Proactive check-ins at the right time</small></div>
        <div><span><FileText/></span><b>Summaries</b><small>Clear updates for you and your care team</small></div>
      </div>
      <div className="hero-actions"><Link href="/signup" className="primary-cta large">Get started for free</Link><a href="#how" className="secondary-cta large">See how Nura works</a></div><div className="trust-line"><LockKeyhole/> Private, secure and designed for your peace of mind.</div></div>
      <div className="hero-product reconciled-product"><div className="phone-card"><div className="phone-top"><span className="mini-mark">❦</span><b>Nura</b><small>online</small></div><div className="chat-thread"><div className="ai-bubble">Good evening, Ike 👋<br/>How was your day?</div><div className="user-bubble">Pretty stressful at work today and I didn&apos;t sleep well last night.</div><div className="ai-bubble">I&apos;m sorry to hear that. I&apos;ll keep this in your Work Stress thread and check in with you later.</div><div className="ai-bubble">Would you like me to check in tonight?</div><div className="chips"><span>Yes, please</span><span>Not tonight</span></div></div><div className="message-bar"><span>＋</span> Message Nura <MessageCircle/></div></div>
        <div className="dashboard-preview"><div className="preview-sidebar"><div className="mini-brand">❦ Nura</div><span className="active">Today</span><span>Threads</span><span>Calendar</span><span>Me</span></div><div className="preview-main"><p>Good evening, Ike</p><h3>Here&apos;s what needs your attention today.</h3><div className="preview-grid"><article className="preview-focus"><small>Next check-in</small><h4>Work Stress</h4><p>Today, 7:30 PM · WhatsApp voice</p><button>Start now</button></article><article><small>Upcoming</small><b>GP appointment</b><span>14 Aug, 10:00 AM</span><b>Blood test</b><span>16 Aug, 8:30 AM</span><b>Therapy session</b><span>20 Aug, 4:00 PM</span></article></div><h4 className="section-label">Active Threads</h4><div className="preview-threads"><span><b>Work Stress</b><small>Check-in tonight</small></span><span><b>Headaches</b><small>2 updates this week</small></span><span><b>New Medication</b><small>Started 5 days ago</small></span></div><div className="preview-summary"><span>Weekly summary ready</span><button>View summary</button></div></div></div>
      </div>
    </section>

    <section className="care-context-strip" aria-label="Care contexts Nura is designed around"><p>Designed for people navigating everyday health across</p><div className="care-context-row">{careContexts.map((item)=>{const Icon="Icon" in item?item.Icon:null;const isNhs="kind" in item&&item.kind==="nhs";return <div className="care-context-item" key={item.label}>{isNhs?<span className="nhs-wordmark" aria-label="NHS">NHS</span>:Icon?<span className="care-context-icon"><Icon/></span>:null}<span><b>{item.label}</b><small>{item.sub}</small></span></div>})}</div></section>

    <section id="how" className="how-section reconciled-how"><div className="section-intro"><span>HOW NURA WORKS</span><h2>Help for real life, not just data.</h2><p>Nura turns everyday health context into something you can actually keep up with.</p></div><div id="features" className="feature-grid five-up">{features.map(([Icon,title,copy])=><article key={title}><span className="feature-icon"><Icon/></span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section id="why" className="story-section"><div><span className="section-kicker">WHY NURA</span><h2>Healthcare happens in moments.<br/>Life happens in between.</h2><p>You leave an appointment with advice. You start a medication. You notice a symptom. Work gets stressful. Sleep changes. Nura helps keep those fragments connected so the next step does not disappear into everyday life.</p><Link href="/signup" className="text-arrow">Start with what&apos;s happening today <ArrowRight/></Link></div><div className="story-cards"><article><CalendarDays/><b>After a GP visit</b><p>Keep advice, questions, symptoms and the next review together.</p></article><article><HeartPulse/><b>When something changes</b><p>Tell Nura once. It remembers the context and can check back in later.</p></article></div></section>

    <section id="security" className="security-section"><LockKeyhole/><div><span>PRIVATE BY DESIGN</span><h2>Your health context belongs to you.</h2><p>Nura is designed around transparent memory, user control and clear boundaries. It organises and follows through — it does not diagnose, prescribe or replace professional care.</p></div><Link href="/signup" className="primary-cta">Create your Nura</Link></section>
    <footer><div className="brand"><span className="brand-mark">N</span><b>Nura</b></div><p>Your AI health companion.</p><span>© 2026 Nura</span></footer>
  </main>;
}