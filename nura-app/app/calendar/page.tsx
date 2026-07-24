import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, MessageCircle, Pill, Stethoscope } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const weekDays = ["Mon 5","Tue 6","Wed 7","Thu 8","Fri 9","Sat 10","Sun 11"];
const hours = ["7 AM","8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM","8 PM"];

const desktopEvents = [
  { day:1, row:2, span:1, title:"Medication reminder", meta:"8:00 AM", tone:"medication" },
  { day:2, row:7, span:2, title:"GP appointment", meta:"10:30 – 11:00 AM", tone:"appointment" },
  { day:1, row:12, span:1, title:"Headaches check-in", meta:"WhatsApp message · 6:00 PM", tone:"wellbeing" },
  { day:3, row:13, span:2, title:"New Medication check-in", meta:"7:30 PM", tone:"medication" },
  { day:4, row:3, span:1, title:"Sleep check-in", meta:"WhatsApp message · 8:30 AM", tone:"health" },
  { day:4, row:12, span:1, title:"Work Stress check-in", meta:"6:00 PM", tone:"stress" },
  { day:5, row:7, span:1, title:"Follow-up message", meta:"WhatsApp · 11:00 AM", tone:"health" },
  { day:6, row:7, span:1, title:"Review uploaded note", meta:"11:00 AM", tone:"document" },
];

const mobileEvents = [
  ["Mon 5","7:30 PM","Work Stress","WhatsApp voice","wellbeing"],
  ["Tue 6","8:00 AM","Medication reminder","Amlodipine 5mg","medication"],
  ["Wed 7","6:30 PM","Headaches check-in","WhatsApp message","health"],
  ["Thu 8","10:30 AM","GP appointment","Dr. Patel","appointment"],
  ["Fri 9","7:30 PM","Sleep check-in","WhatsApp message","sleep"],
  ["Sun 11","6:00 PM","Weekly summary","Headaches","document"],
] as const;

export default function CalendarPage(){
  return <NuraShell><div className="dashboard-page calendar-page">
    <div className="calendar-page-head">
      <div><h1>Calendar</h1></div>
      <div className="calendar-view-toggle"><button className="active">Week</button><button>Month</button></div>
    </div>

    <div className="calendar-date-nav"><button><ChevronLeft/></button><b>5 – 11 Aug 2026</b><button><ChevronRight/></button></div>

    <div className="calendar-desktop-layout">
      <section className="week-calendar-card">
        <div className="week-calendar-header"><div className="time-head">All day</div>{weekDays.map(day=><div key={day} className="day-head">{day}</div>)}</div>
        <div className="week-calendar-body">
          <div className="time-column">{hours.map(hour=><div key={hour}>{hour}</div>)}</div>
          <div className="week-grid">
            {hours.map((_,i)=><span key={`h-${i}`} className="grid-line horizontal" style={{top:`${(i/14)*100}%`}}/>)}
            {[1,2,3,4,5,6].map(i=><span key={`v-${i}`} className="grid-line vertical" style={{left:`${(i/7)*100}%`}}/>)}
            {desktopEvents.map((event,index)=><article key={`${event.title}-${index}`} className={`desktop-calendar-event ${event.tone}`} style={{left:`calc(${((event.day-1)/7)*100}% + 8px)`,width:`calc(${100/7}% - 16px)`,top:`calc(${((event.row-1)/14)*100}% + 5px)`,height:`calc(${(event.span/14)*100}% - 10px)`}}><b>{event.title}</b><span>{event.meta}</span></article>)}
          </div>
        </div>
      </section>

      <aside className="calendar-detail product-detail-panel">
        <div className="detail-panel-head"><span className="detail-type-icon"><Stethoscope/></span><button aria-label="Close event details">×</button></div>
        <h2>GP appointment</h2>
        <div className="detail-meta-row"><CalendarDays/><span><b>Wednesday, 7 Aug 2024</b><small>10:30 – 11:00 AM</small></span></div>
        <div className="detail-meta-row"><MapPin/><span><b>Location</b><small>Dr. Patel&apos;s Clinic<br/>12 Health St, Lagos</small></span></div>
        <div className="detail-meta-row"><Clock3/><span><b>Reminder</b><small>15 minutes before</small></span></div>
        <div className="detail-notes"><b>Notes</b><p>Follow-up on headache monitoring. Bring any questions Nura prepares with you.</p></div>
        <div className="detail-actions"><button className="secondary-cta">Edit event</button><button className="danger-button">Delete</button></div>
        <button className="detail-close">Close</button>
      </aside>
    </div>

    <div className="calendar-mobile-only">
      <section className="calendar-events">{mobileEvents.map(([day,time,title,meta,tone])=><article key={title} className={`calendar-item ${tone}`}><div><small>{day}</small><b>{time}</b></div><span>{tone==='medication'?<Pill/>:tone==='appointment'?<Stethoscope/>:tone==='wellbeing'||tone==='sleep'?<MessageCircle/>:<CalendarDays/>}</span><div><h3>{title}</h3><p>{meta}</p></div></article>)}</section>
    </div>
  </div></NuraShell>
}