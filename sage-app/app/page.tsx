import { Brain, Moon, Stethoscope, Pill, Footprints, Sprout, MessageSquare, ListChecks, Heart, ShieldCheck, LockKeyhole, UserRound, Bell, ArrowRight, Menu, Phone, MoreVertical, Smile, Paperclip, Camera, Mic } from "lucide-react";

const GreenLeaf = ({ small = false }: { small?: boolean }) => (
  <span className={small ? "sage-mark sage-mark-small" : "sage-mark"} aria-hidden="true">
    <i className="leaf leaf-a" /><i className="leaf leaf-b" />
  </span>
);

export default function Home() {
  const categories = [
    [Brain, "Wellbeing"], [Moon, "Sleep"], [Stethoscope, "Health advice"],
    [Pill, <>Medication<br/>routines</>], [Footprints, "Healthy habits"], [Sprout, "Recovery"],
  ] as const;
  return <main className="landing">
    <header className="site-header"><div className="page-width nav-inner">
      <a className="wordmark"><GreenLeaf/><strong>Sage</strong></a>
      <nav><a href="#how">How it works</a><a href="#">Log in</a><a className="top-cta" href="#start">Get started</a></nav>
    </div></header>

    <section className="hero"><div className="page-width hero-grid">
      <div className="hero-copy">
        <div className="eyebrow">YOUR HEALTH, EASIER TO FOLLOW THROUGH</div>
        <h1>Turn health advice<br/>into a plan you can<br/><span>actually follow.</span></h1>
        <p>Sage turns what you’re dealing with and the<br className="desktop-break"/> guidance you’ve received into a simple plan —<br className="desktop-break"/> then checks in through WhatsApp to help<br className="desktop-break"/> you keep going.</p>
        <div className="hero-actions"><a className="primary-button">Get started <ArrowRight size={19}/></a><a className="outline-button" href="#how">See how Sage works</a></div>
        <div className="assurance"><ShieldCheck/><span>No complicated tracking</span><i/><span>You stay in control</span></div>
      </div>

      <div className="hero-product">
        <div className="botanical" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <div className="phone-mock">
          <div className="phone-inner">
            <div className="statusbar"><b>9:41</b><span className="dynamic-island"/><span>▮▮⌁</span></div>
            <div className="whatsapp-head"><span className="back">‹</span><span className="wa-avatar"><GreenLeaf small/></span><div><b>Sage</b><small>Online</small></div><span className="wa-spacer"/><Phone/><MoreVertical/></div>
            <div className="chat-wall"><div className="today-chip">Today</div>
              <div className="bubble"><b>Good morning, Ike. 🌿</b><br/><br/>How did you sleep last night?<small>8:00 AM</small></div>
              <div className="bubble">Your plan today is simple:<br/>take your medication and,<br/>if you feel up to it, take a<br/>10-minute walk.<small>8:00 AM</small></div>
              <button className="reply active">Medication taken ✓</button><button className="reply">Not yet</button><button className="reply">I can walk today</button>
            </div>
            <div className="composer"><Smile/><span>Message</span><Paperclip/><Camera/><b><Mic/></b></div><div className="homebar"/>
          </div>
        </div>
        <div className="plan-card">
          <div className="plan-title"><h3>Stabilise My Week</h3><Menu/></div><div className="divider"/>
          <p>Day 3 of 7</p><div className="progress-row"><div className="progress"><i/></div><b>43%</b></div><div className="divider"/>
          <small>Today</small><div className="plan-task"><div><b>Sleep reset</b><span>7:00 PM · WhatsApp check-in</span></div><i><Moon/></i></div><div className="divider"/>
          <small>Up next</small><div className="plan-task"><div><b>10-minute walk</b><span>Tomorrow</span></div><i><Footprints/></i></div>
        </div>
      </div>
    </div></section>

    <section id="how" className="how page-width"><h2>From “I need to do this” to actually doing it.</h2><div className="steps">
      <div className="step"><i><MessageSquare/></i><h3>01. Tell Sage what’s going on</h3><p>Share what you’re dealing with,<br/>your goals, or guidance you’ve<br/>already received.</p></div><ArrowRight className="step-arrow"/>
      <div className="step"><i><ListChecks/></i><h3>02. Get a simple plan</h3><p>Sage turns that context into<br/>manageable steps, reminders<br/>and check-ins.</p></div><ArrowRight className="step-arrow"/>
      <div className="step"><i><Heart/></i><h3>03. Keep going with Sage</h3><p>Sage checks in through WhatsApp<br/>and helps you stay on track<br/>one step at a time.</p></div>
    </div></section>

    <section className="manage page-width"><h2>One companion. Different things life asks you to manage.</h2><div className="category-grid">{categories.map(([Icon,label],i)=><div className="category" key={i}><i><Icon/></i><b>{label}</b></div>)}</div></section>

    <section className="trust page-width"><div className="trust-top"><div className="trust-title"><ShieldCheck/><h2>Built to support you —<br/>not replace your care.</h2></div><p>Sage helps you follow through on your goals and existing guidance.<br/>It does not diagnose conditions or replace doctors, therapists or<br/>other healthcare professionals.</p></div><div className="trust-controls"><div><LockKeyhole/>You control your data</div><div><UserRound/>You control Sage’s memory</div><div><Bell/>You control your check-ins</div></div></section>

    <section id="start" className="final-cta page-width"><h2>You already know what you need to do.<br/><span>Sage helps you keep going.</span></h2><div><a className="primary-button">Get started with Sage <ArrowRight size={19}/></a><small>Start by telling Sage what’s going on.</small></div></section>

    <footer className="page-width footer"><div className="footer-brand"><a className="wordmark"><GreenLeaf/><strong>Sage</strong></a><span>AI follow-through for health &amp; wellbeing.</span></div><nav><a>Privacy</a><a>Terms</a><a>Support</a></nav></footer>
  </main>;
}