import { Mic, Paperclip, MessageCircle } from "lucide-react";
import { GentleAside, OnboardingShell, PrivacyNote } from "../components";

export default function TellSagePage() {
  const examples = [
    "I’m barely sleeping and work has been exhausting.",
    "My GP told me I should start walking every day, but I keep forgetting.",
    "I have medication to take regularly and I’m struggling with the routine.",
  ];
  return (
    <OnboardingShell active={3} backHref="/onboarding/help" nextHref="/onboarding/connect-whatsapp" aside={<GentleAside />}>
      <div className="ob-kicker">STEP 3 OF 6</div>
      <h1 className="ob-title">Tell Sage what’s going on</h1>
      <p className="ob-subtitle">Share in your own words. The more Sage understands, the better your plan and check-ins will be.</p>
      <div className="ob-textarea">
        <textarea placeholder="I’ve been feeling overwhelmed lately…" />
        <span className="ob-count">0 / 1500</span>
      </div>
      <div className="ob-tools">
        <button type="button" className="ob-tool"><Mic size={15}/> Speak instead</button>
        <button type="button" className="ob-tool"><Paperclip size={15}/> Attach something</button>
      </div>
      <div className="ob-examples">
        <h4>Examples</h4>
        {examples.map((text) => <div className="ob-example" key={text}><MessageCircle size={15}/><span>“{text}”</span></div>)}
      </div>
      <PrivacyNote>Your words are private. Sage only uses this to create your plan and support you.</PrivacyNote>
    </OnboardingShell>
  );
}
