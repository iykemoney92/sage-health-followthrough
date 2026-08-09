import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";

export type ProgressionTrend = "improving" | "worsening" | "stable" | "mixed" | "insufficient";

export type ProgressionMetric = {
  label: string;
  previousValue: string | null;
  currentValue: string | null;
  changed: boolean;
  direction: "up" | "down" | "changed" | "same" | "added" | "removed";
};

export type ProgressionComparison = {
  trend: ProgressionTrend;
  headline: string;
  plainEnglish: string;
  current: { sessionId: string | null; title: string; summary: string; createdAt: string };
  earlier: { sessionId: string; title: string; summary: string; createdAt: string };
  metrics: ProgressionMetric[];
  newPoints: ClaritiAnalysis["keyPoints"];
  resolvedPoints: ClaritiAnalysis["keyPoints"];
  worseningSignals: string[];
  improvingSignals: string[];
  stableSignals: string[];
  safetyNote: string;
};

const WORSENING_WORDS = /\b(wors|increas|larger|growth|progress|more severe|new lesion|new tear|interval increase|enlarged|more prominent|more extensive)\w*/i;
const IMPROVING_WORDS = /\b(improv|decreas|smaller|resolv|regress|heal|less severe|interval decrease|reduced|diminished|near.?resolut)\w*/i;
const STABLE_WORDS = /\b(stable|unchanged|no significant (?:interval )?change|similar|essentially unchanged)\b/i;

function directionFor(previous: string | null, current: string | null): ProgressionMetric["direction"] {
  if (!previous && current) return "added";
  if (previous && !current) return "removed";
  if (!previous || !current) return "same";
  if (previous === current) return "same";

  const prevNum = Number(String(previous).replace(/[^\d.-]/g, ""));
  const currNum = Number(String(current).replace(/[^\d.-]/g, ""));
  if (Number.isFinite(prevNum) && Number.isFinite(currNum) && prevNum !== currNum) {
    return currNum > prevNum ? "up" : "down";
  }
  return "changed";
}

function classifyTextSignal(text: string): "worsening" | "improving" | "stable" | null {
  if (WORSENING_WORDS.test(text)) return "worsening";
  if (IMPROVING_WORDS.test(text)) return "improving";
  if (STABLE_WORDS.test(text)) return "stable";
  return null;
}

function headlineFor(trend: ProgressionTrend) {
  switch (trend) {
    case "improving":
      return "Looks improved vs the earlier report";
    case "worsening":
      return "Looks more concerning vs the earlier report";
    case "stable":
      return "Looks largely unchanged";
    case "mixed":
      return "Mixed changes vs the earlier report";
    default:
      return "Not enough overlapping detail to judge trend";
  }
}

function plainEnglishFor(trend: ProgressionTrend, earlierTitle: string) {
  switch (trend) {
    case "improving":
      return `Compared with “${earlierTitle}”, the newer wording points toward improvement. Confirm what that means for you with your clinician.`;
    case "worsening":
      return `Compared with “${earlierTitle}”, the newer wording points toward progression or a more concerning change. Ask your clinician how this lines up with your symptoms.`;
    case "stable":
      return `Compared with “${earlierTitle}”, Clariti does not see a clear shift in the saved wording — it may be stable. Your clinician still decides what that means.`;
    case "mixed":
      return `Compared with “${earlierTitle}”, some items look better and some look worse or new. Clariti can only highlight wording changes — not diagnose.`;
    default:
      return `Clariti could not confidently classify a trend from the overlapping labels in these two saved reports.`;
  }
}

/**
 * Pairwise progression/regression view from two saved analyses.
 * Uses only source-grounded labels/values — no invented findings.
 */
