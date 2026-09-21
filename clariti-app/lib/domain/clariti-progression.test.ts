import { describe, expect, it } from "vitest";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { buildProgressionComparison } from "@/lib/domain/clariti-progression";

type EarlierInput = Parameters<typeof buildProgressionComparison>[0]["earlier"];

/**
 * The comparison used to read "the number went up" as "you got worse" and "the
 * number went down" as "you got better". Haemoglobin recovering from anaemia was
 * reported as deterioration; a falling eGFR was reported as improvement; a new
 * key point called "Scan type" was deterioration by default. It sat behind a
 * paywall nobody had bought, which is the only reason it never reached a reader.
 *
 * Every case here is one of those. The summary and plain-English strings in the
 * fixtures are deliberately flat — the narrative classifier reads them too, and
 * a stray "healthy" or "stable" would classify the whole comparison.
 */

function analysis(overrides: Partial<ClaritiAnalysis> = {}): ClaritiAnalysis {
  return {
    kind: "lab_results",
    title: "Blood test, March",
    summary: "Your blood test from March.",
    plainEnglish: "This sheet lists what the lab measured.",
    sourceAnchors: ["Results"],
    keyPoints: [{ label: "Sample date", detail: "Taken on 4 March.", sourceAnchor: "Results" }],
    metrics: [],
    flags: [],
    questions: ["What do these numbers mean for me?"],
    nextActions: ["Talk it through at your next appointment."],
    safetyNote: "Ask your clinician what this means for you.",
    ...overrides,
  };
}

function earlierReport(overrides: Partial<EarlierInput> = {}): EarlierInput {
  return {
    sessionId: "00000000-0000-4000-8000-000000000001",
    title: "Blood test, January",
    summary: "Your blood test from January.",
    keyPoints: [{ label: "Sample date", detail: "Taken on 6 January.", sourceAnchor: "Results" }],
    metrics: [],
    createdAt: "2026-01-06T09:00:00.000Z",
    ...overrides,
  };
}

function compare(currentMetrics: ClaritiAnalysis["metrics"], earlierMetrics: ClaritiAnalysis["metrics"]) {
  return buildProgressionComparison({
    current: analysis({ metrics: currentMetrics }),
    earlier: earlierReport({ metrics: earlierMetrics }),
    currentSessionId: "00000000-0000-4000-8000-000000000002",
    currentCreatedAt: "2026-03-04T09:00:00.000Z",
  });
}

const mentions = (lines: string[], needle: string) => lines.some((line) => line.includes(needle));

