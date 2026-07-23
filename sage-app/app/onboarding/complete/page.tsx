import Link from "next/link";
import { CalendarCheck, Check, MessageCircle, ShieldCheck } from "lucide-react";
import { OnboardingShell } from "../components";

export default function CompletePage() {
  return (
    <OnboardingShell active={6} backHref="/onboarding/plan-ready" hideNext>
      <div className="ob-complete">
        <div className="ob-kicker">STEP 6 OF 6</div>
        <div className="ob-complete-badge"><Check size={36}/></div>
        <h1 className="ob-title">You’re all set, Ike.</h1>
        <p>Sage has what it needs to help you follow through. Your first plan is ready, your check-ins are set, and you can change anything whenever you need to.</p>
        <div className="ob-complete-grid">
          <div className="ob-complete-card"><MessageCircle size={20}/><b>Check-ins where you are</b><span>Continue through WhatsApp with text or voice.</span></div>
          <div className="ob-complete-card"><CalendarCheck size={20}/><b>Your first plan is ready</b><span>See what’s next and take it one step at a time.</span></div>
          <div className="ob-complete-card"><ShieldCheck size={20}/><b>You stay in control</b><span>Manage your context, memory and preferences anytime.</span></div>
        </div>
        <Link className="ob-primary" href="/today" style={{minWidth:230}}>Go to Today →</Link>
      </div>
    </OnboardingShell>
  );
}
