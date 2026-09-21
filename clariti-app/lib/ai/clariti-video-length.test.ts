import { describe, expect, it } from "vitest";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import {
  FLUX_MAX_CHAINED_SEGMENTS,
  FLUX_MAX_CLIP_SECONDS,
  FLUX_MIN_CLIP_SECONDS,
  planFluxSegments,
  recommendExplainerSeconds,
  segmentsForExplainerSeconds,
  type ExplainerLengthFacts,
} from "./clariti-video";

/** A one-line result with nothing to walk through: no metrics, no flags, one point. */
const thinLabResult: ExplainerLengthFacts = {
  kind: "lab_results",
  title: "Cholesterol panel",
  summary: "your total cholesterol is a little above the usual range",
  plainEnglish: "Your cholesterol is slightly higher than the range printed beside it. It is worth a mention at your next appointment.",
  sourceAnchors: ["Total cholesterol 5.4 mmol/L"],
  keyPoints: [
    { label: "The number", detail: "total cholesterol is 5.4", sourceAnchor: "Total cholesterol 5.4 mmol/L" },
  ],
  metrics: [],
  flags: [],
  questions: ["Is this number something I should do anything about?"],
  nextActions: ["Mention it at your next appointment."],
  safetyNote: "This explains the wording on the sheet, not what it means for you.",
};

/** Six pages of itemised charges, a warning on it, and a storyboard written for all of that. */
const denseBill: ExplainerLengthFacts = {
  kind: "medical_bill",
  title: "Hospital statement",
  summary: "this statement lists eleven charges from one overnight stay",
  plainEnglish: "This is the hospital's own bill, before your insurer's side of it. Several lines are billed separately even though they happened in the same room.",
  sourceAnchors: ["PATIENT RESPONSIBILITY", "Room and board, semi-private"],
  keyPoints: [
    { label: "What you owe today", detail: "the balance due is 1,284 dollars", sourceAnchor: "PATIENT RESPONSIBILITY" },
    { label: "The largest line", detail: "room and board is 740 dollars of the total", sourceAnchor: "Room and board, semi-private" },
    { label: "Billed twice", detail: "two identical lab charges appear on the same date", sourceAnchor: "CBC w/ differential" },
  ],
  metrics: [
    { label: "Total charges", value: "$4,912.00" },
    { label: "Insurance paid", value: "$3,410.00" },
    { label: "Adjustments", value: "$218.00" },
    { label: "Balance due", value: "$1,284.00" },
    { label: "Room and board", value: "$740.00" },
    { label: "Pharmacy", value: "$312.00" },
    { label: "Laboratory", value: "$286.00" },
    { label: "Imaging", value: "$164.00" },
  ],
  flags: [
    { label: "Two identical lab lines", detail: "the same test is billed twice on the same date", severity: "urgent" },
    { label: "No itemised pharmacy list", detail: "the pharmacy line is a single total with no breakdown", severity: "check" },
    { label: "Insurer side missing", detail: "the Explanation of Benefits is not attached to this statement", severity: "check" },
  ],
  questions: ["Why is the same lab test billed twice on the same day?"],
  nextActions: ["Ask billing for an itemised copy before paying."],
  safetyNote: "This explains the statement only. Confirm what you owe with the billing office.",
  videoScenes: [
    {
      title: "What this document is",
      script: "This is the hospital's own statement for your overnight stay, sent before your insurer's paperwork catches up with it.",
      visual: "Show the statement header and the account number being explained.",
      sourceAnchor: "PATIENT RESPONSIBILITY",
    },
    {
      title: "How the money flows",
      script: "Total charges came to four thousand nine hundred and twelve dollars. Your insurer paid three thousand four hundred and ten, and adjustments took off another two hundred and eighteen.",
      visual: "Show billed, allowed, paid and remaining as a single flow.",
      sourceAnchor: "Total charges",
    },
    {
      title: "The biggest line",
      script: "Room and board is seven hundred and forty dollars of what is left, billed at the semi-private rate printed beside it.",
      visual: "Highlight the room and board line and its rate.",
      sourceAnchor: "Room and board, semi-private",
    },
    {
      title: "Something to check",
      script: "The same blood count test appears twice on the same date, and the pharmacy charge is one total with nothing itemised underneath it.",
      visual: "Show the two matching lab lines side by side.",
      sourceAnchor: "CBC w/ differential",
    },
    {
      title: "What to ask next",
      script: "Before you pay anything, ask the billing office for an itemised copy and why that lab test is on here twice.",
      visual: "Show a short checklist of what to ask the billing office.",
      sourceAnchor: "PATIENT RESPONSIBILITY",
    },
  ],
};

