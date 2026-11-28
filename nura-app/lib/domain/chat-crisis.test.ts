import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCrisisCountry, replyHasHelp, screenChatMessage, withCrisisLines } from "./chat-crisis";
import { AI_UNAVAILABLE_REPLY, resolveDecision } from "./message-intake";

// 28 Nov 2026 eval: signed-in chat and WhatsApp had no code crisis screen. The same screen as
// try-first now runs in resolveDecision, before the model, on every channel that uses it.

describe("chatCrisisCountry", () => {
  it("uses the phone's country code first", () => {
    expect(chatCrisisCountry("+447700900123", "America/New_York")).toBe("GB");
    expect(chatCrisisCountry("14155550123", null)).toBe("US");
  });
  it("falls back to the time zone, then unknown", () => {
    expect(chatCrisisCountry(null, "Europe/London")).toBe("GB");
    expect(chatCrisisCountry(null, "Australia/Sydney")).toBe("AU");
    expect(chatCrisisCountry(null, "Asia/Tokyo")).toBeNull();
    expect(chatCrisisCountry(null, null)).toBeNull();
  });
});

describe("screenChatMessage", () => {
  it("skips the model for a suicide statement, with UK numbers for a UK phone", () => {
    const crisis = screenChatMessage("i dont wanna be here no more", "+447700900123", "Europe/London");
    expect(crisis?.modelSkipped).toBe(true);
    expect(crisis?.guidance.lead).toContain("116 123");
  });
  it("runs the model for an emergency, numbers first", () => {
    const crisis = screenChatMessage("Mum collapsed in the kitchen", "+447700900123", "Europe/London");
    expect(crisis?.modelSkipped).toBe(false);
    expect(withCrisisLines("I'm here with you.", crisis).startsWith(crisis!.guidance.title)).toBe(true);
  });
  it("adds the lines after a figurative work-stress reply", () => {
    const crisis = screenChatMessage("gonna kms if this sprint doesn't end lol", null, "Europe/London");
    expect(crisis?.guidance.mode).toBe("alongside");
    const reply = withCrisisLines("Sprints are rough. Want a wind-down routine?", crisis);
    expect(reply).toMatch(/^Sprints are rough/);
    expect(reply).toContain("116 123");
  });
  it("answers Spanish in Spanish", () => {
    expect(screenChatMessage("kiero morirme", "+34600123456", null)?.guidance.lang).toBe("es");
  });
  it("ignores everyday messages", () => {
    expect(screenChatMessage("can you remind me to stretch after work?", null, null)).toBeNull();
  });
});

describe("replyHasHelp", () => {
  it("spots a number the model already gave", () => {
    expect(replyHasHelp("Please call Samaritans on 116123 now.", "GB")).toBe(true);
    expect(replyHasHelp("Call 999 now.", "GB")).toBe(true);
    expect(replyHasHelp("Let's plan your week.", "GB")).toBe(false);
    expect(replyHasHelp("Your code is 49991.", "GB")).toBe(false);
  });
});

describe("resolveDecision runs the screen before the model", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("WhatsApp suicide statement: numbers only, no plan change", async () => {
    const decision = await resolveDecision("kmsss", [], [], [], null, [], "447700900123", [], [], "whatsapp", ["whatsapp"], "Europe/London");
    expect(decision.reply).toContain("116 123");
    expect(decision.reply).not.toBe(AI_UNAVAILABLE_REPLY);
    expect(decision).toMatchObject({ action: "none", new_plan: null, next_check_in: null });
  });

  it("in-app, signed in, keeps the plan the person is in", async () => {
    const plan = { id: "p1", title: "Sleep", current_focus: null };
    const decision = await resolveDecision("im so done with life", [plan], [], [], plan, [], null, [], [], "in_app", ["in_app"], "Europe/London");
    expect(decision).toMatchObject({ action: "existing_plan", plan_id: "p1" });
    expect(decision.reply).toContain("Samaritans");
  });

  it("an outage reply still carries the numbers for an alongside message", async () => {
    const decision = await resolveDecision("gonna kms if this sprint doesn't end lol", [], [], [], null, [], null, [], [], "in_app", ["in_app"], "Europe/London");
    expect(decision.reply.startsWith(AI_UNAVAILABLE_REPLY)).toBe(true);
    expect(decision.reply).toContain("116 123");
  });

  it("leaves everyday messages alone", async () => {
    const decision = await resolveDecision("remind me to drink water", [], [], [], null, [], null, [], [], "in_app", ["in_app"], "Europe/London");
    expect(decision.reply).toBe(AI_UNAVAILABLE_REPLY);
  });
});
