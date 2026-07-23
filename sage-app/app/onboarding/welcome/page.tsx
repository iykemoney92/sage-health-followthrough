import { CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react";
import { OnboardingShell, SageMark } from "../components";

export default function WelcomePage() {
  return (
    <OnboardingShell active={1} nextHref="/onboarding/help" nextLabel="Get started">
      <div className="ob-welcome-grid">
        <div className="ob-welcome-copy">
          <div className="ob-kicker">STEP 1 OF 6</div>
          <h1 className="ob-title">Welcome to Sage.</h1>
          <p className="ob-subtitle">Let’s personalize your experience so Sage can turn what you’re carrying into a clear plan and support you one step at a time.</p>
          <div className="ob-feature-list">
            <div className="ob-feature"><i><MessageCircle size={18}/></i><div><b>Talk naturally</b><span>Share what’s going on in your own words.</span></div></div>
            <div className="ob-feature"><i><CalendarCheck size={18}/></i><div><b>Get a plan that fits</b><span>Sage turns your context into manageable steps and check-ins.</span></div></div>
            <div className="ob-feature"><i><ShieldCheck size={18}/></i><div><b>You stay in control</b><span>Your context, memory and check-ins remain transparent and editable.</span></div></div>
          </div>
        </div>
        <div className="ob-welcome-art">
          <div className="ob-welcome-ring"><SageMark /></div>
        </div>
      </div>
    </OnboardingShell>
  );
}