describe("progression comparison", () => {
  it("does not call a rising haemoglobin deterioration", () => {
    const result = compare([{ label: "Haemoglobin", value: "11.4 g/dL" }], [{ label: "Haemoglobin", value: "9.1 g/dL" }]);

    expect(mentions(result.worseningSignals, "Haemoglobin")).toBe(false);
    expect(mentions(result.improvingSignals, "Haemoglobin: 9.1 g/dL → 11.4 g/dL")).toBe(true);
    expect(result.trend).not.toBe("worsening");
    expect(result.metrics[0]).toMatchObject({ direction: "up", healthDirection: "better" });
  });

  it("does not call a falling eGFR improvement", () => {
    const result = compare([{ label: "eGFR", value: "48" }], [{ label: "eGFR", value: "74" }]);

    expect(mentions(result.improvingSignals, "eGFR")).toBe(false);
    expect(mentions(result.worseningSignals, "eGFR: 74 → 48")).toBe(true);
    expect(result.trend).not.toBe("improving");
    expect(result.metrics[0]).toMatchObject({ direction: "down", healthDirection: "worse" });
  });

  it("reports an unrecognised metric factually, with no verdict either way", () => {
    const result = compare([{ label: "Marker QX-7", value: "5" }], [{ label: "Marker QX-7", value: "3" }]);

    expect(result.factualChanges).toContain("Marker QX-7: 3 → 5");
    expect(result.worseningSignals).toEqual([]);
    expect(result.improvingSignals).toEqual([]);
    expect(result.metrics[0].healthDirection).toBe("unknown");
    // Something moved, so this is not "stable" either — Clariti simply cannot say.
    expect(result.trend).toBe("insufficient");
    expect(result.headline).toMatch(/cannot say/i);
  });

  it("does not call a new key point deterioration", () => {
    const result = buildProgressionComparison({
      current: analysis({
        keyPoints: [
          { label: "Sample date", detail: "Taken on 4 March.", sourceAnchor: "Results" },
          { label: "Scan type", detail: "MRI of the lower back.", sourceAnchor: "Results" },
        ],
      }),
      earlier: earlierReport(),
    });

    expect(mentions(result.worseningSignals, "Scan type")).toBe(false);
    expect(mentions(result.factualChanges, "New: Scan type — MRI of the lower back.")).toBe(true);
    expect(result.trend).not.toBe("worsening");
  });

  it("still flags a new key point whose own wording is concerning", () => {
    const result = buildProgressionComparison({
      current: analysis({
        keyPoints: [
          { label: "Sample date", detail: "Taken on 4 March.", sourceAnchor: "Results" },
          { label: "New lesion", detail: "A new lesion is described in the report.", sourceAnchor: "Results" },
        ],
      }),
      earlier: earlierReport(),
    });

    expect(mentions(result.worseningSignals, "New lesion")).toBe(true);
    expect(result.trend).toBe("worsening");
  });

  it("refuses a verdict on metrics that are dangerous in both directions", () => {
    const result = compare([{ label: "White cell count", value: "6.8" }], [{ label: "White cell count", value: "14.2" }]);

    expect(result.factualChanges).toContain("White cell count: 14.2 → 6.8");
    expect(result.worseningSignals).toEqual([]);
    expect(result.improvingSignals).toEqual([]);
  });

  it("reads HbA1c on its own terms rather than as a haemoglobin", () => {
    const result = compare([{ label: "HbA1c", value: "6.4%" }], [{ label: "HbA1c", value: "7.9%" }]);

    expect(mentions(result.improvingSignals, "HbA1c: 7.9% → 6.4%")).toBe(true);
    expect(result.worseningSignals).toEqual([]);
  });

  it("does not turn a bigger bill into a health verdict", () => {
    const result = compare([{ label: "Amount due", value: "$340.00" }], [{ label: "Amount due", value: "$120.00" }]);

    expect(result.factualChanges).toContain("Amount due: $120.00 → $340.00");
    expect(result.worseningSignals).toEqual([]);
  });

  it("does not read a dropped key point as recovery", () => {
    const result = buildProgressionComparison({
      current: analysis(),
      earlier: earlierReport({
        keyPoints: [
          { label: "Sample date", detail: "Taken on 6 January.", sourceAnchor: "Results" },
          { label: "Kidney function", detail: "The lab listed a kidney panel.", sourceAnchor: "Results" },
        ],
      }),
    });

    expect(mentions(result.improvingSignals, "Kidney function")).toBe(false);
    expect(result.factualChanges).toContain("No longer mentioned: Kidney function");
  });

  // The three the brief names by name, plus the mirror case, in one pass.
  it.each([
    ["Vitamin D", "18 nmol/L", "62 nmol/L", "improving"],
    ["Platelets", "96", "210", "improving"],
    ["Creatinine", "88 umol/L", "176 umol/L", "worsening"],
    ["Haematocrit", "0.41", "0.29", "worsening"],
  ])("puts %s %s → %s in the %s list", (label, previous, current, bucket) => {
    const result = compare([{ label, value: current }], [{ label, value: previous }]);
    const expected = bucket === "improving" ? result.improvingSignals : result.worseningSignals;
    const other = bucket === "improving" ? result.worseningSignals : result.improvingSignals;

    expect(mentions(expected, `${label}: ${previous} → ${current}`)).toBe(true);
    expect(other).toEqual([]);
  });

  it("reports a non-numeric change instead of dropping it", () => {
    // This used to match no branch at all: the reader saw nothing where a result
    // had flipped.
    const result = compare([{ label: "Culture result", value: "Negative" }], [{ label: "Culture result", value: "Positive" }]);

    expect(result.factualChanges).toContain("Culture result: Positive → Negative");
    expect(result.metrics[0].direction).toBe("changed");
  });

  it("keeps the shape the compare route and the workspace card render", () => {
    const result = compare([{ label: "Platelets", value: "210" }], [{ label: "Platelets", value: "96" }]);

    expect(Object.keys(result).sort()).toEqual(
      [
        "current",
        "earlier",
        "factualChanges",
        "headline",
        "improvingSignals",
        "metrics",
        "newPoints",
        "plainEnglish",
        "resolvedPoints",
        "safetyNote",
        "stableSignals",
        "trend",
        "worseningSignals",
      ].sort(),
    );
    expect(result.earlier.sessionId).toBe("00000000-0000-4000-8000-000000000001");
    expect(result.current.sessionId).toBe("00000000-0000-4000-8000-000000000002");
    expect(result.safetyNote.length).toBeGreaterThan(40);
  });
});
