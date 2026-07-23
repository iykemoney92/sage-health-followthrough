"use client";

import Link from "next/link";
import { Check, ChevronRight, Download, RefreshCw, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PrototypeAction } from "@/components/prototype-action";

const confetti = Array.from({ length: 22 }, (_, i) => i);

export default function CompletedPlanPage() {
  return (
    <AppShell active="My Plans">
      <section className="app-width app-main plan-complete-page">
        <div className="plan-complete-hero panel">
          <div className="confetti-field" aria-hidden="true">
            {confetti.map((i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
          </div>

          <div className="complete-badge"><Check /></div>
          <div className="page-eyebrow">PLAN COMPLETE</div>
          <h1 className="page-title">You completed<br/><span>Stabilise My Week.</span></h1>
          <p className="page-subtitle complete-copy">Seven days of small steps, check-ins and follow-through. You do not need to have done everything perfectly for this progress to count.</p>

          <div className="complete-stats">
            <div><b>7/7</b><span>days completed</span></div>
            <div><b>6</b><span>check-ins completed</span></div>
            <div><b>3</b><span>helpful patterns noticed</span></div>
          </div>
        </div>

        <div className="completion-grid">
          <section className="panel completion-summary">
            <div className="panel-label">YOUR WEEK IN REVIEW</div>
            <h2>What Sage noticed with you</h2>
            <div className="summary-points">
              <div><i><Check /></i><p><b>Sleep became more consistent</b><span>You completed three evening wind-down check-ins and identified late scrolling as a common disruption.</span></p></div>
              <div><i><Check /></i><p><b>Your medication routine stayed visible</b><span>You checked in on medication most days and preferred a simple morning reminder.</span></p></div>
              <div><i><Check /></i><p><b>Gentle movement felt realistic</b><span>Short walks worked better than ambitious goals on heavier days.</span></p></div>
            </div>
            <PrototypeAction className="app-btn outline" label={<><Download/> View full weekly summary</>} title="Weekly summary" description="In the live product this will open or export the AI-generated summary from your completed plan." />
          </section>

          <aside className="panel next-plan-card">
            <div className="next-plan-icon"><Sparkles /></div>
            <div className="panel-label">WHAT NEXT?</div>
            <h2>Keep the momentum,<br/>without starting over.</h2>
            <p>Sage can turn what worked this week into a lighter follow-on plan.</p>
            <div className="recommended-plan">
              <span className="plan-type">RECOMMENDED NEXT</span>
              <h3>Keep My Rhythm</h3>
              <p>5 days · lighter check-ins · sleep, medication and gentle movement</p>
            </div>
            <Link className="app-btn primary" href="/onboarding/help"><RefreshCw/> Create next plan <ChevronRight /></Link>
            <Link className="app-btn outline" href="/my-plans">Finish for now</Link>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
