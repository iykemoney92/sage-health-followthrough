import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";

export type ProgressionTrend = "improving" | "worsening" | "stable" | "mixed" | "insufficient";

/** Which way the move points for health — not which way the number moved. */
export type MetricHealthDirection = "better" | "worse" | "unknown";

export type ProgressionMetric = {
  label: string;
  previousValue: string | null;
  currentValue: string | null;
  changed: boolean;
  direction: "up" | "down" | "changed" | "same" | "added" | "removed";
  /**
   * "unknown" whenever Clariti does not recognise the label, which is most of
   * the time and is meant to be. `direction` on its own says nothing about the
   * person: haemoglobin 9.1 → 11.4 is "up" and is recovery from anaemia.
   */
  healthDirection: MetricHealthDirection;
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
  /**
   * What changed, stated and nothing more. Everything Clariti cannot honestly
   * call better or worse lands here instead of being forced into one of the
   * verdict lists above — this is the wide path, not the edge case.
   */
  factualChanges: string[];
  safetyNote: string;
};

const WORSENING_WORDS = /\b(wors|increas|larger|growth|progress|more severe|new lesion|new tear|interval increase|enlarged|more prominent|more extensive)\w*/i;
const IMPROVING_WORDS = /\b(improv|decreas|smaller|resolv|regress|heal|less severe|interval decrease|reduced|diminished|near.?resolut)\w*/i;
const STABLE_WORDS = /\b(stable|unchanged|no significant (?:interval )?change|similar|essentially unchanged)\b/i;

/**
 * Narrow versions of the above, for metric labels only.
 *
 * The wide lists are built for prose — "interval increase in lesion size" means
 * what it says. A metric label is not prose: it is a test name, so "increase",
 * "larger", "reduced" and friends are only restating `direction`, and reading a
 * verdict out of them is the same mistake this file exists to stop. These keep
 * the words that are a judgement whichever way the number went.
 */
const METRIC_WORSENING_WORDS = /\b(wors|progression|new lesion|new tear|enlarg|more severe|more extensive|more prominent)\w*/i;
const METRIC_IMPROVING_WORDS = /\b(improv|resolv|regress|remission|less severe|near.?resolut)\w*/i;

type Directionality = "better-when-higher" | "worse-when-higher" | "ambiguous";

/**
 * Direction of change is not direction of health, and Clariti cannot tell which
 * is which without knowing the metric. This table is the only place it claims to
 * know, and it is deliberately short: every row is a clinical reading we make on
 * someone's behalf, and anything absent falls through to the factual list, which
 * is the safe default and is expected to carry the long tail.
 *
 * Order is load-bearing — first match wins — so HbA1c is tested before
 * haemoglobin and HDL before cholesterol. The "ambiguous" rows exist to *refuse*
 * a verdict rather than let a later row supply one: white cells, potassium and
 * glucose are dangerous in both directions, a medication dose going up is not
 * deterioration, and a bill total is not a health trend at all.
 */
