import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/ai/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/claude")>();
  return { ...actual, claudeClient: () => ({ messages: { create } }) };
});

import {
  checkinOpenerFallback,
  composeCheckinOpener,
  composeMissedCallFollowup,
  followupBlamesPerson,
  leaksInternalNote,
  missedCallFallbackText,
} from "./message-intake";

const reply = (text: string) => ({ content: [{ type: "text", text }] });

beforeEach(() => {
  create.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("missed-call follow-up knows why the call didn't happen", () => {
  it("tells the model the call failed on Nura's side when it did", async () => {
    create.mockResolvedValue(reply("Sorry, my call didn't go through on my end. How has your sleep been?"));
    const text = await composeMissedCallFollowup("Sam", "Sleep routine", "ask how sleep has been", "platform_failure");
    expect(text).toBe("Sorry, my call didn't go through on my end. How has your sleep been?");
    const params = create.mock.calls[0][0];
    expect(params.system).toContain("problem on Nura's side");
    expect(params.system).toContain("never suggest it was a bad time");
    expect(params.system).not.toContain("went unanswered");
    expect(params.messages[0].content).toContain("What happened with the call: platform_failure");
  });

  it("never sends 'caught you at a bad time' when Nura's call failed (the 20 Nov message)", async () => {
    create.mockResolvedValue(reply("Hey Sam, might've caught you at a bad time! How are you doing?"));
    const text = await composeMissedCallFollowup("Sam", "Sleep routine", "ask how sleep has been", "platform_failure");
    expect(text).toBe(missedCallFallbackText("Sam", "Sleep routine", "platform_failure"));
    expect(text).toContain("didn't go through on my end");
    expect(text).not.toMatch(/bad time|couldn't reach you/i);
  });

  it("keeps the no-answer wording for a call the person really didn't pick up", async () => {
    create.mockResolvedValue(reply("Looks like I caught you at a bad time - how did today go?"));
    const text = await composeMissedCallFollowup("Sam", "Sleep routine", "ask how today went");
    expect(text).toBe("Looks like I caught you at a bad time - how did today go?");
    expect(create.mock.calls[0][0].system).toContain("went unanswered");
  });

  it("uses an honest fallback for each reason without the model", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await composeMissedCallFollowup("Sam", "P", "ask X", "platform_failure")).toContain("my call didn't go through on my end");
    expect(await composeMissedCallFollowup("Sam", "P", "ask X", "voicemail")).toContain("left you a quick voicemail");
    expect(await composeMissedCallFollowup("Sam", "P", "ask X")).toContain("couldn't reach you");
    expect(create).not.toHaveBeenCalled();
  });

  it("spots drafts that blame the person, only for platform failures", () => {
    for (const t of ["caught you at a bad time", "Sorry I couldn't reach you", "you missed my call", "you didn't pick up"]) {
      expect(followupBlamesPerson(t, "platform_failure")).toBe(true);
      expect(followupBlamesPerson(t, "no_answer")).toBe(false);
    }
    expect(followupBlamesPerson("My call didn't go through on my end, sorry.", "platform_failure")).toBe(false);
  });
});

// 22 Nov 2026 eval: the fallbacks pasted the internal note into the text the person gets.
const AMLODIPINE_NOTE = "ask whether she has managed her morning amlodipine this week and how the dizziness has been";

describe("texts never include the internal check-in note", () => {
  it("keeps the amlodipine note out of every missed-call fallback", () => {
    for (const reason of ["platform_failure", "voicemail", "no_answer"] as const) {
      const text = missedCallFallbackText("Margaret", "Morning tablets", reason);
      expect(text).not.toMatch(/amlodipine|ask whether|dizziness|\bshe\b/i);
      expect(text).toContain("how have things been with Morning tablets?");
    }
  });

  it("keeps it out when the model is unavailable", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const followup = await composeMissedCallFollowup("Margaret", "Morning tablets", AMLODIPINE_NOTE, "platform_failure");
    const opener = await composeCheckinOpener("Margaret", "Morning tablets", AMLODIPINE_NOTE);
    for (const text of [followup, opener]) {
      expect(text).not.toMatch(/amlodipine|ask whether|dizziness/i);
    }
    expect(opener).toBe("Hey Margaret, just checking in - how have things been with Morning tablets?");
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back when the model copies the note", async () => {
    create.mockResolvedValue(reply(`Hi Margaret! I wanted to ${AMLODIPINE_NOTE}.`));
    const opener = await composeCheckinOpener("Margaret", "Morning tablets", AMLODIPINE_NOTE);
    expect(opener).toBe(checkinOpenerFallback("Margaret", "Morning tablets"));
    create.mockResolvedValue(reply(`Sorry, my call didn't go through on my end. Internal note: ${AMLODIPINE_NOTE}`));
    const followup = await composeMissedCallFollowup("Margaret", "Morning tablets", AMLODIPINE_NOTE, "platform_failure");
    expect(followup).toBe(missedCallFallbackText("Margaret", "Morning tablets", "platform_failure"));
    expect(create.mock.calls[0][0].system).toContain("never copy it or quote it");
  });

  it("lets a natural opener through", async () => {
    create.mockResolvedValue(reply("Morning Margaret - how have the tablets been going this week?"));
    expect(await composeCheckinOpener("Margaret", "Morning tablets", AMLODIPINE_NOTE)).toBe(
      "Morning Margaret - how have the tablets been going this week?",
    );
    expect(leaksInternalNote("How's your sleep been?", "ask how sleep has been")).toBe(false);
  });

  it("asks a plain question when there's no plan name", () => {
    expect(checkinOpenerFallback("there", "your Care plan")).toBe("Hey, just checking in - how have things been?");
  });
});
