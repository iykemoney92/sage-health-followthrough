"use client";

import Link from "next/link";
import { ArrowRight, Check, Download, Moon, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PrototypeAction } from "@/components/prototype-action";

const confetti = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 96}%`,
  delay: `${(i % 7) * 0.11}s`,
  rotate: `${(i * 47) % 180}deg`,
}));

export default function CompletedPlanPage() {
  return (
    <AppShell active="My Plans">
      <section className="app-width app-main completion-page">
        <section className="panel completion-hero">
          <div className="calm-confetti" aria-hidden="true">
            {confetti.map((piece, i) => <i key={i} style={{ left: piece.left, animationDelay: piece.delay, transform: `rotate(${piece.rotate})` }} />)}
          </div>
          <div className="completion-check"><Check /></div>
          <div className="page-eyebrow">PLAN COMPLETE</div>
          <h1>You completed<br/><span>Stabilise My Week.</span></h1>
          <p>Seven days. One step at a time. You kept showing up, adjusted when life got busy, and finished your first Sage journey.</p>
          <div className="completion-stats">
            <div><b>86%</b><span>follow-through</span></div>
            <div><b>8</b><span>check-ins completed</span></div>
            <div><b>6 / 7</b><span>days you showed up</span></div>
          </div>
        </section>

        <div className="completion-grid">
          <section className="panel completion-insights">
            <div className="panel-label">WHAT SAGE NOTICED</div>
            <h2>Your week had a pattern.</h2>
            <div className="insight-list">
              <div><i><Moon/></i><p><b>Evenings worked better.</b><span>You completed more check-ins after 7 PM than in the morning.</span></p></div>
              <div><i><TrendingUp/></i><p><b>Short actions were easier to keep.</b><span>Your 10–15 minute activities had the strongest follow-through.</span></p></div>
              <div><i><Sparkles/></i><p><b>Your sleep routine became steadier.</b><span>By Day 4, your wind-down check-ins were more consistent.</span></p></div>
            </div>
            <PrototypeAction className="app-btn outline" label={<><Download/> View full summary</>} title="Your plan summary" description="This frontend state represents the weekly summary Sage would generate from completed check-ins and plan context." />
          </section>

          <section className="panel next-plan-card">
            <div className="panel-label">RECOMMENDED BY SAGE</div>
            <span className="next-plan-icon"><Moon/></span>
            <h2>Build Better Sleep</h2>
            <p className="muted">A gentle 14-day follow-on plan that builds on what worked this week.</p>
            <div className="why-next"><b>Why this next?</b><p>Your sleep showed the clearest improvement, but consistency is still developing. Sage recommends strengthening that rhythm before adding more.</p></div>
            <Link href="/onboarding/help" className="app-btn primary">Start this plan <ArrowRight/></Link>
            <PrototypeAction className="app-btn outline" label="Talk to Sage first" title="Talk to Sage before starting" description="In the live product, Sage would discuss whether this recommendation fits your priorities before creating the next plan." />
            <Link href="/today" className="text-link completion-not-now">Not now — go to Today</Link>
          </section>
        </div>

        <section className="panel completion-footer-card">
          <div><div className="panel-label">YOUR COMPLETED PLAN</div><h3>Stabilise My Week</h3><p className="muted">Completed 29 July 2026 · Saved to your plan history</p></div>
          <div className="completion-footer-actions"><Link href="/my-plans/stabilise-my-week" className="app-btn outline">View journey</Link><PrototypeAction className="app-btn outline" label={<><RotateCcw/> Repeat later</>} title="Repeat this plan later" description="This would create a fresh copy of the plan when the user is ready." /></div>
        </section>
      </section>
    </AppShell>
  );
}