const METRIC_DIRECTIONALITY: Array<{ pattern: RegExp; directionality: Directionality }> = [
  // Specific before general — each of these would otherwise be caught, wrongly,
  // by a broader row further down.
  { pattern: /\b(hba1c|a1c|glyc(?:at|osylat)ed h(?:a)?emoglobin)\b/, directionality: "worse-when-higher" },
  // Above the plain HDL row, and both above the cholesterol row further down.
  // "Non-HDL cholesterol" contains "hdl" between non-word characters, so \bhdl\b
  // matches it — and a rise in non-HDL, which is the atherogenic fraction, would
  // have been reported as "higher is usually the reassuring direction". A ratio
  // has no single direction at all, so it is refused rather than guessed.
  { pattern: /\bnon[\s-]?hdl\b/, directionality: "worse-when-higher" },
  { pattern: /\b(?:chol\w*|ldl|tc)\s*[:/]\s*hdl|\bhdl\s*[:/]\s*(?:chol\w*|ldl|tc)|\bcholesterol ratio\b/, directionality: "ambiguous" },
  { pattern: /\bhdl\b/, directionality: "better-when-higher" },
  { pattern: /creatinine clearance/, directionality: "better-when-higher" },
  { pattern: /\b(microalbumin|urine albumin|albumin[\s:/-]*creatinine|acr)\b/, directionality: "worse-when-higher" },

  // Refusals.
  { pattern: /\b(white (?:blood )?cells?|wbc|leu[ck]ocytes?|neutrophils?|lymphocytes?|eosinophils?)\b/, directionality: "ambiguous" },
  { pattern: /\b(potassium|sodium|calcium|magnesium|phosphate|chloride|electrolytes?)\b/, directionality: "ambiguous" },
  { pattern: /\b(glucose|blood sugar)\b/, directionality: "ambiguous" },
  { pattern: /\b(tsh|thyroid|free t[34]|t[34])\b/, directionality: "ambiguous" },
  { pattern: /\b(inr|aptt|prothrombin)\b/, directionality: "ambiguous" },
  { pattern: /\b(ferritin|iron|transferrin)\b/, directionality: "ambiguous" },
  { pattern: /\b(weight|height|bmi|body mass(?: index)?|lean (?:body )?mass|bone mass|muscle mass|fat mass)\b/, directionality: "ambiguous" },
  { pattern: /\b(blood pressure|bp|systolic|diastolic|heart rate|pulse|respiratory rate|temperature)\b/, directionality: "ambiguous" },
  { pattern: /\b(dose|dosage|strength|tablets?|capsules?|refills?|quantity|frequency)\b/, directionality: "ambiguous" },
  { pattern: /\b(amount|balance|charges?|billed|paid|due|copay|co-?insurance|deductible|allowed|patient responsibility)\b/, directionality: "ambiguous" },

  // Higher is usually the reassuring side.
  { pattern: /\b(h(?:a)?emoglobin|hgb|hb)\b/, directionality: "better-when-higher" },
  { pattern: /\b(h(?:a)?ematocrit|hct)\b/, directionality: "better-when-higher" },
  { pattern: /\bplatelets?\b/, directionality: "better-when-higher" },
  { pattern: /\b(e?gfr)\b/, directionality: "better-when-higher" },
  { pattern: /\balbumin\b/, directionality: "better-when-higher" },
  { pattern: /\b(vitamin ?d|25[\s-]?(?:oh|hydroxy)\w* ?vitamin ?d)\b/, directionality: "better-when-higher" },
  { pattern: /\b(vitamin ?b-? ?12|b12|cobalamin)\b/, directionality: "better-when-higher" },
  { pattern: /\b(oxygen saturation|o2 sat\w*|sp[o0]2|sats)\b/, directionality: "better-when-higher" },
  { pattern: /\b(ejection fraction|lvef)\b/, directionality: "better-when-higher" },

  // Higher is usually the side clinicians watch.
  { pattern: /\bcreatinine\b/, directionality: "worse-when-higher" },
  { pattern: /\b(urea|bun)\b/, directionality: "worse-when-higher" },
  { pattern: /\b(crp|c-? ?reactive protein)\b/, directionality: "worse-when-higher" },
  { pattern: /\b(esr|erythrocyte sedimentation)\b/, directionality: "worse-when-higher" },
  { pattern: /\bbilirubin\b/, directionality: "worse-when-higher" },
  { pattern: /\b(alt|ast|alp|ggt|alkaline phosphatase|transaminase)\b/, directionality: "worse-when-higher" },
  { pattern: /\b(psa|prostate.specific antigen)\b/, directionality: "worse-when-higher" },
  { pattern: /\b(ldl|cholesterol|triglycerides?)\b/, directionality: "worse-when-higher" },
  { pattern: /\b(d-? ?dimer|troponin)\b/, directionality: "worse-when-higher" },
  { pattern: /\b(tumou?r|lesion|nodule|mass|stenosis|effusion)\b/, directionality: "worse-when-higher" },
];

function directionalityFor(label: string): Directionality | null {
  const normalized = label.toLowerCase();
  return METRIC_DIRECTIONALITY.find((entry) => entry.pattern.test(normalized))?.directionality ?? null;
}

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

function healthDirectionFor(label: string, direction: ProgressionMetric["direction"]): MetricHealthDirection {
  if (direction !== "up" && direction !== "down") return "unknown";
  const directionality = directionalityFor(label);
  if (directionality !== "better-when-higher" && directionality !== "worse-when-higher") return "unknown";
  // A rise is reassuring only where the table says higher is the healthy side.
  return (direction === "up") === (directionality === "better-when-higher") ? "better" : "worse";
}