/** Longer than Clariti will ever agree to render, from every direction at once. */
const overlongEverything: ExplainerLengthFacts = {
  ...denseBill,
  metrics: Array.from({ length: 14 }, (_, index) => ({ label: `Charge ${index + 1}`, value: `$${100 + index}.00` })),
  flags: Array.from({ length: 6 }, (_, index) => ({
    label: `Warning ${index + 1}`,
    detail: `something on page ${index + 1} needs prompt attention from someone`,
    severity: "urgent" as const,
  })),
  videoScenes: Array.from({ length: 12 }, (_, index) => ({
    title: `Charge group ${index + 1}`,
    script: `Page ${index + 1} of this statement carries its own group of charges, each one billed separately even though they all happened during the same overnight stay in the same room.`,
    visual: `Show page ${index + 1} of the statement with its charge group highlighted.`,
    sourceAnchor: "PATIENT RESPONSIBILITY",
  })),
};

/** An analysis with nothing in it at all, and a storyboard of one word. */
const emptyAnalysis: ExplainerLengthFacts = {
  kind: "unknown",
  title: "",
  summary: "",
  plainEnglish: "",
  sourceAnchors: [""],
  keyPoints: [{ label: "", detail: "", sourceAnchor: "" }],
  metrics: [],
  flags: [],
  questions: [""],
  nextActions: [""],
  safetyNote: "",
  videoScenes: [{ title: "", script: "Hello.", visual: "", sourceAnchor: "" }],
};

