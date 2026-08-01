"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, MessageCircle } from "lucide-react";
import type { JourneyMilestone } from "@/lib/domain/plan-journey";

export function PlanJourney({
  planId,
  milestones: initialMilestones,
}: {
  planId: string;
  milestones: JourneyMilestone[];
}) {
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
            steps: milestone.steps.map((step) =>
              step.id === stepId ? { ...step, status: data.status } : step,
            ),
          };
        }),
      );
    } finally {
      setTogglingStepId(null);
    }
  }

  const totalSteps = milestones.reduce((sum, m) => sum + m.steps.length, 0);
  const doneSteps = milestones.reduce(
    (sum, m) => sum + m.steps.filter((s) => s.status === "done").length,
    0,
  );

  // One primary action: the first active step, else the first pending step overall.
  const primaryStep =
    milestones.flatMap((m) => m.steps).find((s) => s.status === "active") ??
    milestones.flatMap((m) => m.steps).find((s) => s.status === "pending") ??
    null;

  return (
    <section className="roadmap-panel">
      <div className="roadmap-panel-head">
        <div>
          <h3>Roadmap</h3>
          <p>Small steps through this Care plan with Nura.</p>
        </div>
        {totalSteps > 0 && (
          <span className="roadmap-progress-pill">
            {doneSteps}/{totalSteps}
          </span>
        )}
      </div>

      <div className="journey-milestones">
        {milestones.map((milestone, index) => {
          const doneCount = milestone.steps.filter((s) => s.status === "done").length;
          const isCurrent =
            milestone.status === "active" ||
            (milestone.status !== "done" &&
              !milestones.slice(0, index).some((m) => m.status !== "done"));

          return (
            <div
              key={milestone.id}
              className={`journey-milestone ${milestone.status}${isCurrent ? " current" : ""}`}
            >
              <div className="journey-milestone-head">
                <span className={`journey-milestone-icon ${milestone.status}`} aria-hidden>
                  {milestone.status === "done" ? <CheckCircle2 /> : <Circle />}
                </span>
                <div>
                  <b>{milestone.title}</b>
                  {milestone.description && <small>{milestone.description}</small>}
                </div>
                <span className="journey-milestone-count">
                  {doneCount}/{milestone.steps.length}
                </span>
              </div>

              <ul className="journey-steps">
                {milestone.steps.map((step) => {
                  const isPrimary = primaryStep?.id === step.id;
                  return (
                    <li key={step.id} className={`journey-step-row ${step.status}`}>
                      <button
                        type="button"
                        className="journey-step-check"
                        aria-label={step.status === "done" ? "Mark step not done" : "Mark step done"}
                        onClick={() => toggleStep(milestone.id, step.id)}
                        disabled={togglingStepId === step.id}
                      >
                        {step.status === "done" ? <CheckCircle2 className="done" /> : <Circle />}
                      </button>
                      <span
                        className={
                          step.status === "done" ? "journey-step-title done" : "journey-step-title"
                        }
                      >
                        {step.title}
                      </span>
                      {isPrimary && (
                        <button
                          type="button"
                          className="journey-step-start"
                          onClick={() => startStep(step.id)}
                          disabled={startingStepId === step.id}
                        >
                          <MessageCircle />
                          {startingStepId === step.id
                            ? "Starting…"
                            : step.status === "active"
                              ? "Continue"
                              : "Start"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