function classifyTextSignal(text: string): "worsening" | "improving" | "stable" | null {
  if (WORSENING_WORDS.test(text)) return "worsening";
  if (IMPROVING_WORDS.test(text)) return "improving";
  if (STABLE_WORDS.test(text)) return "stable";
  return null;
}

function classifyMetricWording(text: string): "worsening" | "improving" | "stable" | null {
  if (METRIC_WORSENING_WORDS.test(text)) return "worsening";
  if (METRIC_IMPROVING_WORDS.test(text)) return "improving";
  if (STABLE_WORDS.test(text)) return "stable";
  return null;
}

/** Bare fact, no verdict. This is what the factual list is made of. */
function changeLine(metric: ProgressionMetric) {
  // `||` rather than `??`: an empty value is a blank, not a reading.
  return `${metric.label}: ${metric.previousValue || "—"} → ${metric.currentValue || "—"}`;
}

/**
 * Says why the line is in the list it is in. Readers deserve the rule of thumb
 * we applied, not just our conclusion — the table knows which way is usually
 * reassuring, it does not know whether the new number is normal for them.
 */
function verdictLine(metric: ProgressionMetric, health: Exclude<MetricHealthDirection, "unknown">) {
  const side = metric.direction === "up" ? "higher" : "lower";
  return health === "better"
    ? `${changeLine(metric)} (for this test, ${side} is usually the reassuring direction)`
    : `${changeLine(metric)} (for this test, ${side} is usually the direction clinicians watch)`;
}

/** Why a trend came out "insufficient", which changes what we should say about it. */
type TrendBasis = "signals" | "unknown-direction" | "no-overlap";

function headlineFor(trend: ProgressionTrend, basis: TrendBasis) {
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
      return basis === "unknown-direction"
        ? "Some things changed — Clariti cannot say whether that is better or worse"
        : "Not enough overlapping detail to judge trend";
  }
}

function unknownDirectionSentence(count: number) {
  return count === 1
    ? "One other thing changed that Clariti will not call better or worse, because it does not know which direction is healthy for that one — it is listed as it stands."
    : `${count} other things changed that Clariti will not call better or worse, because it does not know which direction is healthy for them — they are listed as they stand.`;
}

function plainEnglishFor(trend: ProgressionTrend, earlierTitle: string, basis: TrendBasis, unknownCount: number) {
  const aside = unknownCount > 0 ? ` ${unknownDirectionSentence(unknownCount)}` : "";
  switch (trend) {
    case "improving":
      return `Compared with “${earlierTitle}”, the newer wording points toward improvement. Confirm what that means for you with your clinician.${aside}`;
    case "worsening":
      return `Compared with “${earlierTitle}”, the newer wording points toward progression or a more concerning change. Ask your clinician how this lines up with your symptoms.${aside}`;
    case "stable":
      return `Compared with “${earlierTitle}”, Clariti does not see a clear shift in the saved wording — it may be stable. Your clinician still decides what that means.${aside}`;
    case "mixed":
      return `Compared with “${earlierTitle}”, some items look better and some look worse or new. Clariti can only highlight wording changes — not diagnose.${aside}`;
    default:
      return basis === "unknown-direction"
        ? `Compared with “${earlierTitle}”, things did change — but Clariti does not know which direction is the healthy one for them, so it lists each change as it stands rather than calling the trend. Your clinician can tell you what the move means.`
        : `Clariti could not confidently classify a trend from the overlapping labels in these two saved reports.`;
  }
}

