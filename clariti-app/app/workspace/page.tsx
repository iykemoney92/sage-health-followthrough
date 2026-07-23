"use client";

import { useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, Flag, Image as ImageIcon, MoreHorizontal, Paperclip, Plus, Send, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import Link from "next/link";

const sessions = [
  { id:"bill", title:"Medical bill", meta:"City Hospital · 23 Jul", tag:"Bill" },
  { id:"radiology", title:"Radiology report", meta:"MRI lumbar spine · 22 Jul", tag:"Report" },
  { id:"eob", title:"Insurance EOB", meta:"BlueCross · Claim 8472", tag:"EOB" },
];

type SessionId = "bill"|"radiology"|"eob";
type CanvasTab = "summary"|"detail"|"actions";

export default function WorkspacePage() {
  const [active,setActive]=useState<SessionId>("bill");
  const [canvasTab,setCanvasTab]=useState<CanvasTab>("summary");
  const [callOpen,setCallOpen]=useState(false);
  const session=sessions.find(s=>s.id===active)!;
  const chooseSession=(id:SessionId)=>{setActive(id);setCanvasTab("summary")};

  return (
    <main className="clariti-workspace">
      <aside className="clariti-left-panel">
        <div className="workspace-brand-row"><Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link><Link href="/" className="workspace-new" aria-label="New conversation"><Plus/></Link></div>
        <div className="conversation-label">MESSAGES</div>
        <nav className="clariti-conversations">{sessions.map(item=><button key={item.id} className={active===item.id?"active":""} onClick={()=>chooseSession(item.id as SessionId)}><span className="file-icon"><FileText/></span><span><b>{item.title}</b><small>{item.meta}</small></span><MoreHorizontal/></button>)}</nav>
        <div className="left-panel-note"><ShieldCheck/><p>Your documents stay private and under your control.</p></div>
      </aside>

      <section className="clariti-chat-panel">
        <header className="workspace-chat-header"><div><Link href="/" className="back-link"><ArrowLeft/> Back</Link><h1>{session.title}</h1><p>{session.meta}</p></div><div className="workspace-header-actions"><button onClick={()=>setCallOpen(true)}><CalendarDays/> Schedule a call</button><span className="doc-chip">{session.tag}</span></div></header>
        <div className="clariti-chat-scroll">
          <div className="clariti-date-chip">Today</div>
          {active==="bill"&&<><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>hospital-bill-july.pdf</b><small>2 pages · 384 KB</small></span></span><p>Can you explain this bill and tell me if anything looks unusual?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>I’ve gone through the bill. The total is <b>£1,248.60</b>, and <b>£930.00 appears to be your responsibility</b>.</p><p>I’ve broken down the charges on the canvas and flagged one item worth clarifying.</p><div className="clariti-inline-note"><Flag/> One charge may need clarification</div></div></div></>}
          {active==="radiology"&&<><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>MRI-lumbar-spine-report.pdf</b><small>Radiology report · 3 pages</small></span></span><p>Can you explain what this MRI report means in plain English?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>The report describes <b>mild degenerative changes in your lower back</b>, most noticeable at L4–L5.</p><p>The radiologist also says there is <b>no severe spinal canal narrowing</b>. I’ve separated the findings, anatomy and useful questions on the canvas.</p><div className="clariti-inline-note radiology-note"><Stethoscope/> This is an explanation of the report, not a diagnosis</div></div></div></>}
          {active==="eob"&&<><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>insurance-eob-8472.pdf</b><small>Explanation of Benefits · 4 pages</small></span></span><p>What did insurance actually pay, and do I owe the rest?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>This EOB shows what was <b>billed, allowed, paid by your insurer, and assigned to you</b>. An EOB is not itself a bill.</p><p>I’ve mapped the claim flow and highlighted the amount marked as your responsibility.</p></div></div></>}
          <div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>Would you like to go through anything in this document with a Clariti support agent?</p><div className="clariti-quick-actions"><button onClick={()=>setCallOpen(true)}>Schedule a call about this document</button><button onClick={()=>setCanvasTab("actions")}>Show suggested questions</button></div></div></div>
        </div>
        <div className="clariti-workspace-composer"><button aria-label="Attach"><Paperclip/></button><input placeholder="Ask a follow-up question…"/><button className="send"><Send/></button></div>
      </section>

      <aside className={`clariti-canvas canvas-${active}`}>
        <header><div><p className="canvas-kicker">{active==="bill"?"BILL EXPLAINER":active==="radiology"?"RADIOLOGY REPORT":"INSURANCE EOB"}</p><h2>{active==="bill"?"Your bill, made clearer":active==="radiology"?"Your MRI, in plain English":"Your claim, made clearer"}</h2></div>{active==="radiology"?<ImageIcon/>:<Sparkles/>}</header>
        <div className="canvas-tabs"><button className={canvasTab==="summary"?"active":""} onClick={()=>setCanvasTab("summary")}>Summary</button><button className={canvasTab==="detail"?"active":""} onClick={()=>setCanvasTab("detail")}>{active==="bill"?"Charges":active==="radiology"?"Findings":"Claim"}</button><button className={canvasTab==="actions"?"active":""} onClick={()=>setCanvasTab("actions")}>Next steps</button></div>
        {active==="bill"&&<BillCanvas tab={canvasTab}/>} 
        {active==="radiology"&&<RadiologyCanvas tab={canvasTab}/>} 
        {active==="eob"&&<EobCanvas tab={canvasTab}/>} 
        <button className="canvas-call" onClick={()=>setCallOpen(true)}><CalendarDays/> Schedule a call about this document</button>
        <footer className="canvas-footer">Clariti explains and organises your document. It does not replace your clinician, insurer, billing team or other relevant professional.</footer>
      </aside>

      {callOpen&&<div className="clariti-modal-backdrop" onMouseDown={()=>setCallOpen(false)}><div className="clariti-modal" onMouseDown={e=>e.stopPropagation()}><span className="modal-icon"><CalendarDays/></span><p className="canvas-kicker">DOCUMENT SUPPORT CALL</p><h2>Talk through this {session.tag.toLowerCase()}</h2><p>Schedule a call with a Clariti agent who can discuss this specific document with the conversation and canvas available as context.</p><div className="call-slots"><button>Today · 6:30 PM</button><button>Tomorrow · 10:00 AM</button><button>Choose another time</button></div><div className="modal-actions"><button onClick={()=>setCallOpen(false)}>Cancel</button><button className="primary" onClick={()=>setCallOpen(false)}>Continue to scheduling</button></div><small>Prototype only — no call is booked yet.</small></div></div>}
    </main>
  );
}

function BillCanvas({tab}:{tab:CanvasTab}){if(tab==="summary")return <div className="canvas-content"><section className="clariti-hero-total"><span>Total billed</span><strong>£1,248.60</strong><small>Your estimated responsibility: £930.00</small></section><section className="canvas-card"><h3>In plain English</h3><p>This bill covers your hospital visit, imaging and specialist review. Most of the amount is linked to imaging services.</p></section><section className="canvas-card flag-card"><div className="card-title"><Flag/><h3>Worth checking</h3></div><p>A £185 facility fee appears separately from the imaging charge. Ask whether this is expected or duplicated.</p></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card"><h3>Charge breakdown</h3><div className="charge-row"><span>Hospital consultation</span><b>£133.60</b></div><div className="charge-row"><span>MRI imaging</span><b>£780.00</b></div><div className="charge-row flagged"><span>Facility fee <em>Check</em></span><b>£185.00</b></div><div className="charge-row"><span>Specialist review</span><b>£150.00</b></div></section></div>;return <Actions items={["Ask whether the facility fee is separate from the MRI charge","Compare this bill with your insurance EOB","Prepare a short billing-team question list"]}/>}
function RadiologyCanvas({tab}:{tab:CanvasTab}){if(tab==="summary")return <div className="canvas-content"><section className="radiology-hero"><div className="spine-visual"><span>L1</span><span>L2</span><span>L3</span><span className="focus">L4</span><span className="focus">L5</span><span>S1</span></div><div><span className="result-label">MAIN FINDING</span><h3>Mild changes at L4–L5</h3><p>The report describes age/wear-related changes. It does not describe severe central canal narrowing.</p></div></section><section className="canvas-card reassuring"><div className="card-title"><CheckCircle2/><h3>Reassuring language</h3></div><p>“No significant spinal canal stenosis” means the report does not describe severe narrowing of the main spinal canal.</p></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card finding-card"><span className="finding-tag">L4–L5</span><h3>Disc desiccation and mild bulge</h3><p>The disc shows some loss of water content and a small outward bulge. Clariti highlights the exact report wording alongside this plain-English explanation.</p></section><section className="canvas-card"><h3>Other levels</h3><div className="finding-row"><span>L1–L4</span><b>No significant abnormality described</b></div><div className="finding-row"><span>L5–S1</span><b>Mild degenerative change</b></div></section></div>;return <Actions items={["Ask your clinician how these findings relate to your symptoms","Ask whether physiotherapy or activity changes are appropriate","Save a concise question list for your follow-up"]}/>}
function EobCanvas({tab}:{tab:CanvasTab}){if(tab==="summary")return <div className="canvas-content"><section className="eob-flow"><div><span>Provider billed</span><strong>£1,248.60</strong></div><b>→</b><div><span>Insurer allowed</span><strong>£1,080.00</strong></div><b>→</b><div className="accent"><span>Your responsibility</span><strong>£320.00</strong></div></section><section className="canvas-card"><h3>Important</h3><p>An Explanation of Benefits explains how a claim was processed. It is not necessarily a request for payment.</p></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card"><h3>Claim breakdown</h3><div className="charge-row"><span>Amount billed</span><b>£1,248.60</b></div><div className="charge-row"><span>Plan discount</span><b>−£168.60</b></div><div className="charge-row"><span>Insurance paid</span><b>−£760.00</b></div><div className="charge-row flagged"><span>Patient responsibility</span><b>£320.00</b></div></section></div>;return <Actions items={["Wait for or compare the provider’s actual bill","Check why £320 was assigned to you","Ask Clariti to prepare questions for your insurer"]}/>}
function Actions({items}:{items:string[]}){return <div className="canvas-content"><section className="canvas-card"><h3>Suggested next steps</h3><ol className="action-list">{items.map((item,i)=><li key={item}><span>{i+1}</span><p><b>{item}</b><small>Clariti can help you turn this into a concise question or checklist.</small></p></li>)}</ol><button className="canvas-primary">Create question list</button></section></div>}
