import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateText, simulateReadableStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { aiGenerationEvent, newAiTrace, tracedModel, withAiTrace } from "./trace";

type Sent = { event: string; distinct_id: string; properties: Record<string, unknown> & { $ai_input: Array<{ role: string; content: string }>; $ai_output_choices: Array<{ content: string }> } };

const usage = {
  inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 7, text: 7, reasoning: undefined },
};

let sent: Sent[] = [];

async function flush() {
  for (let i = 0; i < 5 && sent.length === 0; i++) await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => {
  sent = [];
  process.env.AI_TRACE = "on";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response('{"status":"Ok"}', { status: 200 });
    }),
  );
});

afterEach(() => {
  delete process.env.AI_TRACE;
  vi.unstubAllGlobals();
});

describe("tracedModel", () => {
  it("sends one $ai_generation per call with the clariti slug, the person and the session", async () => {
    const model = new MockLanguageModelV4({
      provider: "anthropic.messages",
      modelId: "claude-sonnet-4-5",
      doGenerate: { content: [{ type: "text", text: "This is your bill." }], finishReason: { unified: "stop", raw: "end_turn" }, usage, warnings: [] },
    });
    const result = await withAiTrace({ distinctId: "owner-1", sessionId: "session-1" }, () =>
      generateText({
        model: tracedModel(model, "chat_reply"),
        system: "You are Clariti.",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is this? Email me at jo@example.com" },
              { type: "file", mediaType: "image/png", data: new Uint8Array([137, 80, 78, 71]) },
            ],
          },
        ],
      }),
    );
    expect(result.text).toBe("This is your bill.");
    await flush();
    expect(sent).toHaveLength(1);
    const [event] = sent;
    expect(event.event).toBe("$ai_generation");
    expect(event.distinct_id).toBe("owner-1");
    expect(event.properties).toMatchObject({
      product: "clariti",
      $ai_session_id: "session-1",
      $ai_span_name: "chat_reply",
      $ai_model: "claude-sonnet-4-5",
      $ai_provider: "anthropic",
      $ai_input_tokens: 20,
      $ai_output_tokens: 7,
      $ai_is_error: false,
      $ai_stream: false,
    });
    expect(event.properties.$ai_input).toEqual([
      { role: "system", content: "You are Clariti." },
      { role: "user", content: "What is this? Email me at [email]\n[image]" },
    ]);
    expect(event.properties.$ai_output_choices).toEqual([{ role: "assistant", content: "This is your bill." }]);
  });

  it("sends failures too, with the provider status", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw Object.assign(new Error("Overloaded"), { statusCode: 529 });
      },
    });
    await expect(
      withAiTrace({ distinctId: "owner-1" }, () => generateText({ model: tracedModel(model, "chat_reply"), prompt: "hi", maxRetries: 0 })),
    ).rejects.toThrow();
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].properties).toMatchObject({ $ai_is_error: true, $ai_http_status: 529 });
    expect(sent[0].properties.$ai_output_choices).toEqual([]);
  });

  it("collects streamed text and sends it once the stream ends", async () => {
    const model = new MockLanguageModelV4({
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "1" },
            { type: "text-delta", id: "1", delta: "Plain " },
            { type: "text-delta", id: "1", delta: "English." },
            { type: "text-end", id: "1" },
            { type: "finish", finishReason: { unified: "stop", raw: "end_turn" }, usage },
          ],
        }),
      },
    });
    const result = streamText({ model: tracedModel(model, "chat_reply"), prompt: "explain" });
    expect(await result.text).toBe("Plain English.");
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].properties).toMatchObject({ $ai_stream: true, $ai_output_tokens: 7, $process_person_profile: false });
    expect(sent[0].properties.$ai_output_choices).toEqual([{ role: "assistant", content: "Plain English." }]);
  });

  it("sends nothing outside production unless switched on", async () => {
    process.env.AI_TRACE = "";
    process.env.VERCEL_ENV = "preview";
    const model = new MockLanguageModelV4({
      doGenerate: { content: [{ type: "text", text: "ok" }], finishReason: { unified: "stop", raw: "end_turn" }, usage, warnings: [] },
    });
    await generateText({ model: tracedModel(model, "chat_reply"), prompt: "hi" });
    await new Promise((r) => setTimeout(r, 20));
    expect(sent).toHaveLength(0);
    delete process.env.VERCEL_ENV;
  });
});

describe("aiGenerationEvent", () => {
  it("uses the trace id and no person profile for an anonymous call, and cuts long text", () => {
    const ctx = newAiTrace({});
    const event = aiGenerationEvent({
      ctx,
      span: "document_extract",
      model: "anthropic/claude-sonnet-4.6",
      provider: "anthropic",
      prompt: [{ role: "user", content: [{ type: "file", mediaType: "application/pdf" }, { type: "text", text: "y".repeat(70_000) }] }],
      output: "text",
      status: 200,
      latencyMs: 10,
      stream: false,
    });
    const props = event.properties as Sent["properties"];
    expect(event.distinct_id).toBe(ctx.traceId);
    expect(props.$process_person_profile).toBe(false);
    expect(props.$ai_input[0].content.startsWith("[file]\n")).toBe(true);
    expect(props.$ai_input[0].content.length).toBeLessThan(61_000);
  });
});
