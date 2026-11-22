import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// "Try Nura first" (22 Nov 2026 QA): probes must not become Care plans, and the plan and first
// check-in prompts must read as a companion, never asking for "symptoms, concerns".

const create = vi.fn();
vi.mock("@/lib/ai/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/claude")>();
  return { ...actual, claudeClient: () => ({ messages: { create } }) };
});
vi.mock("@/lib/integrations/supabase", () => ({ getSupabaseServerClient: () => ({}) }));
const checkRateLimit = vi.fn(async () => ({ limited: false }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimit(...(args as [])) }));

import { POST } from "./route";

const reply = (text: string) => ({ content: [{ type: "text", text }] });

function tryRequest(text: string) {
  return new NextRequest("https://usenura.app/api/try/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ text }),
  });
}

beforeEach(() => {
  create.mockReset();
  checkRateLimit.mockClear();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/try/plan", () => {
  it("answers a connectivity probe with a friendly nudge, no plan and no model call", async () => {
    const res = await POST(tryRequest("Connectivity test from monitoring, reference ABC-1234"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "off_topic", reason: "probe" });
    expect(body.message).toMatch(/who you’d like it to check in on/);
    expect(body).not.toHaveProperty("plan");
    expect(JSON.stringify(body)).not.toContain("ABC-1234");
    expect(create).not.toHaveBeenCalled();
    // Doesn't use up the visitor's three tries.
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("turns away gibberish and non-care requests the same way", async () => {
    for (const text of ["sdfsdf sdfsdf sdfsdf", "Write me a poem about the sea and stars"]) {
      const res = await POST(tryRequest(text));
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe("off_topic");
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("builds a plan for a real message with companion prompts (no symptoms/concerns, no clinic framing)", async () => {
    create
      .mockResolvedValueOnce(
        reply(
          JSON.stringify({
            title: "Evening wind-down after work",
            category: "occupational_stress",
            why_this_exists: "Work has been stressful and evenings feel rushed.",
            current_focus: "A short wind-down most evenings.",
            next_step: "Nura will ask how the evening went.",
          }),
        ),
      )
      .mockResolvedValueOnce(
        reply(JSON.stringify({ when: new Date(Date.now() + 86_400_000).toISOString(), prompt: "ask how the wind-down went", channel: "in_app" })),
      )
      .mockResolvedValueOnce(reply("Hey, how did the wind-down go tonight?"));

    const res = await POST(tryRequest("Work’s been really stressful lately. I’d like someone to check in on me in the evenings."));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plan.title).toBe("Evening wind-down after work");
    expect(body.checkIn.message).toBe("Hey, how did the wind-down go tonight?");

    const planSystem: string = create.mock.calls[0][0].system;
    const checkInSystem: string = create.mock.calls[1][0].system;
    expect(planSystem).toContain("AI wellbeing companion");
    expect(planSystem).toContain("how they're doing");
    expect(planSystem).toContain("never ask them to describe or track symptoms or concerns");
    expect(planSystem).not.toMatch(/health Care plan|prescription info|Headaches & night tablet|GP review in two weeks/);
    expect(checkInSystem).toContain("wellbeing companion");
    expect(checkInSystem).toContain("Never ask them to describe or list symptoms or concerns");
    expect(checkInSystem).not.toMatch(/meds timing|clinic follow-up window/);
  });
});
