import { describe, expect, it } from "vitest";
import { CRISIS_NUMBERS, type CrisisCountry } from "@/lib/domain/crisis-lines";
import { NURA_CORE_IDENTITY, NURA_SAFETY_BOUNDARIES } from "@/lib/domain/nura-persona";
import { NO_CIRCLE_PASS_ON } from "@/lib/domain/voice-checkin-context";
// @ts-expect-error - plain .mjs script, no types
import * as sync from "../../scripts/sync-elevenlabs-agent.mjs";

describe("voice agent prompt (scripts/sync-elevenlabs-agent.mjs)", () => {
  it("carries the same identity and safety text as the text pipeline", () => {
    expect(sync.NURA_CORE_IDENTITY).toBe(NURA_CORE_IDENTITY);
    expect(sync.NURA_SAFETY_BOUNDARIES).toBe(NURA_SAFETY_BOUNDARIES);
    expect(sync.VOICE_PROMPT).toContain(NURA_SAFETY_BOUNDARIES);
  });

  it("names the UK numbers and puts them first", () => {
    for (const text of ["999", "NHS 111", "Samaritans on 116 123", "FIRST sentence", "stockpiling tablets", "head injury"]) {
      expect(NURA_SAFETY_BOUNDARIES).toContain(text);
    }
    expect(NURA_SAFETY_BOUNDARIES).not.toMatch(/contact local emergency services/);
  });

  it("gives US and Canada callers 988, not just 911 (22 Nov 2026 eval)", () => {
    expect(NURA_SAFETY_BOUNDARIES).toContain("US and Canada - call or text 988 for suicidal thoughts, 911 in an emergency");
    expect(NURA_SAFETY_BOUNDARIES).toContain("If the call brief");
  });

  // 26 Nov 2026 non-English safety check: "Always say the actual number - never just local
  // emergency services" pushed the model to say 999 to someone in Brazil or Indonesia.
  it("replies in the person's language and never gives a UK or US number to someone clearly elsewhere", () => {
    expect(NURA_SAFETY_BOUNDARIES).not.toContain("Always say the actual number - never just");
    expect(NURA_SAFETY_BOUNDARIES).toContain("reply in the language the person is writing or speaking in");
    expect(NURA_SAFETY_BOUNDARIES).toContain("never give a UK or US number and never give a number from memory");
    expect(NURA_SAFETY_BOUNDARIES).toContain("call your local emergency number now");
    expect(NURA_SAFETY_BOUNDARIES).toContain("findahelpline.com");
  });

  it("lists every verified country with the same numbers as the try-first cards", () => {
    for (const code of Object.keys(CRISIS_NUMBERS) as CrisisCountry[]) {
      const { emergency, line } = CRISIS_NUMBERS[code];
      const spoken = (n: string) => n.replace("ext. ", "extension ");
      expect(NURA_SAFETY_BOUNDARIES, `${code} emergency`).toContain(code === "CA" ? "911" : emergency[0]);
      if (line) expect(NURA_SAFETY_BOUNDARIES, `${code} line`).toContain(code === "CA" ? "988" : spoken(line.number));
    }
  });

  it("says Care plan, not Journey, and caps spoken turns", () => {
    expect(sync.VOICE_PROMPT).not.toMatch(/\bJourney (name|purpose)\b|also called Journeys/);
    expect(sync.VOICE_PROMPT).toContain("about 30 words");
    expect(sync.DYNAMIC_VARIABLE_PLACEHOLDERS.circle_pass_on).toBe(NO_CIRCLE_PASS_ON);
  });

  it("confirms who picked up before anything personal", () => {
    expect(sync.FIRST_MESSAGE).not.toMatch(/thread_title|user_name/);
    expect(sync.VOICE_PROMPT).toContain("Say nothing about health, medicines, the Care plan or why you're calling until the person confirms");
    expect(sync.VOICE_PROMPT).toContain("never a reason to use stop_calls");
  });
});
