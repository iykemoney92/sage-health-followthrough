"use client";

import { CalendarClock, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useState } from "react";
import { AppShell, ChannelPill } from "@/components/app-shell";
import { PrototypeAction } from "@/components/prototype-action";

const cells=[27,28,29,30,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31];
const months=["June 2026","July 2026","August 2026"];

export default function CalendarPage(){
 const [view,setView]=useState<"week"|"month">("month");
 const [month,setMonth]=useState(1);
 const [selected,setSelected]=useState("Sleep reset");
 return <AppShell active="Calendar"><section className="app-width app-main">
  <div className="section-head"><div><div className="page-eyebrow">CHECK-INS & REMINDERS</div><h1 className="page-title">Calendar</h1><p className="page-subtitle">See every Sage session across your plans in one calm view.</p></div><div className="tabs" style={{margin:0}}><button className={view==="week"?"active":""} onClick={()=>setView("week")}>Week</button><button className={view==="month"?"active":""} onClick={()=>setView("month")}>Month</button></div></div>
  <div className="calendar-shell">
   <section className="panel calendar-panel"><div className="calendar-toolbar"><button className="app-btn outline" onClick={()=>setMonth(Math.max(0,month-1))}><ChevronLeft/></button><h2 style={{fontFamily:'var(--font-display)',fontSize:28,margin:0}}>{months[month]}</h2><button className="app-btn outline" onClick={()=>setMonth(Math.min(2,month+1))}><ChevronRight/></button></div>
   {view==="month"?<div className="calendar-grid">{cells.map((n,i)=><button type="button" className={`cal-cell ${i<4?'muted-cell':''}`} key={i} onClick={()=>{if(n===23)setSelected("Sleep reset");if(n===24)setSelected("10-minute walk");}}><b>{n}</b>{n===23&&<div className="event">7:00 PM · Sleep reset</div>}{n===24&&<div className="event blue">10:00 AM · Walk check-in</div>}{n===27&&i>4&&<div className="event">6:30 PM · Reflection</div>}</button>)}</div>:<div className="prototype-week-view">{["Thu 23","Fri 24","Sat 25","Sun 26","Mon 27","Tue 28","Wed 29"].map((d,i)=><button key={d} className={`prototype-week-day ${i===0?'active':''}`} onClick={()=>setSelected(i===1?"10-minute walk":"Sleep reset")}><b>{d}</b><span>{i===0?"7:00 PM · Sleep reset":i===1?"10:00 AM · Walk check-in":"No check-in"}</span></button>)}</div>}
   </section>
   <aside className="panel calendar-detail"><div className="panel-label">SELECTED CHECK-IN</div><h3>{selected}</h3><p className="muted">Stabilise My Week</p><div className="plan-meta-row"><CalendarClock/> {selected==="Sleep reset"?"7:00 PM":"10:00 AM"}</div><ChannelPill/><p style={{lineHeight:1.6,marginTop:18}}>A short Sage check-in focused on keeping today manageable and helping you follow through.</p><PrototypeAction className="app-btn primary" label={<><MessageCircle/> Start check-in</>} title={`Start ${selected}`} description="This opens the check-in experience in the frontend prototype."/><PrototypeAction className="app-btn outline" label="Reschedule" title="Reschedule check-in" description="Choose another time for this check-in in the live product."><div className="prototype-choice-row"><button>Later today</button><button>Tomorrow</button><button>Pick a time</button></div></PrototypeAction><PrototypeAction className="app-btn outline" label="Cancel" title="Cancel this check-in?" description="The prototype keeps the event in place; the live integration will update the schedule."/></aside>
  </div>
 </section></AppShell>;
}