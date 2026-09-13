import { afterEach, describe, expect, it } from "vitest";
import {
  buildFluxSegmentPrompt,
  classifyContinuation,
  formatHumanVideoError,
  FLUX_VIDEO_MODEL,
  isFluxVideoModel,
  normalizeVideoDuration,
  planFluxSegments,
  readReportedDuration,
  videoResolutionFor,
  type ClaritiVideoAnalysis,
} from "./clariti-video";

const VEO_MODEL = "google/veo-3.1-generate-001";

const analysis: ClaritiVideoAnalysis = {
  kind: "radiology_report",
  title: "MRI lumbar spine",
  summary: "the scan describes a small disc bulge at L4-L5",
  plainEnglish: "A cushion between two bones in your lower back is pushing out a little.",
  sourceAnchors: ["Findings", "Impression"],
  keyPoints: [
    { label: "Main finding", detail: "a small disc bulge at L4-L5", sourceAnchor: "Findings" },
    { label: "Nerve space", detail: "the nerve openings look narrowed on the left", sourceAnchor: "Impression" },
  ],
  metrics: [{ label: "Report type", value: "MRI lumbar spine without contrast" }],
  questions: ["Does this finding explain the pain I have been having?"],
  nextActions: ["Bring this report to your next appointment."],
  safetyNote: "This is an explanation of the report wording, not a diagnosis.",
};

describe("normalizeVideoDuration", () => {
  it("clamps a Flux clip into the 5 to 20 second window", () => {
    // Four seconds is a legal Veo length and an illegal Flux one, so the old
    // 4/6/8 rounding would have passed the model a duration it rejects.
    expect(normalizeVideoDuration(FLUX_VIDEO_MODEL, 4)).toBe(5);
    expect(normalizeVideoDuration(FLUX_VIDEO_MODEL, 7)).toBe(7);
    expect(normalizeVideoDuration(FLUX_VIDEO_MODEL, 20)).toBe(20);
    expect(normalizeVideoDuration(FLUX_VIDEO_MODEL, 25)).toBe(20);
  });

  it("still snaps Veo to 4, 6 or 8", () => {
    expect(normalizeVideoDuration(VEO_MODEL, 3)).toBe(4);
    expect(normalizeVideoDuration(VEO_MODEL, 5)).toBe(6);
    expect(normalizeVideoDuration(VEO_MODEL, 7)).toBe(8);
    expect(normalizeVideoDuration(VEO_MODEL, 30)).toBe(8);
  });
});

describe("isFluxVideoModel", () => {
  it("recognises the gateway's Flux video id and nothing else", () => {
    expect(isFluxVideoModel("bfl/flux-3-video")).toBe(true);
    expect(isFluxVideoModel(" bfl/flux-3-video ")).toBe(true);
    expect(isFluxVideoModel("google/veo-3.1-generate-001")).toBe(false);
    expect(isFluxVideoModel("google/veo-3.1-fast-generate-001")).toBe(false);
    expect(isFluxVideoModel("")).toBe(false);
  });
});

describe("planFluxSegments", () => {
  it("covers a twenty-second explainer in one call", () => {
    const segments = planFluxSegments(analysis, 20);
    expect(segments).toHaveLength(1);
    expect(segments[0].durationSeconds).toBe(20);
    expect(segments[0].sceneIndex).toBe(0);
    expect(segments[0].status).toBe("queued");
    expect(segments[0].narration.length).toBeGreaterThan(0);
  });

  it("rebalances rather than leaving a tail the model would reject", () => {
    // Greedy packing would emit 20 + 2. Flux refuses anything under five
    // seconds, so the whole explainer would fail on its last clip.
    const segments = planFluxSegments(analysis, 22);
    expect(segments.map((segment) => segment.durationSeconds)).toEqual([11, 11]);

    const long = planFluxSegments(analysis, 45);
    expect(long).toHaveLength(3);
    expect(long.reduce((total, segment) => total + segment.durationSeconds, 0)).toBe(45);
    for (const segment of long) {
      expect(segment.durationSeconds).toBeGreaterThanOrEqual(5);
      expect(segment.durationSeconds).toBeLessThanOrEqual(20);
    }
    expect(long.map((segment) => segment.sceneIndex)).toEqual([0, 1, 2]);
  });
});

