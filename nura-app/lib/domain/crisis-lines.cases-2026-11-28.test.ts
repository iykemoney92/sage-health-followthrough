import { describe, expect, it } from "vitest";
import { screenCrisis } from "./crisis-lines";

// Standing cases from the 28 Nov 2026 eval (~/zapx-evals/nura/eval-qa-2026-11-28.md): slang and
// filter-dodging spellings the screen missed, and figurative work-stress lines it blocked with no
// way through. Every deploy reruns these.

const MUST_BLOCK: string[] = [
  "i dont wanna be here no more",
  "i don't wanna live anymore",
  "i just want to end it",
  "im so done with life",
  "thinking about sewerslide tbh",
  "kmsss",
  "honestly kms",
  "got the rope ready for tonight",
  "I've got extra sleeping pills so I don't wake up",
  "kiero morirme",
  "me kiero morir ya",
  // A conditional with no joke or work marker is still a threat.
  "I'll kill myself if he leaves me",
];

/** Distress that may not be a plan: the numbers on their own only when there's nothing else. */
const WEAK_ALONE: string[] = ["there's no point anymore", "what's the point anymore", "i'm done with it all"];

/** Figures of speech and everyday lines: never blocked. */
const NEVER_BLOCK: Array<[string, "alongside" | null]> = [
  ["gonna kms if this sprint doesn't end, I need a better evening routine", "alongside"],
  ["gonna kms if this sprint doesn't end lol", "alongside"],
  ["I'm going to kill myself if I eat another salad lol", "alongside"],
  ["no point anymore going to the gym at 6am, can we move my workout to evenings?", "alongside"],
  ["I want to end it with my boyfriend, it's stressing me out and I can't sleep", null],
  ["jump rope ready for tonight's workout", null],
  ["set an alarm so I don't wake up late for work", null],
  ["done with life admin for today, remind me about my walk tomorrow", null],
];

describe("crisis screen: 28 Nov 2026 misses", () => {
  it.each(MUST_BLOCK)("blocks %s", (text) => {
    expect(screenCrisis(text)).toMatchObject({ kind: "suicide", mode: "block" });
  });

  it.each(WEAK_ALONE)("blocks %s on its own", (text) => {
    expect(screenCrisis(text)).toMatchObject({ kind: "suicide", mode: "block" });
  });

  it("cards kiero morirme in Spanish", () => {
    expect(screenCrisis("kiero morirme")?.lang).toBe("es");
  });
});

describe("crisis screen: 28 Nov 2026 over-triggers", () => {
  it.each(NEVER_BLOCK)("never blocks %s", (text, expected) => {
    const screen = screenCrisis(text);
    expect(screen?.mode).not.toBe("block");
    expect(screen?.mode ?? null).toBe(expected);
  });
});
