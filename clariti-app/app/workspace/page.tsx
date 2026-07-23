"use client";

import { useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, FileText, Flag, FolderOpen, History, Image as ImageIcon, Menu, MessageSquareText, MoreHorizontal, Paperclip, Phone, Plus, Send, Settings, ShieldCheck, Sparkles, Stethoscope, X } from "lucide-react";
import Link from "next/link";

const sessions = [
  { id: "bill", title: "Medical bill", meta: "City Hospital · 23 Jul", tag: "Bill" },
  { id: "radiology", title: "Radiology report", meta: "MRI lumbar spine · 22 Jul", tag: "Report" },
  { id: "eob", title: "Insurance EOB", meta: "BlueCross · Claim 8472", tag: "EOB" },
] as const;

type SessionId = (typeof sessions)[number]["id"];
type Drawer = "chats" | "documents" | "history";
type CanvasTab = "summary" | "detail" | "actions";

const artifactMeta = {
  bill: { eyebrow: "BILL INTELLIGENCE", title: "Your bill, made clearer", metric: "£930.00", label: "estimated responsibility", note: "1 charge worth checking" },
  radiology: { eyebrow: "RADIOLOGY INTELLIGENCE", title: "Your MRI, in plain English", metric: "L4–L5", label: "main finding highlighted", note: "No severe canal narrowing described" },
  eob: { eyebrow: "CLAIM INTELLIGENCE", title: "Your claim, made clearer", metric: "£320.00", label: "patient responsibility", note: "EOB is not itself a bill" },
} as const;

