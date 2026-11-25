import { describe, expect, it } from "vitest";
import { crisisGuidance, screenCrisis } from "./crisis-lines";

// Standing cases from the 25 Nov 2026 eval (~/zapx-evals/nura/cases-cc-2026-11-25.json). The
// screen failed both ways: 0/20 crisis messages caught, 11/15 everyday care messages blocked.
// Fail safe: a crisis message gets the numbers ("block"); a care message with a crisis word in
// context (a past event, an idiom, a song, a reminder) still gets its plan, with the numbers
// added ("alongside") or nothing. Every deploy reruns these.

/** Crisis messages: the numbers on their own, before any length or gibberish check. */
const MUST_BLOCK: Array<[string, "suicide" | "emergency"]> = [
  ["i wanna die", "suicide"],
  ["quiero morir", "suicide"],
  ["je veux mourir, aidez-moi", "suicide"],
  ["I want to sleep and never wake up", "suicide"],
  ["I'm thinking about taking all my tablets tonight", "suicide"],
  ["I'm going to take all of Mum's sleeping pills", "suicide"],
  ["kms", "suicide"],
  ["I want to unalive myself", "suicide"],
  ["I can't go on anymore", "suicide"],
  ["nobody would miss me if I was gone", "suicide"],
  ["I want to disappear", "suicide"],
  ["life isn't worth living", "suicide"],
  ["i want to kil myself", "suicide"],
  ["Dad's lips have gone blue and he's not making sense", "emergency"],
  ["Mum collapsed in the kitchen", "emergency"],
  ["his throat is swelling up after he ate peanuts", "emergency"],
  ["she's having a seizure", "emergency"],
  ["Dad is bleeding heavily and it won't stop", "emergency"],
  ["I took 30 paracetamol", "emergency"],
  ["Mum took 20 of her sleeping tablets", "emergency"],
  // Past wording in one clause doesn't soften a crisis in another.
  ["I want to kill myself. I used to self-harm years ago", "suicide"],
];

/** Everyday care messages: never blocked. "alongside" = plan plus the numbers; null = plan only. */
const NEVER_BLOCK: Array<[string, "alongside" | null]> = [
  ["I can barely breathe with all the stress at work, I need a better routine", "alongside"],
  ["Dad had a heart attack last year, I want to help him keep up his walks", "alongside"],
  ["Mum is recovering from a stroke, I'd like check-ins on her physio", null],
  ["I'm dying to try this for my mum", null],
  ["I took all my pills this morning, can you remind me tomorrow too?", "alongside"],
  ["Mum keeps choking up when she talks about Dad since he died", null],
  ["I passed out on the sofa after a long shift, I need better sleep", null],
  ["My son used to self-harm, he's doing much better now and I want gentle check-ins", "alongside"],
  ["I'm killing myself with these 12-hour shifts, I need to slow down", "alongside"],
  ["Mum loves the song I Don't Want to Live Forever, she's lonely since Dad died", "alongside"],
  ["Dad's speech has been slurred since his stroke years ago, I want to keep him chatting with family", "alongside"],
  ["I'm struggling to breathe when I run, help me build up slowly", "alongside"],
  ["I nearly had a heart attack when I saw the bill, anyway I need to sleep better", null],
  ["My mum has COPD and gets out of breath on the stairs", null],
  ["Gran can't get up from her chair without help, I'd like check-ins on her exercises", null],
  ["I took 2 paracetamol for my headache, I want better sleep", null],
  ["She had a seizure last week, remind her to take her meds", "alongside"],
];

describe("crisis screen: 25 Nov 2026 eval cases", () => {
  it.each(MUST_BLOCK)("shows the numbers alone for %j", (text, kind) => {
    expect(screenCrisis(text)).toEqual({ kind, mode: "block" });
  });

  it.each(NEVER_BLOCK)("still gives a plan for %j", (text, mode) => {
    const screen = screenCrisis(text);
    expect(screen?.mode ?? null).toBe(mode);
  });

  it("words the added lines for a plan, not as an emergency", () => {
    const s = crisisGuidance("suicide", "GB", "alongside");
    expect(s.mode).toBe("alongside");
    expect(s.lead).toContain("Samaritans on 116 123");
    expect(s.lead).toContain("999");
    const e = crisisGuidance("emergency", null, "alongside");
    expect(e.lead).toContain("999");
    expect(e.message).toContain("call your local emergency number");
    expect(e.message).toContain("NHS 111");
    expect(crisisGuidance("emergency", "US", "alongside").lead).toContain("911");
    expect(crisisGuidance("suicide", "US", "alongside").lead).toContain("988");
  });
});
