import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppShell, ChannelPill, NewPlanButton } from "@/components/app-shell";

const plans = [
  {title:"Stabilise My Week", type:"Wellbeing + Health Follow-Up", progress:43, next:"Sleep reset · Today, 7:00 PM", done:"3 completed", pending:"4 upcoming", voice:false},
  {title:"Better Sleep Routine", type:"Wellbeing", progress:67, next:"Wind-down check-in · Tomorrow", done:"4 completed", pending:"2 upcoming", voice:true},
  {title:"Return-to-Work Reset", type:"Occupational health", progress:20, next:"Energy check-in · Friday", done:"1 completed", pending:"4 upcoming", voice:false},
];

export default function MyPlansPage(){
 return <AppShell active="My Plans"><section className="app-width app-main">
   <div className="section-head"><div><div className="page-eyebrow">YOUR PLANS</div><h1 className="page-title">My Plans</h1><p className="page-subtitle">Everything Sage is helping you follow through, one plan at a time.</p></div><NewPlanButton/></div>
   <div className="tabs"><button className="active">Active plans</button><button>Completed</button></div>
   <div className="plans-grid">{plans.map(p=><Link href={p.title==="Stabilise My Week"?"/my-plans/stabilise-my-week":"#"} className="panel plan-card-app" key={p.title}>
      <span className="plan-type">{p.type}</span><h3>{p.title}</h3><p className="muted">Next: {p.next}</p>
      <div className="progress-line"><i style={{width:`${p.progress}%`}}/></div>
      <div className="plan-stats"><div className="plan-stat"><b>{p.progress}%</b><span>progress</span></div><div className="plan-stat"><b>{p.done.split(' ')[0]}</b><span>completed</span></div><div className="plan-stat"><b>{p.pending.split(' ')[0]}</b><span>upcoming</span></div></div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16}}><ChannelPill voice={p.voice}/><span className="text-link">View plan <ChevronRight size={15}/></span></div>
   </Link>)}</div>
 </section></AppShell>
}