export default function WorkspacePage() {
  const [active, setActive] = useState<SessionId>("bill");
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("summary");
  const [sheet, setSheet] = useState<"call" | "followup" | null>(null);
  const session = sessions.find((item) => item.id === active)!;
  const artifact = artifactMeta[active];

  const selectSession = (id: SessionId) => {
    setActive(id);
    setCanvasTab("summary");
    setDrawer(null);
    setCanvasOpen(false);
  };

  return (
    <main className={`clariti-workspace ${canvasOpen ? "mobile-canvas-open" : ""}`}>
      <aside className={`clariti-left-panel ${drawer ? "mobile-drawer-open" : ""}`}>
        <div className="workspace-brand-row">
          <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
          <div className="workspace-brand-actions"><Link href="/" className="workspace-new"><Plus /></Link><button className="mobile-drawer-close" onClick={() => setDrawer(null)}><X /></button></div>
        </div>
        <div className="mobile-drawer-tabs">
          <button className={drawer === "chats" ? "active" : ""} onClick={() => setDrawer("chats")}><MessageSquareText />Chats</button>
          <button className={drawer === "documents" ? "active" : ""} onClick={() => setDrawer("documents")}><FolderOpen />Documents</button>
          <button className={drawer === "history" ? "active" : ""} onClick={() => setDrawer("history")}><History />History</button>
        </div>
        <div className="drawer-section-title">{drawer === "documents" ? "YOUR DOCUMENTS" : drawer === "history" ? "HISTORY" : "RECENT CHATS"}</div>
        <nav className="clariti-conversations">
          {sessions.map((item) => (
            <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => selectSession(item.id)}>
              <span className="file-icon"><FileText /></span>
              <span><b>{drawer === "documents" ? `${item.title} document` : item.title}</b><small>{drawer === "history" ? `Opened recently · ${item.meta}` : item.meta}</small></span>
              <MoreHorizontal />
            </button>
          ))}
        </nav>
        <div className="drawer-footer-links"><Link href="/"><Plus />New chat</Link><Link href="/settings"><Settings />Settings</Link></div>
        <div className="left-panel-note"><ShieldCheck /><p>Your documents stay private and under your control.</p></div>
      </aside>
      {drawer && <button className="mobile-drawer-backdrop" aria-label="Close" onClick={() => setDrawer(null)} />}

      <section className="clariti-chat-panel">
        <header className="workspace-chat-header">
          <div className="mobile-header-left"><button className="mobile-menu-button" onClick={() => setDrawer("chats")}><Menu /></button><div><h1>{session.title}</h1><p>{session.meta}</p></div></div>
          <button className="mobile-call-button" onClick={() => setSheet("call")}><Phone /></button>
        </header>

        <div className="clariti-chat-scroll">
          <div className="clariti-date-chip">Today</div>
          {active === "bill" && <BillChat />}
          {active === "radiology" && <RadiologyChat />}
          {active === "eob" && <EobChat />}

          <button className={`chat-artifact-card artifact-${active}`} onClick={() => setCanvasOpen(true)}>
            <span className="artifact-card-top"><span><small>{artifact.eyebrow}</small><b>{artifact.title}</b></span><Sparkles /></span>
            <span className="artifact-card-metric"><strong>{artifact.metric}</strong><small>{artifact.label}</small></span>
            <span className="artifact-card-note"><CheckCircle2 />{artifact.note}</span>
            <span className="artifact-card-cta">View full analysis <span>→</span></span>
          </button>

          <div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>I can stay with you beyond this explanation. We can talk through it or set a gentle follow-up so the next step does not get forgotten.</p><div className="clariti-quick-actions"><button onClick={() => setSheet("call")}>Discuss with AI</button><button onClick={() => setSheet("followup")}>Set a follow-up</button></div></div></div>
        </div>

        <div className="clariti-workspace-composer"><button><Paperclip /></button><input placeholder="Ask a follow-up question…" readOnly /><button className="send"><Send /></button></div>
      </section>

      <aside className={`clariti-canvas canvas-${active}`}>
        <div className="mobile-canvas-bar"><button onClick={() => setCanvasOpen(false)}><ArrowLeft />Back</button><span>Generated insight</span><button onClick={() => setCanvasOpen(false)}><X /></button></div>
        <header><div><p className="canvas-kicker">{artifact.eyebrow}</p><h2>{artifact.title}</h2></div>{active === "radiology" ? <ImageIcon /> : <Sparkles />}</header>
        <div className="canvas-tabs"><button className={canvasTab === "summary" ? "active" : ""} onClick={() => setCanvasTab("summary")}>Summary</button><button className={canvasTab === "detail" ? "active" : ""} onClick={() => setCanvasTab("detail")}>{active === "bill" ? "Charges" : active === "radiology" ? "Findings" : "Claim"}</button><button className={canvasTab === "actions" ? "active" : ""} onClick={() => setCanvasTab("actions")}>Next steps</button></div>
        {active === "bill" && <BillCanvas tab={canvasTab} />}
        {active === "radiology" && <RadiologyCanvas tab={canvasTab} />}
        {active === "eob" && <EobCanvas tab={canvasTab} />}
        <section className="canvas-continuity"><div><p className="canvas-kicker">CONTINUE WITH CLARITI</p><h3>Don’t stop at understanding.</h3><p>Talk this through or let Clariti check back when it matters.</p></div><div className="continuity-actions"><button onClick={() => setSheet("call")}><Phone />Discuss with AI</button><button onClick={() => setSheet("followup")}><Bell />Set a follow-up</button></div></section>
        <footer className="canvas-footer">Prototype UI only. Clariti explains and organises information; it does not diagnose or replace a healthcare professional.</footer>
      </aside>

      <nav className="clariti-mobile-dock"><button onClick={() => setDrawer("chats")}><MessageSquareText /><span>Chats</span></button><button onClick={() => setDrawer("documents")}><FolderOpen /><span>Documents</span></button><Link href="/"><Plus /><span>New</span></Link><button onClick={() => setDrawer("history")}><History /><span>History</span></button></nav>

      {sheet && <div className="clariti-modal-backdrop" onMouseDown={() => setSheet(null)}><div className="clariti-modal prototype-sheet" onMouseDown={(e) => e.stopPropagation()}><button className="sheet-close" onClick={() => setSheet(null)}><X /></button>{sheet === "call" ? <><span className="modal-icon"><Phone /></span><p className="canvas-kicker">DISCUSS THIS DOCUMENT</p><h2>Talk through this {session.tag.toLowerCase()}</h2><p>Prototype options for a contextual AI conversation about this document.</p><div className="prototype-option-list"><button><Phone /><span><b>Start AI voice call</b><small>Talk through the current document and insights.</small></span></button><button><Bell /><span><b>Schedule for later</b><small>Choose a convenient time in the future.</small></span></button></div></> : <><span className="modal-icon"><Bell /></span><p className="canvas-kicker">PROACTIVE FOLLOW-UP</p><h2>Stay on top of this</h2><p>Prototype follow-up choices that make Clariti feel proactive after the document is explained.</p><div className="prototype-option-list"><button><Bell /><span><b>Browser reminder</b><small>Get a gentle reminder about the next step.</small></span></button><button><Phone /><span><b>AI check-in call</b><small>Have Clariti call back with this document as context.</small></span></button></div></>}</div></div>}
    </main>
  );
}

