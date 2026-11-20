import { describe, expect, it } from "vitest";
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
