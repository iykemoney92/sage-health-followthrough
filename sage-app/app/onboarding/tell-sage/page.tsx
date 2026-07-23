"use client";

import { useState } from "react";
import { Mic, Paperclip, MessageCircle } from "lucide-react";
import { GentleAside, OnboardingShell, PrivacyNote } from "../components";
import { PrototypeAction } from "@/components/prototype-action";

export default function TellSagePage() {
  const examples = [
    "I’m barely sleeping and work has been exhausting.",
    "My GP told me I should start walking every day, but I keep forgetting.",
    "I have medication to take regularly and I’m struggling with the routine.",
  ];
  const [text,setText]=useState("");
  return <OnboardingShell active={3} backHref="/onboarding/help" nextHref="/onboarding/connect-whatsapp" aside={<GentleAside />}><div className="ob-kicker">STEP 3 OF 6</div><h1 className="ob-title">Tell Sage what’s going on</h1><p className="ob-subtitle">Share in your own words. The more Sage understands, the better your plan and check-ins will be.</p><div className="ob-textarea"><textarea value={text} maxLength={1500} onChange={e=>setText(e.target.value)} placeholder="I’ve been feeling overwhelmed lately…"/><span className="ob-count">{text.length} / 1500</span></div><div className="ob-tools"><PrototypeAction className="ob-tool" label={<><Mic size={15}/> Speak instead</>} title="Speak to Sage" description="Voice capture preview for onboarding. The live microphone and transcription service will be connected during integration."/><PrototypeAction className="ob-tool" label={<><Paperclip size={15}/> Attach something</>} title="Attach context" description="Choose a document, screenshot or note to give Sage more context in the integrated build."/></div><div className="ob-examples"><h4>Examples</h4>{examples.map(example=><button type="button" className="ob-example" key={example} onClick={()=>setText(example)}><MessageCircle size={15}/><span>“{example}”</span></button>)}</div><PrivacyNote>Your words are private. Sage only uses this to create your plan and support you.</PrivacyNote></OnboardingShell>;
}