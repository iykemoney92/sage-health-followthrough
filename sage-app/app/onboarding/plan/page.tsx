import Link from "next/link";
import { CalendarClock, ListChecks, Target } from "lucide-react";
import { OnboardingShell, SageMark } from "../components";

export default function PlanGeneratingPage() {
  return (
    <OnboardingShell active={5} backHref="/onboarding/connect-whatsapp" hideNext>
      <div className="ob-plan-creating-screen">
        <div className="ob-kicker">STEP 5 OF 6</div>
        <h1 className="ob-title">Sage is creating<br/>your plan ✨</h1>
        <p className="ob-subtitle">Thanks for sharing so much with me. I’m putting everything together into a personalized plan just for you.</p>

        <div className="ob-loader-stage" aria-label="Sage is creating your plan">
          <div className="ob-callout top">Understanding your situation</div>
          <div className="ob-callout left"><Target size={13}/> Identifying what matters most</div>

          <div className="ob-pulse-loader" aria-hidden="true">
            <span className="ob-pulse-wave wave-one" />
            <span className="ob-pulse-wave wave-two" />
            <span className="ob-pulse-wave wave-three" />
            <span className="ob-pulse-orbit" />
            <span className="ob-pulse-core"><SageMark /></span>
          </div>

          <div className="ob-callout right"><ListChecks size={13}/> Designing your 7-day journey</div>
          <div className="ob-callout bottom"><CalendarClock size={13}/> Selecting the right check-ins</div>
        </div>

        <div className="ob-loader-note">♡ <b>This may take up to 30 seconds</b><br/>Please stay on this page. We’ll let you know as soon as your plan is ready.</div>
        <div className="ob-preview-link"><Link href="/onboarding/plan-ready">Preview completed state →</Link></div>
      </div>
    </OnboardingShell>
  );
}
