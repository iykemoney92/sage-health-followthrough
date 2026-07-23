"use client";

import { useState } from "react";
import { Activity, BriefcaseBusiness, HeartPulse, Moon, Pill, Sparkles } from "lucide-react";
import { OnboardingShell } from "../components";

export default function HelpPage() {
  const choices = [
    [Sparkles, "Stress & overwhelm", "When everything feels like too much"],
    [Moon, "Sleep & energy", "Build a steadier rhythm"],
    [HeartPulse, "Health follow-through", "Keep up with advice and routines"],
    [Pill, "Medication routines", "Remember and stay consistent"],
    [BriefcaseBusiness, "Work & burnout", "Make work feel more manageable"],
    [Activity, "General wellbeing", "Create healthier day-to-day habits"],
  ] as const;
  const [selected,setSelected]=useState<string[]>(["Stress & overwhelm","Health follow-through"]);
  const toggle=(title:string)=>setSelected(current=>current.includes(title)?current.filter(x=>x!==title):[...current,title]);
  return <OnboardingShell active={2} backHref="/onboarding/welcome" nextHref="/onboarding/tell-sage"><div className="ob-kicker">STEP 2 OF 6</div><h1 className="ob-title">What would you like<br/>Sage to help with?</h1><p className="ob-subtitle">Choose what feels most relevant right now. You can select more than one and change this later.</p><div className="ob-help-grid">{choices.map(([Icon,title,desc])=><button aria-pressed={selected.includes(title)} className={`ob-choice ${selected.includes(title)?"selected":""}`} key={title} type="button" onClick={()=>toggle(title)}><i><Icon size={21}/></i><div><b>{title}</b><span>{desc}</span></div></button>)}</div><div className="ob-help-note">Sage uses this to shape your first plan. It does not diagnose a condition or replace professional care.</div></OnboardingShell>;
}