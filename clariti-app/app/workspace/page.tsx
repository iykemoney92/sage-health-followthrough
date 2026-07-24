"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, FileDown, FileText, Flag, FolderOpen, History, Image as ImageIcon, Menu, MessageSquareText, MoreHorizontal, Paperclip, Phone, Play, Plus, Send, Settings, ShieldCheck, Sparkles, Stethoscope, X } from "lucide-react";
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
  const [toast, setToast] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = sessions.find((item) => item.id === active)!;
  const artifact = artifactMeta[active];

  useEffect(() => {
    const scrollArea = chatScrollRef.current;
    if (!scrollArea) return;

    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [active]);

  const selectSession = (id: SessionId) => {
    setActive(id);
    setCanvasTab("summary");
    setDrawer(null);
    setCanvasOpen(false);
  };

  const showPrototypeToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  };

  const openSheet = (nextSheet: "call" | "followup") => {
    setToast(null);
    setSheet(nextSheet);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheet]);

  return (
    <main className={`clariti-workspace ${canvasOpen ? "mobile-canvas-open" : ""}`}>
      <aside className={`clariti-left-panel ${drawer ? "mobile-drawer-open" : ""}`}>
        <div className="workspace-brand-row">
          <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
          <div className="workspace-brand-actions"><Link href="/" className="workspace-new"><Plus /></Link><button type="button" className="mobile-drawer-close" onClick={() => setDrawer(null)} aria-label="Close menu"><X /></button></div>
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
          <div className="mobile-header-left"><button type="button" className="mobile-menu-button" onClick={() => setDrawer("chats")} aria-label="Open menu"><Menu /></button><div><h1>{session.title}</h1><p>{session.meta}</p></div></div>
          <button type="button" className="mobile-call-button" onClick={() => openSheet("call")} aria-label="Discuss with AI"><Phone /></button>
        </header>

        <div className="clariti-chat-scroll" ref={chatScrollRef}>
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

          <div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>I can stay with you beyond this explanation. We can talk through it or set a gentle follow-up so the next step does not get forgotten.</p><div className="clariti-quick-actions"><button onClick={() => openSheet("call")}>Discuss with AI</button><button onClick={() => openSheet("followup")}>Set a follow-up</button></div></div></div>
        </div>

        <div className="clariti-workspace-composer">
          <button type="button" aria-label="Attach document" onClick={() => showPrototypeToast("Upload flow mocked for the UI prototype.")}><Paperclip /></button>
          <input placeholder="Ask a follow-up question…" readOnly />
          <button type="button" className="send" aria-label="Send message" onClick={() => showPrototypeToast("Message composer is UI-only for now.")}><Send /></button>
        </div>
      </section>

      <aside className={`clariti-canvas canvas-${active}`}>
        <div className="mobile-canvas-bar"><button type="button" onClick={() => setCanvasOpen(false)}><ArrowLeft />Back</button><span>Generated insight</span><button type="button" onClick={() => setCanvasOpen(false)} aria-label="Close insight"><X /></button></div>
        <header><div><p className="canvas-kicker">{artifact.eyebrow}</p><h2>{artifact.title}</h2></div>{active === "radiology" ? <ImageIcon /> : <Sparkles />}</header>
        <div className="canvas-tabs"><button className={canvasTab === "summary" ? "active" : ""} onClick={() => setCanvasTab("summary")}>Summary</button><button className={canvasTab === "detail" ? "active" : ""} onClick={() => setCanvasTab("detail")}>{active === "bill" ? "Charges" : active === "radiology" ? "Findings" : "Claim"}</button><button className={canvasTab === "actions" ? "active" : ""} onClick={() => setCanvasTab("actions")}>Next steps</button></div>
        {active === "bill" && <BillCanvas tab={canvasTab} onPrototypeAction={showPrototypeToast} />}
        {active === "radiology" && <RadiologyCanvas tab={canvasTab} onPrototypeAction={showPrototypeToast} />}
        {active === "eob" && <EobCanvas tab={canvasTab} onPrototypeAction={showPrototypeToast} />}
        <section className="canvas-continuity"><div><p className="canvas-kicker">CONTINUE WITH CLARITI</p><h3>Don’t stop at understanding.</h3><p>Talk this through or let Clariti check back when it matters.</p></div><div className="continuity-actions"><button onClick={() => openSheet("call")}><Phone />Discuss with AI</button><button onClick={() => openSheet("followup")}><Bell />Set a follow-up</button></div></section>
        <footer className="canvas-footer">Prototype UI only. Clariti explains and organises information; it does not diagnose or replace a healthcare professional.</footer>
      </aside>

      <nav className="clariti-mobile-dock"><button onClick={() => setDrawer("chats")}><MessageSquareText /><span>Chats</span></button><button onClick={() => setDrawer("documents")}><FolderOpen /><span>Documents</span></button><Link href="/"><Plus /><span>New</span></Link><button onClick={() => setDrawer("history")}><History /><span>History</span></button></nav>

      {toast && <div className="clariti-ui-toast" role="status">{toast}</div>}

      {sheet && <div className="clariti-modal-backdrop" onMouseDown={() => setSheet(null)}><div className="clariti-modal prototype-sheet" onMouseDown={(e) => e.stopPropagation()}><button type="button" className="sheet-close" onClick={() => setSheet(null)} aria-label="Close options"><X /></button>{sheet === "call" ? <><span className="modal-icon"><Phone /></span><p className="canvas-kicker">DISCUSS THIS DOCUMENT</p><h2>Talk through this {session.tag.toLowerCase()}</h2><p>Prototype options for a contextual AI conversation about this document.</p><div className="prototype-option-list"><button type="button" onClick={() => { setSheet(null); showPrototypeToast("Voice call flow mocked for the UI prototype."); }}><Phone /><span><b>Start AI voice call</b><small>Talk through the current document and insights.</small></span></button><button type="button" onClick={() => { setSheet(null); showPrototypeToast("Scheduling flow mocked for the UI prototype."); }}><Bell /><span><b>Schedule for later</b><small>Choose a convenient time in the future.</small></span></button></div></> : <><span className="modal-icon"><Bell /></span><p className="canvas-kicker">PROACTIVE FOLLOW-UP</p><h2>Stay on top of this</h2><p>Prototype follow-up choices that make Clariti feel proactive after the document is explained.</p><div className="prototype-option-list"><button type="button" onClick={() => { setSheet(null); showPrototypeToast("Reminder flow mocked for the UI prototype."); }}><Bell /><span><b>Browser reminder</b><small>Get a gentle reminder about the next step.</small></span></button><button type="button" onClick={() => { setSheet(null); showPrototypeToast("AI check-in flow mocked for the UI prototype."); }}><Phone /><span><b>AI check-in call</b><small>Have Clariti call back with this document as context.</small></span></button></div></>}</div></div>}
    </main>
  );
}