describe("recommendExplainerSeconds", () => {
  it("keeps a thin analysis to a single render", () => {
    // One free explainer, and nothing here to spend four of them on: a single
    // number, no warnings, no charges to walk through.
    const recommendation = recommendExplainerSeconds(thinLabResult);

    expect(recommendation.segments).toBe(1);
    expect(recommendation.seconds).toBeLessThanOrEqual(FLUX_MAX_CLIP_SECONDS);
    expect(recommendation.reasons.length).toBeGreaterThan(0);
  });

  it("gives an itemised bill with a warning on it more than one", () => {
    const thin = recommendExplainerSeconds(thinLabResult);
    const dense = recommendExplainerSeconds(denseBill);

    expect(dense.segments).toBeGreaterThan(1);
    expect(dense.seconds).toBeGreaterThan(thin.seconds);
    expect(dense.evidence.map((item) => item.signal)).toEqual(
      expect.arrayContaining(["beats", "metrics", "urgent_flags", "check_flags"]),
    );
  });

  it("counts a warning as time the explainer has to spend, and says so", () => {
    // The same bill with nothing flagged. The two can land on the same number —
    // the script is the ceiling and a warning cannot buy seconds there is
    // nothing to say in — but the flag has to be visible in what was asked for.
    const unflagged = recommendExplainerSeconds({ ...denseBill, flags: [] });
    const flagged = recommendExplainerSeconds(denseBill);

    expect(flagged.seconds).toBeGreaterThanOrEqual(unflagged.seconds);
    expect(flagged.evidence.find((item) => item.signal === "urgent_flags")?.seconds).toBeGreaterThan(0);
    expect(flagged.reasons.join(" ")).toMatch(/urgent/i);
    expect(unflagged.reasons.join(" ")).not.toMatch(/urgent/i);
  });

  it("recommends a length the segmenter can cut without a stub clip", () => {
    for (const analysis of [thinLabResult, denseBill, overlongEverything, emptyAnalysis]) {
      const recommendation = recommendExplainerSeconds(analysis);
      const segments = planFluxSegments(analysis, recommendation.seconds);

      // The render count shown beside the proposal is the render count it buys.
      expect(segments).toHaveLength(recommendation.segments);
      expect(segmentsForExplainerSeconds(recommendation.seconds)).toBe(recommendation.segments);

      const durations = segments.map((segment) => segment.durationSeconds);
      expect(durations.reduce((total, seconds) => total + seconds, 0)).toBe(recommendation.seconds);
      for (const duration of durations) {
        // Flux refuses anything under five seconds, so a stub clip would fail the
        // whole explainer on its last render after the earlier ones were billed.
        expect(duration).toBeGreaterThanOrEqual(FLUX_MIN_CLIP_SECONDS);
        expect(duration).toBeLessThanOrEqual(FLUX_MAX_CLIP_SECONDS);
      }
    }
  });

  it("holds the ceiling however much the document has to say", () => {
    const recommendation = recommendExplainerSeconds(overlongEverything);

    expect(recommendation.seconds).toBe(FLUX_MAX_CHAINED_SEGMENTS * FLUX_MAX_CLIP_SECONDS);
    expect(recommendation.segments).toBe(FLUX_MAX_CHAINED_SEGMENTS);
    expect(recommendation.maxSeconds).toBe(FLUX_MAX_CHAINED_SEGMENTS * FLUX_MAX_CLIP_SECONDS);
  });

  it("holds the floor when there is nothing to say at all", () => {
    const recommendation = recommendExplainerSeconds(emptyAnalysis);

    expect(recommendation.seconds).toBe(FLUX_MIN_CLIP_SECONDS);
    expect(recommendation.segments).toBe(1);
    expect(recommendation.minSeconds).toBe(FLUX_MIN_CLIP_SECONDS);
  });

  it("never proposes a length outside the window a caller is allowed to ask for", () => {
    for (const analysis of [thinLabResult, denseBill, overlongEverything, emptyAnalysis]) {
      const recommendation = recommendExplainerSeconds(analysis);
      expect(recommendation.seconds).toBeGreaterThanOrEqual(FLUX_MIN_CLIP_SECONDS);
      expect(recommendation.seconds).toBeLessThanOrEqual(FLUX_MAX_CHAINED_SEGMENTS * FLUX_MAX_CLIP_SECONDS);
      expect(recommendation.segments).toBeGreaterThanOrEqual(1);
      expect(recommendation.segments).toBeLessThanOrEqual(FLUX_MAX_CHAINED_SEGMENTS);
    }
  });

  it("says why, whenever it is asking for more than one render", () => {
    // A reader being asked to spend their whole free allowance on four renders
    // is owed the reason, in words, before they agree to it.
    for (const analysis of [thinLabResult, denseBill, overlongEverything, emptyAnalysis]) {
      const recommendation = recommendExplainerSeconds(analysis);
      if (recommendation.segments === 1) continue;

      expect(recommendation.reasons.length).toBeGreaterThan(0);
      for (const reason of recommendation.reasons) {
        expect(reason.trim().length).toBeGreaterThan(0);
      }
      // Best first: the reasons are ordered by what they actually bought.
      const seconds = [...recommendation.evidence].sort((first, second) => second.seconds - first.seconds);
      expect(recommendation.reasons[0]).toBe(seconds[0].reason);
    }
  });

  it("reads a saved analysis with no adapter in between", () => {
    // Typed as the full ClaritiAnalysis on purpose: the workspace holds one of
    // those, and a recommendation it has to convert for is a recommendation the
    // caller will get wrong.
    const saved: ClaritiAnalysis = { ...denseBill, flags: denseBill.flags ?? [] };
    const recommendation = recommendExplainerSeconds(saved);

    expect(recommendation.segments).toBeGreaterThanOrEqual(1);
    expect(recommendation.reasons.length).toBeGreaterThan(0);
  });
});

describe("segmentsForExplainerSeconds", () => {
  it("prices a length the person shortened for themselves", () => {
    expect(segmentsForExplainerSeconds(20)).toBe(1);
    expect(segmentsForExplainerSeconds(21)).toBe(2);
    expect(segmentsForExplainerSeconds(40)).toBe(2);
    expect(segmentsForExplainerSeconds(45)).toBe(3);
    expect(segmentsForExplainerSeconds(80)).toBe(4);
  });
});