function BillChat(){return <><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>hospital-bill-july.pdf</b><small>2 pages · 384 KB</small></span></span><p>Can you explain this bill and tell me if anything looks unusual?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>I’ve gone through the bill. The total is <b>£1,248.60</b>, and <b>£930.00 appears to be your responsibility</b>.</p><p>I’ve structured the important charges, flags and next steps for you.</p><div className="clariti-inline-note"><Flag/> One charge may need clarification</div></div></div></>}
function RadiologyChat(){return <><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>MRI-lumbar-spine-report.pdf</b><small>Radiology report · 3 pages</small></span></span><p>Can you explain what this MRI report means in plain English?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>The report describes <b>mild degenerative changes in your lower back</b>, most noticeable at L4–L5.</p><p>I’ve turned the findings into a visual report with anatomy, reassuring language and clinician questions.</p><div className="clariti-inline-note radiology-note"><Stethoscope/> Explanation only — not a diagnosis</div></div></div></>}
function EobChat(){return <><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>insurance-eob-8472.pdf</b><small>Explanation of Benefits · 4 pages</small></span></span><p>What did insurance actually pay, and do I owe the rest?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>This EOB shows what was <b>billed, allowed, paid by your insurer, and assigned to you</b>. An EOB is not itself a bill.</p><p>I’ve mapped the claim flow and what may need your attention.</p></div></div></>}

function BillCanvas({tab}:{tab:CanvasTab}){if(tab==="summary")return <div className="canvas-content"><section className="clariti-hero-total"><span>Total billed</span><strong>£1,248.60</strong><small>Your estimated responsibility: £930.00</small></section><section className="canvas-card"><h3>In plain English</h3><p>This bill covers your hospital visit, imaging and specialist review. Most of the amount is linked to imaging services.</p></section><section className="canvas-card flag-card"><div className="card-title"><Flag/><h3>Worth checking</h3></div><p>A £185 facility fee appears separately from the imaging charge.</p></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card"><h3>Charge breakdown</h3><div className="charge-row"><span>Hospital consultation</span><b>£133.60</b></div><div className="charge-row"><span>MRI imaging</span><b>£780.00</b></div><div className="charge-row flagged"><span>Facility fee <em>Check</em></span><b>£185.00</b></div><div className="charge-row"><span>Specialist review</span><b>£150.00</b></div></section></div>;return <Actions items={["Ask whether the facility fee is separate from the MRI charge","Compare this bill with your insurance EOB","Prepare billing-team questions"]}/>}
function RadiologyCanvas({tab}:{tab:CanvasTab}){if(tab==="summary")return <div className="canvas-content"><section className="radiology-hero"><div className="spine-visual"><span>L1</span><span>L2</span><span>L3</span><span className="focus">L4</span><span className="focus">L5</span><span>S1</span></div><div><span className="result-label">MAIN FINDING</span><h3>Mild changes at L4–L5</h3><p>The report describes age/wear-related changes and no severe central canal narrowing.</p></div></section><section className="canvas-card reassuring"><div className="card-title"><CheckCircle2/><h3>Reassuring language</h3></div><p>“No significant spinal canal stenosis” means the report does not describe severe narrowing of the main spinal canal.</p></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card finding-card"><span className="finding-tag">L4–L5</span><h3>Disc desiccation and mild bulge</h3><p>The disc shows some loss of water content and a small outward bulge.</p></section><section className="canvas-card"><h3>Other levels</h3><div className="finding-row"><span>L1–L4</span><b>No significant abnormality described</b></div><div className="finding-row"><span>L5–S1</span><b>Mild degenerative change</b></div></section></div>;return <Actions items={["Ask how these findings relate to your symptoms","Ask whether physiotherapy may be appropriate","Save questions for your follow-up"]}/>}
function EobCanvas({tab}:{tab:CanvasTab}){if(tab==="summary")return <div className="canvas-content"><section className="eob-flow"><div><span>Provider billed</span><strong>£1,248.60</strong></div><b>→</b><div><span>Insurer allowed</span><strong>£1,080.00</strong></div><b>→</b><div className="accent"><span>Your responsibility</span><strong>£320.00</strong></div></section><section className="canvas-card"><h3>Important</h3><p>An Explanation of Benefits explains how a claim was processed. It is not necessarily a request for payment.</p></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card"><h3>Claim breakdown</h3><div className="charge-row"><span>Amount billed</span><b>£1,248.60</b></div><div className="charge-row"><span>Plan discount</span><b>−£168.60</b></div><div className="charge-row"><span>Insurance paid</span><b>−£760.00</b></div><div className="charge-row flagged"><span>Patient responsibility</span><b>£320.00</b></div></section></div>;return <Actions items={["Compare the provider’s actual bill","Check why £320 was assigned to you","Prepare questions for your insurer"]}/>}
function Actions({items}:{items:string[]}){return <div className="canvas-content"><section className="canvas-card"><h3>Suggested next steps</h3><ol className="action-list">{items.map((item,i)=><li key={item}><span>{i+1}</span><p><b>{item}</b><small>Clariti can turn this into a concise checklist.</small></p></li>)}</ol><button className="canvas-primary">Create question list</button></section></div>}
