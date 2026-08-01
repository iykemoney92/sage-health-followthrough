import { describe, expect, it } from "vitest";
import {
  fallbackNextCheckIn,
  parseJourneyCreateCheckIn,
  parseJourneyCreatePlanFields,
} from "./journey-create";

describe("fallbackNextCheckIn", () => {
  it("schedules in the future without a fixed tomorrow 19:30 rule", () => {
    const before = Date.now();
    const checkIn = fallbackNextCheckIn("whatsapp", "How are things going?", 2);
    const when = new Date(checkIn.when).getTime();
    expect(when).toBeGreaterThan(before);
    expect(checkIn.channel).toBe("whatsapp");
    expect(checkIn.prompt.length).toBeGreaterThan(0);

    const hour = new Date(checkIn.when).getHours();
    // Soft evening-ish window from helper — not locked to 19:30.
    expect(hour).toBeGreaterThanOrEqual(18);
    expect(hour).toBeLessThanOrEqual(19);
  });

  it("varies daysAhead", () => {
    const a = fallbackNextCheckIn("in_app", "Check in", 2);
    const b = fallbackNextCheckIn("in_app", "Check in", 3);
    expect(new Date(b.when).getTime()).toBeGreaterThan(new Date(a.when).getTime());
  });
});

describe("parseJourneyCreatePlanFields", () => {
  it("accepts valid agent plan JSON", () => {
    const parsed = parseJourneyCreatePlanFields(
      {
        title: "Evening meds follow-through",
        category: "medication_follow_through",
        whyThisExists: "Started a new tablet and wants gentle reminders.",
        currentFocus: "Taking the evening dose consistently.",
        nextStep: "Check how the first few nights go.",
      },
      {
        title: "fallback",
        category: "general_health",
        whyThisExists: "x",
        currentFocus: "y",
        nextStep: "z",
      },
    );
    expect(parsed.title).toBe("Evening meds follow-through");
    expect(parsed.category).toBe("medication_follow_through");
  });

  it("falls back when malformed", () => {
    const fallback = {
      title: "Post-clinic BP watch",
      category: "gp_follow_up" as const,
      whyThisExists: "GP asked to track readings.",
      currentFocus: "Home BP log",
      nextStep: "Share a few readings",
    };
    expect(parseJourneyCreatePlanFields({ title: "" }, fallback)).toEqual(fallback);
  });
});

describe("parseJourneyCreateCheckIn", () => {
  const fallback = fallbackNextCheckIn("whatsapp", "Default prompt", 2);

  it("keeps agent when/prompt and clamps channel to allowed list", () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const parsed = parseJourneyCreateCheckIn(
      { when: future, prompt: "How was the walk today?", channel: "voice" },
      ["whatsapp", "in_app"],
      fallback,
    );
    expect(parsed.prompt).toBe("How was the walk today?");
    expect(parsed.channel).toBe("whatsapp");
    expect(parsed.when).toBe(future);
  });

  it("rejects past when and uses fallback timing", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const parsed = parseJourneyCreateCheckIn(
      { when: past, prompt: "Still useful prompt", channel: "in_app" },
      ["in_app"],
      fallback,
    );
    expect(parsed.prompt).toBe("Still useful prompt");
    expect(new Date(parsed.when).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});
