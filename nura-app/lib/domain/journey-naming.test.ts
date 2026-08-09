import { describe, expect, it } from "vitest";
import {
  displayJourneyFocus,
  inferJourneyDraft,
  isUsefulDisplayText,
  normalizeJourneyTitle,
} from "./journey-naming";

describe("normalizeJourneyTitle", () => {
  it("rejects vague titles", () => {
    expect(normalizeJourneyTitle("Watch and Follow-Up", "Headaches & sleep")).toBe("Headaches & sleep");
    expect(normalizeJourneyTitle("Stabilise My Week", "Clinic follow-up")).toBe("Clinic follow-up");
  });

  it("keeps specific titles", () => {
    expect(normalizeJourneyTitle("Headaches & night tablet", "fallback")).toBe("Headaches & night tablet");
  });
});

describe("display helpers", () => {
  it("rejects thin greetings as display text", () => {
    expect(isUsefulDisplayText("Hi")).toBe(false);
    expect(isUsefulDisplayText("hello!")).toBe(false);
    expect(displayJourneyFocus("Hi", "Keep recovery steady.")).toBe("Keep recovery steady.");
    expect(displayJourneyFocus("Recovery, feeding, and mood this week", "fallback")).toBe(
      "Recovery, feeding, and mood this week",
    );
  });
});

describe("inferJourneyDraft", () => {
  it("detects medication context", () => {
    const draft = inferJourneyDraft("Started amitriptyline 10mg at night");
    expect(draft.category).toBe("medication_follow_through");
    expect(draft.title.toLowerCase()).toMatch(/medication|tablet|night/i);
  });

  it("detects pregnancy / postpartum context", () => {
    const draft = inferJourneyDraft("I’m postpartum and struggling with breastfeeding and recovery");
    expect(draft.category).toBe("postpartum_aftercare");
  });

  it("detects pregnancy context", () => {
    const draft = inferJourneyDraft("I’m pregnant and want help remembering antenatal appointment advice");
    expect(draft.category).toBe("postpartum_aftercare");
  });

  it("detects occupational stress", () => {
    const draft = inferJourneyDraft("Work stress and night shift burnout are wiping me out");
    expect(draft.category).toBe("occupational_stress");
  });

  it("does not treat 'spilling' as a medication mention", () => {
    const draft = inferJourneyDraft(
      "I’ve been feeling overwhelmed lately and it’s spilling into sleep, work, and how I look after myself.",
    );
    expect(draft.category).not.toBe("medication_follow_through");
  });

  it("does not treat 'pillow' as a medication mention", () => {
    const draft = inferJourneyDraft("Tossing and turning on my pillow all night, can't sleep");
    expect(draft.category).not.toBe("medication_follow_through");
  });
});
