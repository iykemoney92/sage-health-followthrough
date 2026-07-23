import Link from "next/link";
import { Clock3, MessageSquareText } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

const items=[
  ["Medical bill","Can you explain this bill and tell me if anything looks unusual?","Today · 10:42 AM"],
  ["Radiology report","What does mild disc degeneration mean?","Yesterday · 6:18 PM"],
  ["Insurance EOB","Why does this say I may owe £420?","15 Jul · 8:03 PM"],
];

export default function HistoryPage(){return <ClaritiShell><section className="clariti-library"><div className="clariti-library-head"><div><p className="clariti-kicker">YOUR CONVERSATIONS</p><h1>History</h1><p>Return to previous explanations and continue where you left off.</p></div></div><div style={{display:'grid',gap:10}}>{items.map(([title,question,time])=><Link href="/workspace" className="clariti-library-card" key={title} style={{display:'grid',gridTemplateColumns:'40px 1fr auto',gap:13,alignItems:'center'}}><span className="file-icon" style={{width:40,height:40,borderRadius:11,background:'var(--accent-soft)',display:'grid',placeItems:'center'}}><MessageSquareText size={18}/></span><span><h3 style={{margin:0}}>{title}</h3><p style={{marginTop:4}}>{question}</p></span><small style={{margin:0,display:'flex',alignItems:'center',gap:5}}><Clock3 size={12}/>{time}</small></Link>)}</div></section></ClaritiShell>}
