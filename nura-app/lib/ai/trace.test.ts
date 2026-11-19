import { describe, expect, it } from "vitest";
import { HEALTH_BRIEF_GUIDANCE, HEALTH_BRIEF_HEADER } from "@/lib/health/health-brief";
import { aiGenerationEvent, aiTraceEnabled, currentAiTrace, newAiTrace, withAiTrace, type AiGeneration } from "./trace";

const ctx = newAiTrace({ distinctId: "11111111-2222-3333-4444-555555555555", sessionId: "plan-1" });

function gen(overrides: Partial<AiGeneration> = {}): AiGeneration {
  return {
    ctx,
    span: "message-intake/chat",
    model: "claude-sonnet-5",
    route: "anthropic",
    system: "You are Nura.",
    messages: [{ role: "user", content: "I slept badly again" }],
    response: { content: [{ type: "text", text: "Sorry to hear that." }], usage: { input_tokens: 12, output_tokens: 5 }, stop_reason: "end_turn" },
    status: 200,
    latencyMs: 1234,
    ...overrides,
  };
}

type Props = Record<string, unknown> & { $ai_input: Array<{ role: string; content: string }>; $ai_output_choices: Array<{ content: string }> };
const props = (g: AiGeneration) => aiGenerationEvent(g).properties as Props;

describe("aiGenerationEvent", () => {
  it("sends one $ai_generation for the signed-in person with the nura slug", () => {
    const event = aiGenerationEvent(gen());
    expect(event.event).toBe("$ai_generation");
    expect(event.distinct_id).toBe(ctx.distinctId);
    const p = event.properties as Props;
    expect(p.product).toBe("nura");
    expect(p.$ai_trace_id).toBe(ctx.traceId);
    expect(p.$ai_session_id).toBe("plan-1");
    expect(p.$ai_span_name).toBe("message-intake/chat");
    expect(p.$ai_input).toEqual([
      { role: "system", content: "You are Nura." },
      { role: "user", content: "I slept badly again" },
    ]);
    expect(p.$ai_output_choices).toEqual([{ role: "assistant", content: "Sorry to hear that." }]);
    expect(p.$ai_input_tokens).toBe(12);
    expect(p.$ai_output_tokens).toBe(5);
    expect(p.$ai_latency).toBe(1.234);
    expect(p.$ai_is_error).toBe(false);
    expect(p.$process_person_profile).toBeUndefined();
  });

  it("uses the trace id and no person profile when nobody is signed in", () => {
    const anon = newAiTrace({});
    const event = aiGenerationEvent(gen({ ctx: anon }));
    expect(event.distinct_id).toBe(anon.traceId);
    expect((event.properties as Props).$process_person_profile).toBe(false);
  });

  it("records failures with their status and no output", () => {
    const p = props(gen({ response: null, status: 529, error: "529 Overloaded" }));
    expect(p.$ai_is_error).toBe(true);
    expect(p.$ai_http_status).toBe(529);
    expect(p.$ai_error).toBe("529 Overloaded");
    expect(p.$ai_output_choices).toEqual([]);
  });

  it("replaces images and documents with markers and shows tool calls as JSON", () => {
    const p = props(
      gen({
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo" } },
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0" } },
              { type: "text", text: "what is this?" },
            ],
          },
        ],
        response: { content: [{ type: "thinking", text: "hmm" }, { type: "tool_use", name: "decide", input: { reply: "Hi" } }] },
      }),
    );
    expect(p.$ai_input[1].content).toBe("[image]\n[document]\nwhat is this?");
    expect(JSON.stringify(p)).not.toContain("iVBORw0KGgo");
    expect(p.$ai_output_choices[0].content).toBe('[tool decide] {"reply":"Hi"}');
  });

  it("masks phone numbers and email addresses", () => {
    const p = props(gen({ system: "The user's phone number on file is +447700900123. Email jo@example.com." }));
    expect(p.$ai_input[0].content).toBe("The user's phone number on file is [phone]. Email [email].");
  });

  it("cuts the Apple Health brief out of the prompt and withholds the reply written from it", () => {
    const healthText = `${HEALTH_BRIEF_HEADER} Apple Health (last synced Thu 19 Nov, 08:00):\n- Sleep: 5h 10m a night this week, usually 7h 20m\n- Steps: down by a third`;
    const p = props(gen({ system: `You are Nura.\n${healthText}\n${HEALTH_BRIEF_GUIDANCE}\nBe kind.` }));
    expect(p.$ai_input[0].content).toContain("[Apple Health / Health Connect data withheld]");
    expect(p.$ai_input[0].content).not.toMatch(/Health data the user chose to share/);
    expect(p.$ai_input[0].content).not.toMatch(/^- /m);
    expect(p.$ai_input[0].content).toContain("Be kind.");
    expect(p.$ai_output_choices[0].content).toMatch(/withheld/);
    expect(p.health_data_withheld).toBe(true);
  });

  it("cuts very long text", () => {
    const p = props(gen({ messages: [{ role: "user", content: "x".repeat(70_000) }] }));
    expect(p.$ai_input[1].content.length).toBeLessThan(61_000);
    expect(p.$ai_input[1].content).toMatch(/more characters\]$/);
  });
});

describe("trace context", () => {
  it("carries the person through async work and falls back to a fresh anonymous trace", async () => {
    const seen = await withAiTrace({ distinctId: "owner-1", sessionId: "plan-9" }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return currentAiTrace();
    });
    expect(seen.distinctId).toBe("owner-1");
    expect(seen.sessionId).toBe("plan-9");
    const outside = currentAiTrace();
    expect(outside.distinctId).toBeNull();
    expect(outside.traceId).not.toBe(seen.traceId);
  });

  it("only sends from production unless switched on", () => {
    const before = { env: process.env.VERCEL_ENV, flag: process.env.AI_TRACE };
    process.env.AI_TRACE = "";
    process.env.VERCEL_ENV = "preview";
    expect(aiTraceEnabled()).toBe(false);
    process.env.VERCEL_ENV = "production";
    expect(aiTraceEnabled()).toBe(true);
    process.env.AI_TRACE = "off";
    expect(aiTraceEnabled()).toBe(false);
    process.env.VERCEL_ENV = before.env;
    process.env.AI_TRACE = before.flag;
  });
});
