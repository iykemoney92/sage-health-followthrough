"use client";

import Link from "next/link";
import { ArrowUp, FileText, Image as ImageIcon, Paperclip, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ClaritiShell } from "@/components/clariti-shell";

const starters = [
  { title: "Explain a medical bill", meta: "Charges, flags and what to ask next" },
  { title: "Understand a radiology report", meta: "Findings, anatomy and clinician questions" },
  { title: "Decode an insurance EOB", meta: "What was billed, covered and left to you" },
];

export default function Home() {
  const [attached,setAttached]=useState(false);

  return (
    <ClaritiShell>
      <section className="clariti-entry-page" data-ui-version="clariti-preview-latest">
        <div className="clariti-entry-inner">
          <div className="clariti-entry-mark">C</div>
          <h1>What can I help you understand?</h1>
          <p className="clariti-entry-sub">Ask a question or add a health document. Clariti turns confusing information into a clear, visual workspace you can act on.</p>

          <div className="clariti-entry-composer">
            {attached&&<div className="entry-attachment"><FileText/><span><b>health-document.pdf</b><small>Ready to analyse · Demo file</small></span><button onClick={()=>setAttached(false)}>Remove</button></div>}
            <textarea aria-label="Ask Clariti" placeholder="Ask Clariti anything about a health document…" />
            <div className="entry-composer-footer">
              <div className="entry-tools">
                <button type="button" onClick={()=>setAttached(true)}><Paperclip/> Add document</button>
                <button type="button" onClick={()=>setAttached(true)}><ImageIcon/> Add image</button>
              </div>
              <Link href="/workspace" className="clariti-entry-send" aria-label="Send to Clariti"><ArrowUp/></Link>
            </div>
          </div>

          <div className="clariti-entry-starters">
            {starters.map((starter)=><Link href="/workspace" key={starter.title}><FileText/><span><b>{starter.title}</b><small>{starter.meta}</small></span></Link>)}
          </div>

          <div className="clariti-entry-trust"><ShieldCheck/><span>Your documents stay private and under your control. Clariti explains and organises information; it does not diagnose.</span></div>
        </div>
      </section>
    </ClaritiShell>
  );
}