function BillChat(){return <><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>hospital-bill-july.pdf</b><small>2 pages · 384 KB</small></span></span><p>Can you explain this bill and tell me if anything looks unusual?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>I’ve gone through the bill. The total is <b>£1,248.60</b>, and <b>£930.00 appears to be your responsibility</b>.</p><p>I’ve structured the important charges, flags and next steps for you.</p><div className="clariti-inline-note"><Flag/> One charge may need clarification</div></div></div></>}
function RadiologyChat(){return <><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>MRI-lumbar-spine-report.pdf</b><small>Radiology report · 3 pages</small></span></span><p>Can you explain what this MRI report means in plain English?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>The report describes <b>mild degenerative changes in your lower back</b>, most noticeable at L4–L5.</p><p>I’ve turned the findings into a visual report with anatomy, reassuring language and clinician questions.</p><div className="clariti-inline-note radiology-note"><Stethoscope/> Explanation only — not a diagnosis</div></div></div></>}
function EobChat(){return <><div className="clariti-user-message"><span className="attached-file"><FileText/><span><b>insurance-eob-8472.pdf</b><small>Explanation of Benefits · 4 pages</small></span></span><p>What did insurance actually pay, and do I owe the rest?</p></div><div className="clariti-ai-message"><span className="clariti-ai-avatar">C</span><div><p>This EOB shows what was <b>billed, allowed, paid by your insurer, and assigned to you</b>. An EOB is not itself a bill.</p><p>I’ve mapped the claim flow and what may need your attention.</p></div></div></>}

