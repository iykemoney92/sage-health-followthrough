import { describe, expect, it } from "vitest";
import { backoffDecision, computeBackoff, pauseNote, PAUSE_ASKED, UNANSWERED_LIMIT } from "./outreach-backoff";
import { idleWellnessPrompt, pickFocusStep } from "./idle-wellness";

const ci = (owner: string, day: number, status: string) => ({
  owner_id: owner,
  triggered_at: `2026-11-${String(day).padStart(2, "0")}T08:00:00Z`,
  call_status: status,
});

describe("computeBackoff + backoffDecision", () => {
  it("keeps sending while fewer than the limit went unanswered", () => {
    const m = computeBackoff(["a"], [], [ci("a", 10, "sent_email"), ci("a", 11, "sent_email")]);
    expect(m.get("a")).toEqual({ unanswered: 2, asked: false });
    expect(backoffDecision(m.get("a"))).toBe("send");
  });

  it("asks once after the limit, then holds", () => {
    const sent = Array.from({ length: UNANSWERED_LIMIT }, (_, i) => ci("a", 10 + i, "sent_email"));
    expect(backoffDecision(computeBackoff(["a"], [], sent).get("a"))).toBe("ask");
    expect(backoffDecision(computeBackoff(["a"], [], [...sent, ci("a", 14, PAUSE_ASKED)]).get("a"))).toBe("hold");
  });

  it("a reply resets everything", () => {
    const sent = [ci("a", 10, "sent_email"), ci("a", 11, "missed_stale"), ci("a", 12, "sent_push"), ci("a", 13, PAUSE_ASKED)];
    const m = computeBackoff(["a"], [{ owner_id: "a", created_at: "2026-11-13T09:00:00Z" }], sent);
    expect(m.get("a")).toEqual({ unanswered: 0, asked: false });
    expect(backoffDecision(m.get("a"))).toBe("send");
  });

  it("a picked-up call counts as an answer", () => {
    const m = computeBackoff(["a"], [], [ci("a", 10, "sent_email"), ci("a", 11, "sent_email"), ci("a", 12, "completed"), ci("a", 13, "sent_email")]);
    expect(m.get("a")?.unanswered).toBe(1);
  });

  it("ignores outcomes that never reached them", () => {
    const m = computeBackoff(["a"], [], [ci("a", 10, "skipped_plus_required"), ci("a", 11, "failed"), ci("a", 12, "missed_undelivered")]);
    expect(m.get("a")?.unanswered).toBe(0);
  });

  it("keeps owners apart", () => {
    const m = computeBackoff(["a", "b"], [], [ci("a", 10, "sent_email"), ci("a", 11, "sent_email"), ci("a", 12, "sent_email")]);
    expect(backoffDecision(m.get("a"))).toBe("ask");
    expect(backoffDecision(m.get("b"))).toBe("send");
  });

  it("the pause note says how to restart", () => {
    expect(pauseNote("Ada")).toMatch(/^Hi Ada, .*pause.*Reply here any time/);
    expect(pauseNote("there")).toMatch(/^Hi, /);
  });
});

describe("varied idle check-ins", () => {
  it("rotates through the plan's steps", () => {
    const steps = ["Screen-free wind-down", "Bed by 11", "Morning walk"];
    expect([0, 1, 2, 3].map((n) => pickFocusStep(steps, n))).toEqual(["Screen-free wind-down", "Bed by 11", "Morning walk", "Screen-free wind-down"]);
    expect(pickFocusStep([], 2)).toBeNull();
  });

  it("asks about the step and not to repeat the last message", () => {
    const p = idleWellnessPrompt("Sleep rhythm", "Bed by 11", "How's sleep been?");
    expect(p).toContain('"Bed by 11"');
    expect(p).toContain("Sleep rhythm");
    expect(p).toContain("Don't repeat");
    expect(p.toLowerCase()).toContain("wellness");
  });
});
