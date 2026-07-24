"use client";

import Link from "next/link";
import {
  ArrowUp,
  FileText,
  Image as ImageIcon,
  Paperclip,
  ReceiptText,
  ScanText,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import { ClaritiShell } from "@/components/clariti-shell";

const starters = [
  {
    title: "Explain a medical bill",
    meta: "Charges, flags and what to ask next",
    prompt: "Please explain this medical bill in plain English, break down the charges, flag anything unusual, and tell me what I should ask next.",
    uploadHint: "Upload your medical bill, invoice or statement to continue.",
    Icon: ReceiptText,
  },
  {
    title: "Understand a radiology report",
    meta: "Findings, anatomy and clinician questions",
    prompt: "Please explain this radiology report in plain English, clarify the findings and anatomy mentioned, and suggest useful questions I can ask my clinician.",
    uploadHint: "Upload your radiology report, scan report or clear image to continue.",
    Icon: ScanText,
  },
  {
    title: "Decode an insurance EOB",
    meta: "What was billed, covered and left to you",
    prompt: "Please decode this insurance EOB, explain what was billed and covered, what I may owe, and flag anything I should query with the insurer or provider.",
    uploadHint: "Upload your EOB or explanation-of-benefits document to continue.",
    Icon: ShieldCheck,
  },
] as const;

export default function Home() {
  const [attached, setAttached] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const chooseStarter = (prompt: string, hint: string) => {
    setMessage(prompt);
    setUploadHint(hint);
    setAttached(false);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const addDocument = () => {
    setAttached(true);
    setUploadHint(null);
  };

  return (
    <ClaritiShell>
      <section className="clariti-entry-page" data-ui-version="clariti-preview-latest">
        <div className="clariti-entry-inner">
          <div className="clariti-entry-mark">C</div>
          <h1>What can I help you understand?</h1>
          <p className="clariti-entry-sub">
            Ask a question or add a health document. Clariti turns confusing information into a clear,
            visual workspace you can act on.
          </p>

          <div className="clariti-entry-composer">
            {attached && (
              <div className="entry-attachment">
                <FileText />
                <span>
                  <b>health-document.pdf</b>
                  <small>Ready to analyse · Demo file</small>
                </span>
                <button type="button" onClick={() => setAttached(false)}>Remove</button>
              </div>
            )}

            <textarea
              ref={composerRef}
              aria-label="Ask Clariti"
              placeholder="Ask Clariti anything about a health document…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />

            {uploadHint && !attached && (
              <button type="button" className="entry-upload-nudge" onClick={addDocument}>
                <Paperclip />
                <span>
                  <b>Next, add the relevant document</b>
                  <small>{uploadHint}</small>
                </span>
              </button>
            )}

            <div className="entry-composer-footer">
              <div className="entry-tools">
                <button type="button" onClick={addDocument}><Paperclip /> Add document</button>
                <button type="button" onClick={addDocument}><ImageIcon /> Add image</button>
              </div>
              <Link href="/workspace" className="clariti-entry-send" aria-label="Send to Clariti"><ArrowUp /></Link>
            </div>
          </div>

          <div className="clariti-entry-starters" aria-label="Quick starts">
            {starters.map(({ title, meta, prompt, uploadHint: hint, Icon }) => (
              <button type="button" key={title} onClick={() => chooseStarter(prompt, hint)}>
                <span className="entry-starter-icon"><Icon /></span>
                <span className="entry-starter-copy">
                  <b>{title}</b>
                  <small>{meta}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="clariti-entry-trust">
            <ShieldCheck />
            <span>Your documents stay private and under your control. Clariti explains and organises information; it does not diagnose.</span>
          </div>
        </div>
      </section>
    </ClaritiShell>
  );
}
