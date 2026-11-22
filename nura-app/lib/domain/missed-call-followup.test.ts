import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/ai/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/claude")>();
  return { ...actual, claudeClient: () => ({ messages: { create } }) };
});

import { composeMissedCallFollowup, followupBlamesPerson, missedCallFallbackText } from "./message-intake";

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
    expect(text).toBe(missedCallFallbackText("Sam", "ask how sleep has been", "platform_failure"));
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
