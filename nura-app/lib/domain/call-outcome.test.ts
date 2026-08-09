import { describe, expect, it } from "vitest";
import { decideCallOutcome, MAX_VOICE_ATTEMPTS } from "./call-outcome";

const connected = { status: "done", callSuccessful: "success", durationSecs: 42, hasTranscript: true };

describe("decideCallOutcome", () => {
  it("treats a real conversation as connected", () => {
    expect(decideCallOutcome(connected, false)).toEqual({ kind: "connected" });
  });

  it("does not count voicemail/declined pickup as connected even though status is done", () => {
    const voicemail = { status: "done", callSuccessful: "success", durationSecs: 3, hasTranscript: false };
    expect(decideCallOutcome(voicemail, false)).toEqual({ kind: "not_connected", reason: "The call wasn't answered." });
  });

  it("does not count a short call with no transcript as connected", () => {
    const declined = { status: "done", callSuccessful: null, durationSecs: 2, hasTranscript: false };
    expect(decideCallOutcome(declined, false)).toEqual({ kind: "not_connected", reason: "The call wasn't answered." });
  });

  it("treats an explicit failure as not connected regardless of duration", () => {
    const failed = { status: "done", callSuccessful: "failure", durationSecs: 30, hasTranscript: true };
    expect(decideCallOutcome(failed, false)).toEqual({ kind: "not_connected", reason: "The call wasn't answered." });
  });

  it("is pending while still ringing/in-progress and not yet stuck", () => {
    expect(decideCallOutcome({ status: "initiated", callSuccessful: null, durationSecs: 0, hasTranscript: false }, false)).toEqual({
      kind: "pending",
    });
    expect(decideCallOutcome({ status: "in-progress", callSuccessful: null, durationSecs: 0, hasTranscript: false }, false)).toEqual({
      kind: "pending",
    });
  });

  it("escalates a stuck in-progress call once the timeout has elapsed", () => {
    expect(decideCallOutcome({ status: "in-progress", callSuccessful: null, durationSecs: 0, hasTranscript: false }, true)).toEqual({
      kind: "not_connected",
      reason: "The call never connected.",
    });
  });

  it("treats a missing outcome as pending until stuck, then not-connected", () => {
    expect(decideCallOutcome(null, false)).toEqual({ kind: "pending" });
    expect(decideCallOutcome(null, true)).toEqual({
      kind: "not_connected",
      reason: "Could not confirm the call's outcome.",
    });
  });

  it("is pending while processing and not yet stuck, then not-connected once stuck", () => {
    const processing = { status: "processing", callSuccessful: null, durationSecs: 0, hasTranscript: false };
    expect(decideCallOutcome(processing, false)).toEqual({ kind: "pending" });
    expect(decideCallOutcome(processing, true)).toEqual({
      kind: "not_connected",
      reason: "Call ended but the outcome never finished processing.",
    });
  });

  it("reports an explicit provider failure status distinctly from a plain no-answer", () => {
    const providerFailed = { status: "failed", callSuccessful: null, durationSecs: 0, hasTranscript: false };
    expect(decideCallOutcome(providerFailed, false)).toEqual({ kind: "not_connected", reason: "The call failed to connect." });
  });

  it("caps voice attempts at first-attempt + one redial", () => {
    expect(MAX_VOICE_ATTEMPTS).toBe(2);
  });
});
