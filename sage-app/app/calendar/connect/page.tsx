"use client";

import { useState } from "react";
import Link from "next/link";
import { Apple, CalendarCheck, Check, ChevronRight, Clock3, Eye, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PrototypeAction } from "@/components/prototype-action";

const providers = [
  { id:"google", name:"Google Calendar", sub:"Use your Google calendar availability", badge:"G" },
  { id:"outlook", name:"Outlook Calendar", sub:"Microsoft 365 & Outlook.com", badge:"O" },
  { id:"apple", name:"Apple Calendar", sub:"Connect through your calendar account", badge:"A" },
] as const;

export default function CalendarConnectPage(){
  const [connected,setConnected]=useState<string[]>(["google"]);
  const [detail,setDetail]=useState<"busy"|"titles">("busy");
  return <AppShell active="Calendar"><section className="app-width app-main calendar-connect-page">
    <div className="page-eyebrow">CALENDAR & SCHEDULING</div>
    <h1 className="page-title">Let Sage work around your life.</h1>
    <p className="page-subtitle">Connect your personal calendar so Sage can suggest check-in times that do not clash with work, appointments, travel or other commitments.</p>

    <div className="calendar-connect-grid">
      <section className="panel connect-panel">
        <div className="panel-label">CONNECTED CALENDARS</div>
        <h2>Choose where Sage checks availability</h2>
        <p className="muted">Sage uses your availability to plan around you. It never moves your personal events.</p>
        <div className="provider-list">
          {providers.map(p=>{
            const on=connected.includes(p.id);
            return <button key={p.id} className={`provider-row ${on?"connected":""}`} onClick={()=>setConnected(v=>on?v.filter(x=>x!==p.id):[...v,p.id])}>
              <i>{p.id==="apple"?<Apple/>:<b>{p.badge}</b>}</i>
              <span><b>{p.name}</b><small>{p.sub}</small></span>
              <em>{on?<><Check/> Connected</>:<>Connect <ChevronRight/></>}</em>
            </button>
          })}
        </div>
      </section>

      <aside className="panel calendar-privacy-panel">
        <div className="panel-label">PRIVACY CONTROL</div>
        <h2>What Sage can see</h2>
        <button className={`visibility-option ${detail==="busy"?"active":""}`} onClick={()=>setDetail("busy")}><span className="radio"/><div><b>Free / busy times only</b><small>Recommended. Sage knows when you are unavailable without reading event names.</small></div></button>
        <button className={`visibility-option ${detail==="titles"?"active":""}`} onClick={()=>setDetail("titles")}><span className="radio"/><div><b>Event names and times</b><small>Give Sage more context when deciding when to schedule.</small></div></button>
        <div className="privacy-assurance"><ShieldCheck/><p>Sage uses calendar access only for scheduling and conflict avoidance. Personal events stay yours.</p></div>
      </aside>
    </div>

    <section className="panel scheduling-model">
      <div className="panel-label">HOW V1 SCHEDULING WORKS</div>
      <div className="scheduling-steps">
        <div><i><Eye/></i><b>Sage checks availability</b><span>Your connected calendar shows when you are free or busy.</span></div>
        <ChevronRight/>
        <div><i><Clock3/></i><b>Sage proposes a time</b><span>It chooses a conflict-free slot that fits your plan.</span></div>
        <ChevronRight/>
        <div><i><CalendarCheck/></i><b>You stay in control</b><span>Approve, move, skip, pause or ask Sage to replan.</span></div>
      </div>
      <div className="scheduling-actions"><Link href="/calendar" className="app-btn primary">Done — view calendar</Link><PrototypeAction className="app-btn outline" label="Preview a scheduling conflict" title="Your schedule changed" description="Your Sleep reset at 7:00 PM now overlaps with something in your calendar."><div className="conflict-options"><button><b>8:30 PM tonight</b><span>Free · Recommended</span></button><button><b>7:30 PM tomorrow</b><span>Free</span></button><button><b>Keep original time</b><span>Ignore the conflict</span></button></div></PrototypeAction></div>
    </section>
  </section></AppShell>
}
