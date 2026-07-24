"use client";

import Link from "next/link";
import { ArrowUp, FileText, Mic, MessageCircle, Paperclip, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NuraShell } from "@/components/nura-shell";

const starters = [
  "I went to my GP today and need to monitor symptoms.",
  "My therapist asked me to notice anxiety triggers.",
  "I started a new medication and need help following instructions.",
] as const;

export default function Home() {
  const [message, setMessage] = useState("");
  const [attached, setAttached] = useState(false);

  return (
    <NuraShell>
      <section className="nura-entry-page">
        <div className="nura-entry-inner">
          <p className="nura-kicker">TODAY</p>
          <h1>What happened in your health today?</h1>
          <p className="nura-entry-sub">
            Tell Nura naturally, add a note, or start a voice check-in. Nura organises the context
            into living Plans and follows up when it matters.
          </p>

          <div className="nura-composer">
            {attached && (
              <div className="nura-attachment">
                <FileText />
                <span>
                  <b>demo-gp-note.pdf</b>
                  <small>Ready to extract instructions</small>
                </span>
                <button type="button" onClick={() => setAttached(false)}>Remove</button>
              </div>
            )}
            <textarea
              aria-label="Message Nura"
              placeholder="Message Nura about symptoms, routines, appointments, medication instructions, stress, sleep, or recovery..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="nura-composer-footer">
              <div className="nura-tools">
                <button type="button" onClick={() => setAttached(true)}><Paperclip /> Add note</button>
                <button type="button"><Mic /> Voice</button>
              </div>
              <Link href="/workspace" className="nura-send" aria-label="Create plan"><ArrowUp /></Link>
            </div>
          </div>

          <div className="nura-starters" aria-label="Quick starts">
            {starters.map((starter) => (
              <button type="button" key={starter} onClick={() => setMessage(starter)}>
                <MessageCircle />
                <span>{starter}</span>
              </button>
            ))}
          </div>

          <div className="nura-trust">
            <ShieldCheck />
            <span>Nura organises and follows through. It does not diagnose, prescribe, or replace professional care.</span>
          </div>
        </div>
      </section>
    </NuraShell>
  );
}
