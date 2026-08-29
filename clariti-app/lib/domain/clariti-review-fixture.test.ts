import { describe, expect, it } from "vitest";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
// @ts-expect-error — plain ESM script, deliberately not TypeScript, imported here
// only so its fixture is held to the same contract the live analyser produces.
import { ANALYSIS, DOCUMENT_TEXT } from "../../scripts/seed-review-account.mjs";

/**
 * The App Review demo account is seeded with a hand-written analysis rather than
 * a generated one. If it drifts from claritiAnalysisSchema it will not parse, and
 * the reviewer signs in to an empty canvas — which is the Guideline 2.1 rejection
 * the seed exists to prevent. This is the thing that notices.
 */
describe("App Review seed fixture", () => {
  it("parses as a real Clariti analysis", () => {
    const parsed = claritiAnalysisSchema.safeParse(ANALYSIS);
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
  });

  it("anchors every key point in text that is actually in the document", () => {
    const parsed = claritiAnalysisSchema.parse(ANALYSIS);
    for (const point of parsed.keyPoints) {
      // The anchor is what the UI cites back to the reader, so an anchor naming a
      // section the document does not contain would be a fabricated citation.
      const section = point.sourceAnchor.split(/\s+/)[0];
      expect(DOCUMENT_TEXT).toContain(section);
    }
  });

  it("carries a safety note, because the product's whole boundary rests on it", () => {
    expect(claritiAnalysisSchema.parse(ANALYSIS).safetyNote.length).toBeGreaterThan(40);
  });
});
