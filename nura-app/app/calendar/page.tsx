import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MessageCircle, Pill, Plus, Stethoscope } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const days = ["Mon 5","Tue 6","Wed 7","Thu 8","Fri 9","Sat 10","Sun 11"];
const events = [
  ["Mon 5", "7:30 PM", "Work Stress", "WhatsApp voice", "wellbeing"],
  ["Tue 6", "8:00 AM", "Medication reminder", "Amlodipine 5mg", "medication"],
  ["Wed 7", "6:30 PM", "Headaches check-in", "WhatsApp message", "health"],
  ["Thu 8", "10:30 AM", "GP appointment", "Dr. Patel", "appointment"],
  ["Fri 9", "7:30 PM", "Sleep check-in", "WhatsApp message", "sleep"],
  ["Sun 11", "6:00 PM", "Review summary", "Headaches", "document"],
] as const;

export default function CalendarPage() {
 return <NuraShell><div className="dashboard-page">
   <div className="page-title-row"><div><p className="eyebrow">CALENDAR</p><h1>Calendar</h1><p>Everything Nura is helping you remember, revisit or follow up.</p></div><button className="primary-button"><Plus/> Add</button></div>
   <div className="calendar-toolbar"><div className="segmented"><button className="active">Week</button><button>Month</button></div><div className="date-nav"><button><ChevronLeft/></button><b>5 – 11 Aug 2026</b><button><ChevronRight/></button></div></div>
   <div className="calendar-layout"><section className="calendar-board"><div className="calendar-head"><span>Time</span>{days.map(d=><b key={d}>{d}</b>)}</div>
     <div className="calendar-list">{events.map(([day,time,title,meta,tone])=><article key={title} className={`calendar-event ${tone}`}><div><small>{day}</small><b>{time}</b></div><span className="event-icon">{tone==='medication'?<Pill/>:tone==='appointment'?<Stethoscope/>:tone==='wellbeing'||tone==='sleep'?<MessageCircle/>:<CalendarDays/>}</span><div><h3>{title}</h3><p>{meta}</p></div></article>)}</div>
   </section><aside className="event-detail"><p className="eyebrow">EVENT DETAILS</p><div className="event-detail-icon"><Stethoscope/></div><h2>GP appointment</h2><p><Clock3/> Wednesday, 7 Aug · 10:30 AM</p><hr/><small>Related to</small><b>Headaches</b><small>Notes</small><p>Follow-up on headache monitoring. Bring any questions Nura prepares with you.</p><div className="button-stack"><button className="secondary-button">Reschedule</button><button className="secondary-button">Add note</button></div></aside></div>
 </div></NuraShell>;
}