"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, MessageCircle } from "lucide-react";
import type { JourneyMilestone } from "@/lib/domain/plan-journey";

export function PlanJourney({ planId, milestones: initialMilestones }: { planId: string; milestones: JourneyMilestone[] }) {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [startingStepId, setStartingStepId] = useState<string | null>(null);
  const [togglingStepId, setTogglingStepId] = useState<string | null>(null);
  const router = useRouter();

  async function startStep(stepId: string) {
    if (startingStepId) return;
    setStartingStepId(stepId);
    try {
      const res = await fetch(`/api/plan-steps/${stepId}/start`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        router.push(`/workspace?planId=${encodeURIComponent(planId)}`);
      }
    } finally {
      setStartingStepId(null);
    }
  }

  async function toggleStep(milestoneId: string, stepId: string) {
    if (togglingStepId) return;
    setTogglingStepId(stepId);
    try {
      const res = await fetch(`/api/plan-steps/${stepId}/complete`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;
      setMilestones((prev) =>
        prev.map((milestone) => {
          if (milestone.id !== milestoneId) return milestone;
          return {
            ...milestone,
            status: data.milestoneStatus,
            steps: milestone.steps.map((step) => (step.id === stepId ? { ...step, status: data.status } : step)),
          };
        }),
      );
    } finally {
      setTogglingStepId(null);
    }
  }

  return (
    <article className="detail-card journey-card">
      <h3>Journey</h3>
      <p className="journey-intro">A Milestone-by-Milestone path through this Thread with Nura.</p>
      <div className="journey-milestones">
        {milestones.map((milestone) => {
          const doneCount = milestone.steps.filter((s) => s.status === "done").length;
          return (
            <div key={milestone.id} className={`journey-milestone ${milestone.status}`}>
              <div className="journey-milestone-head">
                <span className={`journey-milestone-icon ${milestone.status}`}>
                  {milestone.status === "done" ? <CheckCircle2 /> : <Circle />}
                </span>
                <div>
                  <b>{milestone.title}</b>
                  {milestone.description && <small>{milestone.description}</small>}
                </div>
                <span className="journey-milestone-count">{doneCount}/{milestone.steps.length}</span>
              </div>
              <div className="journey-steps">
                {milestone.steps.map((step) => (
                  <div key={step.id} className={`journey-step-row ${step.status}`}>
                    <button
                      type="button"
                      className="journey-step-check"
                      aria-label={step.status === "done" ? "Mark step not done" : "Mark step done"}
                      onClick={() => toggleStep(milestone.id, step.id)}
                      disabled={togglingStepId === step.id}
                    >
                      {step.status === "done" ? <CheckCircle2 className="done" /> : <Circle />}
                    </button>
                    <span className={step.status === "done" ? "journey-step-title done" : "journey-step-title"}>{step.title}</span>
                    {step.status !== "done" && (
                      <button
                        type="button"
                        className="journey-step-start"
                        onClick={() => startStep(step.id)}
                        disabled={startingStepId === step.id}
                      >
                        <MessageCircle />
                        {startingStepId === step.id ? "Starting…" : step.status === "active" ? "Continue" : "Start"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