export function buildProgressionComparison({
  current,
  earlier,
  currentSessionId,
  currentCreatedAt = new Date().toISOString(),
}: {
  current: ClaritiAnalysis;
  earlier: {
    sessionId: string;
    title: string;
    summary: string;
    keyPoints: ClaritiAnalysis["keyPoints"];
    metrics: ClaritiAnalysis["metrics"];
    createdAt: string;
  };
  currentSessionId?: string | null;
  currentCreatedAt?: string;
}): ProgressionComparison {
  const metricLabels = new Set([
    ...current.metrics.map((metric) => metric.label),
    ...earlier.metrics.map((metric) => metric.label),
  ]);

  const metrics: ProgressionMetric[] = Array.from(metricLabels).map((label) => {
    const currentValue = current.metrics.find((metric) => metric.label.toLowerCase() === label.toLowerCase())?.value ?? null;
    const previousValue = earlier.metrics.find((metric) => metric.label.toLowerCase() === label.toLowerCase())?.value ?? null;
    const direction = directionFor(previousValue, currentValue);
    return {
      label,
      previousValue,
      currentValue,
      changed: previousValue !== currentValue,
      direction,
    };
  });

  const currentLabels = new Set(current.keyPoints.map((point) => point.label.toLowerCase()));
  const earlierLabels = new Set(earlier.keyPoints.map((point) => point.label.toLowerCase()));
  const newPoints = current.keyPoints.filter((point) => !earlierLabels.has(point.label.toLowerCase()));
  const resolvedPoints = earlier.keyPoints.filter((point) => !currentLabels.has(point.label.toLowerCase()));

  const worseningSignals: string[] = [];
  const improvingSignals: string[] = [];
  const stableSignals: string[] = [];

  for (const metric of metrics.filter((item) => item.changed)) {
    const blob = `${metric.label} ${metric.previousValue ?? ""} ${metric.currentValue ?? ""}`;
    const signal = classifyTextSignal(blob);
    const line = `${metric.label}: ${metric.previousValue ?? "—"} → ${metric.currentValue ?? "—"}`;
    if (signal === "worsening" || metric.direction === "up") worseningSignals.push(line);
    else if (signal === "improving" || metric.direction === "down") improvingSignals.push(line);
    else if (signal === "stable") stableSignals.push(line);
    else if (metric.direction === "added") worseningSignals.push(`New metric noted: ${metric.label}`);
  }

  for (const point of newPoints) {
    const signal = classifyTextSignal(`${point.label} ${point.detail}`);
    const line = `New: ${point.label} — ${point.detail}`;
    if (signal === "improving") improvingSignals.push(line);
    else worseningSignals.push(line);
  }
  for (const point of resolvedPoints) {
    improvingSignals.push(`No longer highlighted: ${point.label}`);
  }

  const summarySignal = classifyTextSignal(`${current.summary} ${current.plainEnglish}`);
  if (summarySignal === "worsening") worseningSignals.push(`Summary wording: ${current.summary}`);
  if (summarySignal === "improving") improvingSignals.push(`Summary wording: ${current.summary}`);
  if (summarySignal === "stable") stableSignals.push(`Summary wording: ${current.summary}`);

  let trend: ProgressionTrend = "insufficient";
  const hasWorsening = worseningSignals.length > 0;
  const hasImproving = improvingSignals.length > 0;
  const hasStable = stableSignals.length > 0 || metrics.some((metric) => !metric.changed);

  if (hasWorsening && hasImproving) trend = "mixed";
  else if (hasWorsening) trend = "worsening";
  else if (hasImproving) trend = "improving";
  else if (hasStable || metrics.length > 0) trend = "stable";

  return {
    trend,
    headline: headlineFor(trend),
    plainEnglish: plainEnglishFor(trend, earlier.title),
    current: {
      sessionId: currentSessionId ?? null,
      title: current.title,
      summary: current.summary,
      createdAt: currentCreatedAt,
    },
    earlier: {
      sessionId: earlier.sessionId,
      title: earlier.title,
      summary: earlier.summary,
      createdAt: earlier.createdAt,
    },
    metrics,
    newPoints,
    resolvedPoints,
    worseningSignals: worseningSignals.slice(0, 5),
    improvingSignals: improvingSignals.slice(0, 5),
    stableSignals: stableSignals.slice(0, 5),
    safetyNote: "Clariti compares saved report wording only. It does not diagnose progression or improvement — confirm any change with your clinician.",
  };
}
