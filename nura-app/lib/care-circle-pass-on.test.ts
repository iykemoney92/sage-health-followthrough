import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStopEmailsToken, readStopEmailsToken } from "@/lib/care-circle-email";
import { cleanNoteBody, CIRCLE_NOTE_MAX_CHARS } from "@/lib/care-circle-notes";
import { circlePassOnBrief, NO_CIRCLE_PASS_ON } from "@/lib/domain/voice-checkin-context";
import { circleUpdateEmailHtml, circleUpdateEmailText } from "@/lib/integrations/resend";

const PLAN = "54c52dc2-4d29-43d3-a3a2-9a6a9f1c884e";
const MEMBER = "f3ce2e86-6ed1-4896-a99a-a9ea9a30454a";

describe("stop-emails token", () => {
  beforeEach(() => vi.stubEnv("CIRCLE_EMAIL_SECRET", "test-secret"));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the plan and member", () => {
    expect(readStopEmailsToken(createStopEmailsToken(PLAN, MEMBER))).toEqual({ planId: PLAN, memberId: MEMBER });
  });

  it("rejects a token pointed at someone else", () => {
    const [, signature] = createStopEmailsToken(PLAN, MEMBER).split(".");
    const otherPayload = Buffer.from(`${PLAN}.00000000-0000-0000-0000-000000000000`).toString("base64url");
    expect(readStopEmailsToken(`${otherPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createStopEmailsToken(PLAN, MEMBER);
    vi.stubEnv("CIRCLE_EMAIL_SECRET", "another-secret");
    expect(readStopEmailsToken(token)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(readStopEmailsToken("nope")).toBeNull();
    expect(readStopEmailsToken("a.b.c")).toBeNull();
  });
});

describe("cleanNoteBody", () => {
  it("collapses whitespace and trims", () => {
    expect(cleanNoteBody("  Had a   better\nweek  ")).toBe("Had a better week");
  });

  it("caps the length", () => {
    expect(cleanNoteBody("x".repeat(900))).toHaveLength(CIRCLE_NOTE_MAX_CHARS);
  });

  it("treats blank as nothing to pass on", () => {
    expect(cleanNoteBody("   \n ")).toBe("");
  });
});

describe("circlePassOnBrief", () => {
  it("tells the agent never to offer when there is no circle", () => {
    expect(circlePassOnBrief([])).toBe(NO_CIRCLE_PASS_ON);
  });

  it("names the circle and keeps the consent steps", () => {
    const brief = circlePassOnBrief(["Amina", "Tolu"]);
    expect(brief).toContain("pass on to Amina and Tolu this week?");
    expect(brief).toContain("read it back");
    expect(brief).toContain("Only after a clear yes");
    expect(brief).toContain("pass_on_to_circle");
    expect(brief).toContain("Never ask twice");
  });

  it("falls back to 'your Care circle' when names can't be read", () => {
    expect(circlePassOnBrief(null)).toContain("pass on to your Care circle this week?");
  });

  it("keeps long circles short to say out loud", () => {
    expect(circlePassOnBrief(["A", "B", "C", "D"])).toContain("pass on to A, B, C and the others in your Care circle");
  });
});

describe("circle update email", () => {
  const args = {
    recipientFirstName: "Amina",
    ownerFirstName: "Sarah",
    planUrl: `https://usenura.app/plans/${PLAN}`,
    stopEmailsUrl: "https://usenura.app/circle/emails/tok",
    updateBody: "Sarah had a steady week.",
    notes: [{ body: "Thanks for the calls <3 & see you Sunday", when: "Tue 20 Oct", viaCall: true }],
  };

  it("escapes what the owner wrote", () => {
    const html = circleUpdateEmailHtml(args);
    expect(html).toContain("Thanks for the calls &lt;3 &amp; see you Sunday");
    expect(html).not.toContain("<3 &");
    expect(html).toContain("passed on during a call with Nura");
    expect(html).toContain("Stop these emails");
  });

  it("has a plain-text twin with the notes and the stop link", () => {
    const text = circleUpdateEmailText(args);
    expect(text).toContain('"Thanks for the calls <3 & see you Sunday"');
    expect(text).toContain(args.stopEmailsUrl);
    expect(text).toContain("never their conversations with Nura");
  });
});