function BillCanvas({tab,onPrototypeAction}:{tab:CanvasTab;onPrototypeAction:(message:string)=>void}){if(tab==="summary")return <div className="canvas-content"><section className="clariti-hero-total"><span>Total billed</span><strong>£1,248.60</strong><small>Your estimated responsibility: £930.00</small></section><section className="canvas-card"><h3>In plain English</h3><p>This bill covers your hospital visit, imaging and specialist review. Most of the amount is linked to imaging services.</p></section><section className="canvas-card flag-card"><div className="card-title"><Flag/><h3>Worth checking</h3></div><p>A £185 facility fee appears separately from the imaging charge.</p></section><section className="canvas-card meta-card"><h3>Document Details</h3><div className="meta-row"><span>Provider</span><b>City Hospital</b></div><div className="meta-row"><span>Bill date</span><b>23 Jul 2025</b></div><div className="meta-row"><span>Account #</span><b>HC-88213</b></div><button type="button" className="meta-link-btn" onClick={() => onPrototypeAction("Original bill viewer mocked for the UI prototype.")}><FileDown/>View original bill</button></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card"><h3>Charge breakdown</h3><div className="charge-row"><span>Hospital consultation</span><b>£133.60</b></div><div className="charge-row"><span>MRI imaging</span><b>£780.00</b></div><div className="charge-row flagged"><span>Facility fee <em>Check</em></span><b>£185.00</b></div><div className="charge-row"><span>Specialist review</span><b>£150.00</b></div></section></div>;return <Actions items={["Ask whether the facility fee is separate from the MRI charge","Compare this bill with your insurance EOB","Prepare billing-team questions"]} onPrototypeAction={onPrototypeAction}/>}
function RadiologyCanvas({tab,onPrototypeAction}:{tab:CanvasTab;onPrototypeAction:(message:string)=>void}){if(tab==="summary")return <div className="canvas-content"><section className="radiology-hero"><div><span className="result-label">OVERALL IMPRESSION</span><h3>Mild L4–L5 changes. No severe narrowing described.</h3><p>The report points to common age or wear-related changes in the lower back, with no urgent severe canal narrowing called out.</p></div><span className="risk-pill">Low concern</span></section><section className="impression-stats"><div><strong>3</strong><span>Key findings</span></div><div><strong>L4–L5</strong><span>Area noted</span></div><div><strong>Low</strong><span>Concern level</span></div></section><section className="canvas-card"><h3>Key Findings</h3><ul className="key-findings-list"><li><CheckCircle2/><span><b>Mild disc bulge at L4–L5</b><small>Common with age, usually not urgent.</small></span></li><li><CheckCircle2/><span><b>No significant canal narrowing</b><small>The main spinal canal remains open.</small></span></li><li><CheckCircle2/><span><b>Other levels normal</b><small>L1–L4 and L5–S1 show no significant abnormality.</small></span></li></ul></section><section className="canvas-card video-explainer-card"><div className="video-explainer-head"><h3><Sparkles/>AI Video Explainer</h3><span className="video-duration-badge">1:48</span></div><div className="video-explainer-media report-preview"><div><span>Plain-English walkthrough</span><b>What this MRI report means</b><small>Highlights findings, reassurance, and questions for your clinician.</small></div><button type="button" className="video-play-btn" aria-label="Play video" onClick={() => onPrototypeAction("Video explainer mocked for the UI prototype.")}><Play/></button></div><div className="video-explainer-foot"><span><Sparkles/>AI generated</span><button type="button" className="video-play-cta" onClick={() => onPrototypeAction("Video explainer mocked for the UI prototype.")}><Play/>Play video</button></div><p className="video-caption">Understand your report without medical jargon</p></section><section className="canvas-card reassuring"><div className="card-title"><CheckCircle2/><h3>Reassuring language</h3></div><p>“No significant spinal canal stenosis” means the report does not describe severe narrowing of the main spinal canal.</p></section><section className="canvas-card meta-card"><h3>Report Summary</h3><div className="meta-row"><span>Exam type</span><b>MRI Lumbar Spine</b></div><div className="meta-row"><span>Date</span><b>22 Jul 2025</b></div><div className="meta-row"><span>Ordered by</span><b>Dr. Chen</b></div><div className="meta-row"><span>Facility</span><b>City Hospital Imaging</b></div><button type="button" className="meta-link-btn" onClick={() => onPrototypeAction("Original report viewer mocked for the UI prototype.")}><FileDown/>View original report</button></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card finding-card"><span className="finding-tag">L4–L5</span><h3>Disc desiccation and mild bulge</h3><p>The disc shows some loss of water content and a small outward bulge.</p></section><section className="canvas-card"><h3>Other levels</h3><div className="finding-row"><span>L1–L4</span><b>No significant abnormality described</b></div><div className="finding-row"><span>L5–S1</span><b>Mild degenerative change</b></div></section></div>;return <Actions items={["Ask how these findings relate to your symptoms","Ask whether physiotherapy may be appropriate","Save questions for your follow-up"]} onPrototypeAction={onPrototypeAction}/>}
function EobCanvas({tab,onPrototypeAction}:{tab:CanvasTab;onPrototypeAction:(message:string)=>void}){if(tab==="summary")return <div className="canvas-content"><section className="eob-flow"><div><span>Provider billed</span><strong>£1,248.60</strong></div><b>→</b><div><span>Insurer allowed</span><strong>£1,080.00</strong></div><b>→</b><div className="accent"><span>Your responsibility</span><strong>£320.00</strong></div></section><section className="canvas-card"><h3>Important</h3><p>An Explanation of Benefits explains how a claim was processed. It is not necessarily a request for payment.</p></section><section className="canvas-card meta-card"><h3>Claim Details</h3><div className="meta-row"><span>Service date</span><b>22 Jul 2025</b></div><div className="meta-row"><span>Provider</span><b>City Hospital</b></div><div className="meta-row"><span>Claim number</span><b>8472</b></div><div className="meta-row"><span>Member ID</span><b>BX-338217</b></div><div className="meta-row"><span>Plan</span><b>BlueCross PPO</b></div></section></div>;if(tab==="detail")return <div className="canvas-content"><section className="canvas-card"><h3>Claim breakdown</h3><div className="charge-row"><span>Amount billed</span><b>£1,248.60</b></div><div className="charge-row"><span>Plan discount</span><b>−£168.60</b></div><div className="charge-row"><span>Insurance paid</span><b>−£760.00</b></div><div className="charge-row flagged"><span>Patient responsibility</span><b>£320.00</b></div></section></div>;return <Actions items={["Compare the provider’s actual bill","Check why £320 was assigned to you","Prepare questions for your insurer"]} onPrototypeAction={onPrototypeAction}/>}
function Actions({items,onPrototypeAction}:{items:string[];onPrototypeAction:(message:string)=>void}){return <div className="canvas-content"><section className="canvas-card"><h3>Suggested next steps</h3><ol className="action-list">{items.map((item,i)=><li key={item}><span>{i+1}</span><p><b>{item}</b><small>Clariti can turn this into a concise checklist.</small></p></li>)}</ol><button type="button" className="canvas-primary" onClick={() => onPrototypeAction("Question list creation mocked for the UI prototype.")}>Create question list</button></section></div>}