describe("buildFluxSegmentPrompt", () => {
  const [segment] = planFluxSegments(analysis, 20);

  it("asks for the whole arc when the segment stands alone", () => {
    const prompt = buildFluxSegmentPrompt(analysis, segment, { isContinuation: false });
    expect(prompt).toContain("This shot is the whole explainer");
    expect(prompt).toContain("Ask: Does this finding explain the pain I have been having?");
    expect(prompt).not.toMatch(/continue|continuation/i);
  });

  it("tells the model it is continuing the supplied clip", () => {
    const prompt = buildFluxSegmentPrompt(analysis, { ...segment, sceneIndex: 1 }, { isContinuation: true });
    expect(prompt).toContain("continues the video supplied as a reference");
    expect(prompt).toContain("same presenter");
    expect(prompt).toContain("mid-explanation");
    expect(prompt).toContain("Segment 2");
  });

  it("does not tell the opener of a chain to close the explainer out", () => {
    // An opener that signs off at second twenty leaves the segments after it
    // continuing past an ending that has already happened — each of them billed
    // at video-to-video rates.
    const [opener] = planFluxSegments(analysis, 40);
    const prompt = buildFluxSegmentPrompt(analysis, opener, { isContinuation: false });
    expect(prompt).toContain("This shot opens the explainer");
    expect(prompt).not.toContain("This shot is the whole explainer");
    expect(prompt).toContain("Do not sign off");
  });
});

describe("segment narration", () => {
  it("is budgeted by how long the clip runs, not by how many characters it holds", () => {
    // A calm presenter speaks a little over two and a half words a second, so a
    // twenty-second clip cannot carry the whole five-beat storyboard: the same
    // prompt that hands over the script also tells the presenter not to rush.
    const [whole] = planFluxSegments(analysis, 20);
    const words = whole.narration.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThan(0);
    expect(words).toBeLessThanOrEqual(60);

    const [short] = planFluxSegments(analysis, 5);
    expect(short.narration.split(/\s+/).filter(Boolean).length).toBeLessThan(words);
  });

  it("ends on a sentence rather than an ellipsis the presenter has to read out", () => {
    for (const segment of planFluxSegments(analysis, 40)) {
      expect(segment.narration.endsWith("...")).toBe(false);
      expect(segment.narration.trim()).toMatch(/[.!?:]$/);
    }
  });

  it("keeps the closing question in the last segment of a chain", () => {
    const segments = planFluxSegments(analysis, 40);
    expect(segments[segments.length - 1].narration).toContain("Ask: Does this finding explain");
  });
});

describe("formatHumanVideoError", () => {
  it("reads a Shotstack payload as a stitch failure, not a failed continuation", () => {
    // Shotstack's own failure payloads say things like "invalid video asset",
    // which is also what a rejected reference clip looks like. The legacy path
    // has no previous clip, so the continuation wording would be a lie.
    expect(formatHumanVideoError(new Error("Shotstack render failed: invalid video asset")))
      .toBe("Clariti could not finish stitching the video scenes. Please try again.");
    expect(formatHumanVideoError(new Error("unsupported media type for video input")))
      .toBe("Clariti could not continue the video from the previous clip. Please try again.");
  });
});

describe("videoResolutionFor", () => {
  const original = process.env.CLARITI_VIDEO_RESOLUTION;
  afterEach(() => {
    if (original === undefined) delete process.env.CLARITI_VIDEO_RESOLUTION;
    else process.env.CLARITI_VIDEO_RESOLUTION = original;
  });

  it("stays at 720p unless fhd is asked for on a Flux model", () => {
    delete process.env.CLARITI_VIDEO_RESOLUTION;
    expect(videoResolutionFor(FLUX_VIDEO_MODEL)).toBe("1280x720");

    process.env.CLARITI_VIDEO_RESOLUTION = "fhd";
    expect(videoResolutionFor(FLUX_VIDEO_MODEL)).toBe("1920x1080");
    // The opt-in must not change what the legacy path costs per second.
    expect(videoResolutionFor(VEO_MODEL)).toBe("1280x720");
  });
});

describe("classifyContinuation", () => {
  it("separates a whole extended video from the new footage alone", () => {
    // Segment two of a 11 + 11 plan: eleven seconds is the continuation alone,
    // twenty-two is the whole explainer so far.
    expect(classifyContinuation(22, 11, 22)).toBe("extended");
    expect(classifyContinuation(11, 11, 22)).toBe("continuation");
  });

  it("claims nothing when there is nothing readable to judge", () => {
    expect(classifyContinuation(null, 11, 22)).toBe("unknown");
    expect(classifyContinuation(0, 11, 22)).toBe("unknown");
    expect(classifyContinuation(Number.NaN, 11, 22)).toBe("unknown");
    // Halfway between the two candidates is not evidence for either.
    expect(classifyContinuation(16.5, 11, 22)).toBe("unknown");
  });
});

describe("readReportedDuration", () => {
  it("finds a duration wherever the provider chose to put it", () => {
    expect(readReportedDuration({ duration: 20 })).toBe(20);
    expect(readReportedDuration({ bfl: { video: { duration_seconds: "12.5" } } })).toBe(12.5);
    expect(readReportedDuration({ meta: { videoDuration: 8 } })).toBe(8);
  });

  it("returns null rather than guessing", () => {
    expect(readReportedDuration(undefined)).toBeNull();
    expect(readReportedDuration({ cost: 3.4 })).toBeNull();
    expect(readReportedDuration({ duration: "soon" })).toBeNull();
    expect(readReportedDuration({ duration: -4 })).toBeNull();
  });
});
