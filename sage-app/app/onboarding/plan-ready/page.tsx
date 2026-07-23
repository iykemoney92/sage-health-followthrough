import { CalendarDays, Check, MessageCircle, Sprout } from "lucide-react";
import { OnboardingShell } from "../components";

const journey = [
  ["Start gently", "Set the tone for a manageable week.", "Completed", "complete"],
  ["Medication + mood", "Check in on your medication and how you’re feeling.", "Completed", "complete"],
  ["Sleep reset", "Look at what’s affecting your sleep.", "Completed", "complete"],
  ["10-minute walk", "Move a little, breathe a little.", "Today", "active"],
  ["Relationship reflection", "Take a moment to reflect on what matters.", "Upcoming", ""],
  ["GP note review", "Review your GP advice and what to focus on.", "Upcoming", ""],
  ["Weekly summary", "Celebrate progress and plan next steps.", "Upcoming", ""],
] as const;

export default function PlanReadyPage() {
  return (
    <OnboardingShell active={5} backHref="/onboarding/connect-whatsapp" nextHref="/onboarding/complete">
      <div className="ob-kicker">STEP 5 OF 6</div>
      <h1 className="ob-title">Your first plan is ready! 🎉</h1>
      <p className="ob-subtitle">I created a gentle 7-day plan based on what you shared. You can review it below or make changes later.</p>
      <div className="ob-plan-summary">
        <div>
          <div className="ob-plan-head"><div className="ob-plan-icon"><Sprout size={22}/></div><div><h3>Stabilise My Week</h3><span className="ob-tag">Wellbeing + Health Follow-Up</span></div></div>
          <div className="ob-plan-meta"><span><CalendarDays size={12}/> 7 days</span><span><MessageCircle size={12}/> Daily check-ins</span><span>WhatsApp</span></div>
        </div>
        <div className="ob-ring-progress"><div><b>3/7</b><br/>days</div></div>
      </div>
      <div className="ob-journey"><h4>Your plan journey</h4>{journey.map(([title,desc,status,state],index)=><div className={`ob-journey-row ${state}`} key={title}><div className="ob-journey-num">{state==="complete"?<Check size={13}/>:index+1}</div><div><b>{title}</b><p>{desc}</p></div><span className="ob-status">{status}</span></div>)}</div>
    </OnboardingShell>
  );
}
