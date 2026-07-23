import {
  ArrowRight,
  Bell,
  Brain,
  Camera,
  Footprints,
  Heart,
  ListChecks,
  LockKeyhole,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  MoreVertical,
  Paperclip,
  Phone,
  Pill,
  ShieldCheck,
  Smile,
  Sprout,
  Stethoscope,
  UserRound,
} from "lucide-react";

function SageMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? "sage-logo sage-logo-small" : "sage-logo"} viewBox="0 0 36 42" aria-hidden="true">
      <path d="M18.7 37.8c.2-9.2 4.1-18.3 11.8-27.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.8 21.8C8.1 22.2 3.4 16.6 3 7.1c8.6.2 14.5 4.7 14.8 14.7Z" fill="currentColor" />
      <path d="M21.7 15.1C20.9 7 25.7 2.7 33.6 2c-.1 7.8-4 12.6-11.9 13.1Z" fill="currentColor" />
      <path d="M13.7 35.7c-5.6-2.3-8-6.8-7.2-13.4 6.1 1.4 9.7 5.9 7.2 13.4Z" fill="currentColor" opacity=".86" />
    </svg>
  );
}

function Botanical() {
  return (
    <svg className="botanical" viewBox="0 0 220 420" aria-hidden="true">
      <path d="M91 420C102 292 131 175 200 51" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M119 286c-50-9-76-40-85-89 47 6 81 28 85 89Z" fill="currentColor" />
      <path d="M128 239c31-39 61-59 92-60-10 41-39 63-92 60Z" fill="currentColor" />
      <path d="M155 163c-31-29-40-62-31-101 35 18 49 52 31 101Z" fill="currentColor" />
      <path d="M165 126c26-26 44-54 51-84" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function Home() {
  const categories = [
    [Brain, "Wellbeing"],
    [Moon, "Sleep"],
    [Stethoscope, "Health advice"],
    [Pill, <>Medication<br />routines</>],
    [Footprints, "Healthy habits"],
    [Sprout, "Recovery"],
  ] as const;

  return (
    <main className="landing">
      <header className="site-header">
        <div className="page-width nav-inner">
          <a className="wordmark" href="#"><SageMark /><strong>Sage</strong></a>
          <nav>
            <a href="#how">How it works</a>
            <a href="/auth/sign-in">Log in</a>
            <a className="top-cta" href="/auth/sign-up">Get started</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="page-width hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">YOUR HEALTH, EASIER TO FOLLOW THROUGH</div>
            <h1>Turn health advice<br />into a plan you can<br /><span>actually follow.</span></h1>
            <p>Sage turns what you’re dealing with and the guidance you’ve received into a simple plan — then checks in through WhatsApp to help you keep going.</p>
            <div className="hero-actions">
              <a className="primary-button" href="/auth/sign-up">Get started <ArrowRight /></a>
              <a className="outline-button" href="#how">See how Sage works</a>
            </div>
            <div className="assurance"><ShieldCheck /><span>No complicated tracking</span><i /><span>You stay in control</span></div>
          </div>

          <div className="hero-product">
            <Botanical />
            <div className="phone-mock">
              <div className="phone-inner">
                <div className="statusbar"><b>9:41</b><span className="dynamic-island" /><span>▮▮⌁</span></div>
                <div className="whatsapp-head">
                  <span className="back">‹</span>
                  <span className="wa-avatar"><SageMark small /></span>
                  <div><b>Sage</b><small>Online</small></div>
                  <span className="wa-spacer" />
                  <Phone /><MoreVertical />
                </div>
                <div className="chat-wall">
                  <div className="today-chip">Today</div>
                  <div className="bubble"><b>Good morning, Ike. 🌿</b><br /><br />How did you sleep last night?<small>8:00 AM</small></div>
                  <div className="bubble">Your plan today is simple:<br />take your medication and,<br />if you feel up to it, take a<br />10-minute walk.<small>8:00 AM</small></div>
                  <button className="reply active">Medication taken ✓</button>
                  <button className="reply">Not yet</button>
                  <button className="reply">I can walk today</button>
                </div>
                <div className="composer"><Smile /><span>Message</span><Paperclip /><Camera /><b><Mic /></b></div>
                <div className="homebar" />
              </div>
            </div>

            <div className="plan-card">
              <div className="plan-title"><h3>Stabilise My Week</h3><Menu /></div>
              <div className="divider" />
              <p>Day 3 of 7</p>
              <div className="progress-row"><div className="progress"><i /></div><b>43%</b></div>
              <div className="divider" />
              <small>Today</small>
              <div className="plan-task"><div><b>Sleep reset</b><span>7:00 PM · WhatsApp check-in</span></div><i><Moon /></i></div>
              <div className="divider" />
              <small>Up next</small>
              <div className="plan-task"><div><b>10-minute walk</b><span>Tomorrow</span></div><i><Footprints /></i></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="how page-width">
        <h2>From “I need to do this” to actually doing it.</h2>
        <div className="steps">
          <div className="step"><i><MessageSquare /></i><h3>01. Tell Sage what’s going on</h3><p>Share what you’re dealing with,<br />your goals, or guidance you’ve<br />already received.</p></div>
          <ArrowRight className="step-arrow" />
          <div className="step"><i><ListChecks /></i><h3>02. Get a simple plan</h3><p>Sage turns that context into<br />manageable steps, reminders<br />and check-ins.</p></div>
          <ArrowRight className="step-arrow" />
          <div className="step"><i><Heart /></i><h3>03. Keep going with Sage</h3><p>Sage checks in through WhatsApp<br />and helps you stay on track<br />one step at a time.</p></div>
        </div>
      </section>

      <section className="manage page-width">
        <h2>One companion. Different things life asks you to manage.</h2>
        <div className="category-grid">
          {categories.map(([Icon, label], index) => (
            <div className="category" key={index}><i><Icon /></i><b>{label}</b></div>
          ))}
        </div>
      </section>

      <section className="trust page-width">
        <div className="trust-top">
          <div className="trust-title"><ShieldCheck /><h2>Built to support you —<br />not replace your care.</h2></div>
          <p>Sage helps you follow through on your goals and existing guidance.<br />It does not diagnose conditions or replace doctors, therapists or<br />other healthcare professionals.</p>
        </div>
        <div className="trust-controls">
          <div><LockKeyhole />You control your data</div>
          <div><UserRound />You control Sage’s memory</div>
          <div><Bell />You control your check-ins</div>
        </div>
      </section>

      <section id="start" className="final-cta page-width">
        <h2>You already know what you need to do.<br /><span>Sage helps you keep going.</span></h2>
        <div><a className="primary-button" href="/auth/sign-up">Get started with Sage <ArrowRight /></a><small>Start by telling Sage what’s going on.</small></div>
      </section>

      <footer className="page-width footer">
        <div className="footer-brand"><a className="wordmark" href="#"><SageMark /><strong>Sage</strong></a><span>AI follow-through for health &amp; wellbeing.</span></div>
        <nav><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Support</a></nav>
      </footer>
    </main>
  );
}