/**
 * Pairwise progression/regression view from two saved analyses.
 * Uses only source-grounded labels/values — no invented findings.
 *
 * A number moving is a fact; a number moving in a bad direction is a claim, and
 * this used to make that claim about every metric that went up and the opposite
 * one about every metric that went down. Anything the metric table does not
 * recognise, and every new key point that does not say something concerning in
 * its own words, is now reported as what changed with no verdict attached.
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
      healthDirection: healthDirectionFor(label, direction),
    };
  });

  const currentLabels = new Set(current.keyPoints.map((point) => point.label.toLowerCase()));
  const earlierLabels = new Set(earlier.keyPoints.map((point) => point.label.toLowerCase()));
  const newPoints = current.keyPoints.filter((point) => !earlierLabels.has(point.label.toLowerCase()));
  const resolvedPoints = earlier.keyPoints.filter((point) => !currentLabels.has(point.label.toLowerCase()));

  const worseningSignals: string[] = [];
  const improvingSignals: string[] = [];
  const stableSignals: string[] = [];
  const factualChanges: string[] = [];

  for (const metric of metrics.filter((item) => item.changed)) {
    if (metric.direction === "added") {
      // A metric appearing for the first time has no earlier value to be worse than.
      factualChanges.push(`Newly reported: ${metric.label}${metric.currentValue ? ` — ${metric.currentValue}` : ""}`);
      continue;
    }
    if (metric.direction === "removed") {
      factualChanges.push(`No longer reported: ${metric.label}${metric.previousValue ? ` (was ${metric.previousValue})` : ""}`);
      continue;
    }

    if (metric.healthDirection !== "unknown") {
      const line = verdictLine(metric, metric.healthDirection);
      if (metric.healthDirection === "worse") worseningSignals.push(line);
      else improvingSignals.push(line);
      continue;
    }

    // The table said "ambiguous" on purpose; do not let wording talk us back
    // into a verdict it already refused.
    if (directionalityFor(metric.label) === "ambiguous") {
      factualChanges.push(changeLine(metric));
      continue;
    }

    const signal = classifyMetricWording(`${metric.label} ${metric.previousValue ?? ""} ${metric.currentValue ?? ""}`);
    const line = changeLine(metric);
    if (signal === "worsening") worseningSignals.push(line);
    else if (signal === "improving") improvingSignals.push(line);
    else if (signal === "stable") stableSignals.push(line);
    else factualChanges.push(line);
  }

  for (const point of newPoints) {
    const signal = classifyTextSignal(`${point.label} ${point.detail}`);
    const line = `New: ${point.label} — ${point.detail}`;
    if (signal === "improving") improvingSignals.push(line);
    else if (signal === "worsening") worseningSignals.push(line);
    // A new key point is new, not bad. "Scan type" used to read as deterioration.
    else factualChanges.push(line);
  }
  for (const point of resolvedPoints) {
    // Absence is not evidence of recovery — the newer report may just not mention it.
    factualChanges.push(`No longer mentioned: ${point.label}`);
  }

  const summarySignal = classifyTextSignal(`${current.summary} ${current.plainEnglish}`);
  if (summarySignal === "worsening") worseningSignals.push(`Summary wording: ${current.summary}`);
  if (summarySignal === "improving") improvingSignals.push(`Summary wording: ${current.summary}`);
  if (summarySignal === "stable") stableSignals.push(`Summary wording: ${current.summary}`);

  let trend: ProgressionTrend = "insufficient";
  const hasWorsening = worseningSignals.length > 0;
  const hasImproving = improvingSignals.length > 0;
  const hasUnclassified = factualChanges.length > 0;
  const hasStable = stableSignals.length > 0 || metrics.some((metric) => !metric.changed);

  if (hasWorsening && hasImproving) trend = "mixed";
  else if (hasWorsening) trend = "worsening";
  else if (hasImproving) trend = "improving";
  // Things moved and we cannot say which way: that is not "stable", which is a
  // verdict of its own, and it is certainly not worsening.
  else if (hasUnclassified) trend = "insufficient";
  else if (hasStable) trend = "stable";

  const basis: TrendBasis = trend !== "insufficient" ? "signals" : hasUnclassified ? "unknown-direction" : "no-overlap";

  const shownFactualChanges = factualChanges.slice(0, 6);
  const hiddenFactualChanges = factualChanges.length - shownFactualChanges.length;
  if (hiddenFactualChanges > 0) {
    // Say that the list was cut rather than quietly ending it early.
    shownFactualChanges.push(`…and ${hiddenFactualChanges} more change${hiddenFactualChanges === 1 ? "" : "s"} not listed here.`);
  }

  return {
    trend,
    headline: headlineFor(trend, basis),
    plainEnglish: plainEnglishFor(trend, earlier.title, basis, factualChanges.length),
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
    factualChanges: shownFactualChanges,
    safetyNote: "Clariti compares saved report wording only. It does not diagnose progression or improvement — and where it does not know which direction is the healthy one, it says what changed and leaves the reading to your clinician.",
  };
}
