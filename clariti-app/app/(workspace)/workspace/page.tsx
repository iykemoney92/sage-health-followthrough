"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Flag, MoreHorizontal, Paperclip, Plus, Send, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

const sessions = [
  { id:"bill", title:"Medical bill", meta:"City Hospital · 23 Jul", tag:"Bill" },
  { id:"radiology", title:"Radiology report", meta:"MRI lumbar spine", tag:"Report" },
  { id:"eob", title:"Insurance EOB", meta:"BlueCross · Claim 8472", tag:"EOB" },
];

export default function WorkspacePage() {
  const [active,setActive]=useState("bill");
  const [canvasTab,setCanvasTab]=useState<"summary"|"charges"|"actions">("summary");
  const session=sessions.find(s=>s.id===active)!;

  return (
    <main className="clariti-workspace">
      <aside className="clariti-left-panel">
        <div className="workspace-brand-row"><Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link><button><Plus/></button></div>
        <div className="conversation-label">RECENT</div>
        <nav className="clariti-conversations">{sessions.map(item=><button key={item.id} className={active===item.id?"active":""} onClick={()=>setActive(item.id)}><span className="file-icon"><FileText/></span><span><b>{item.title}</b><small>{item.meta}</small></span><MoreHorizontal/></button>)}</nav>
        <div className="left-panel-note"><ShieldCheck/><p>Your documents stay private and under your control.</p></div>
      </aside>

      <section className="clariti-chat-panel">
        <header className="workspace-chat-header"><div><Link href="/" className="back-link"><ArrowLeft/> Back</Link><h1>{session.title}</h1><p>{session.meta}</p></div><span className="doc-chip">{session.tag}</span></header>
        <div className="clariti-chat-scroll">
          <div className="clariti-date-chip">Today</div>
          <div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>hospital-bill-july.pdf</b><small>2 pages · 384 KB</small></span></span><p>Can you explain this bill and tell me if anything looks unusual?</p></div>
          <div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>I’ve gone through the bill. The total is <b>£1,248.60</b>, but the most important thing is that <b>£930.00 appears to be your responsibility</b>.</p><p>I’ve broken down what each charge means on the right, and flagged one item that may be worth asking the billing team about.</p><div className="clariti-inline-note"><Flag/> One charge may need clarification</div></div></div>
          <div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>Would you like me to help you prepare questions for the hospital billing team?</p><div className="clariti-quick-actions"><button>Yes, prepare questions</button><button>Explain the flagged charge</button></div></div></div>
        </div>
        <div className="clariti-workspace-composer"><button aria-label="Attach"><Paperclip/></button><input placeholder="Ask a follow-up question…"/><button className="send"><Send/></button></div>
      </section>

      <aside className="clariti-canvas">
        <header><div><p className="canvas-kicker">DOCUMENT EXPLAINER</p><h2>Your bill, made clearer</h2></div><Sparkles/></header>
        <div className="canvas-tabs"><button className={canvasTab==="summary"?"active":""} onClick={()=>setCanvasTab("summary")}>Summary</button><button className={canvasTab==="charges"?"active":""} onClick={()=>setCanvasTab("charges")}>Charges</button><button className={canvasTab==="actions"?"active":""} onClick={()=>setCanvasTab("actions")}>Next steps</button></div>
        {canvasTab==="summary"&&<div className="canvas-content">
          <section className="clariti-hero-total"><span>Total billed</span><strong>£1,248.60</strong><small>Your estimated responsibility: £930.00</small></section>
          <section className="canvas-card"><h3>In plain English</h3><p>This bill covers your hospital visit, imaging, and specialist review. Most of the amount is linked to imaging services.</p></section>
          <section className="canvas-card flag-card"><div className="card-title"><Flag/><h3>Worth checking</h3></div><p>A £185 “facility fee” appears separately from the imaging charge. Ask whether this is expected or duplicated.</p></section>
          <section className="canvas-card"><div className="card-title"><CheckCircle2/><h3>What looks straightforward</h3></div><p>The consultation and imaging line items match the services described elsewhere in the document.</p></section>
        </div>}
        {canvasTab==="charges"&&<div className="canvas-content"><section className="canvas-card"><h3>Charge breakdown</h3><div className="charge-row"><span>Hospital consultation</span><b>£133.60</b></div><div className="charge-row"><span>MRI imaging</span><b>£780.00</b></div><div className="charge-row flagged"><span>Facility fee <em>Check</em></span><b>£185.00</b></div><div className="charge-row"><span>Specialist review</span><b>£150.00</b></div></section></div>}
        {canvasTab==="actions"&&<div className="canvas-content"><section className="canvas-card"><h3>Suggested next steps</h3><ol className="action-list"><li><span>1</span><p><b>Ask about the facility fee</b><small>Clarify whether it is separate from the MRI charge.</small></p></li><li><span>2</span><p><b>Confirm what insurance covered</b><small>Compare this bill with your EOB before paying.</small></p></li><li><span>3</span><p><b>Save your questions</b><small>Clariti can prepare a short call or email checklist.</small></p></li></ol><button className="canvas-primary">Create question list</button></section></div>}
        <footer className="canvas-footer">Clariti explains your document; it does not make final billing, coverage, legal, or clinical determinations.</footer>
      </aside>
    </main>
  );
}
