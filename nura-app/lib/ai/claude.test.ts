import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ baseURL?: string; apiKey?: string; model: string }> = [];
let directResult: () => Promise<unknown>;
let gatewayResult: () => Promise<unknown>;

vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: vi.fn(async () => "oidc-token") }));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    static APIError = actual.default.APIError;
    static APIConnectionError = actual.default.APIConnectionError;
    static APIConnectionTimeoutError = actual.default.APIConnectionTimeoutError;
    messages: { create: (params: { model: string }) => Promise<unknown> };
    constructor(opts: { apiKey?: string; baseURL?: string }) {
      this.messages = {
        create: (params) => {
          calls.push({ baseURL: opts.baseURL, apiKey: opts.apiKey, model: params.model });
          return opts.baseURL ? gatewayResult() : directResult();
        },
      };
    }
  }
  return { ...actual, default: FakeAnthropic };
});

const { AiUnavailableError, classifyAiError, createClaudeMessage, gatewayModelId, isProviderOutage } = await import("./claude");

function apiError(status: number, message: string) {
  return Anthropic.APIError.generate(status, { error: { type: "error", message } }, message, new Headers());
}

const params = { model: "claude-sonnet-5", max_tokens: 10, messages: [{ role: "user" as const, content: "hi" }] };
const ok = { id: "msg", content: [{ type: "text", text: "hello" }] };

describe("classifyAiError", () => {
  it("names the 2026-10-24 credit outage as billing", () => {
    expect(classifyAiError(apiError(400, "Your credit balance is too low to access the Anthropic API."))).toBe("billing");
  });

  it("separates outages from our own bad requests", () => {
    expect(classifyAiError(apiError(401, "invalid x-api-key"))).toBe("auth");
    expect(classifyAiError(apiError(429, "rate limited"))).toBe("rate_limit");
    expect(classifyAiError(apiError(529, "overloaded"))).toBe("overloaded");
    expect(classifyAiError(apiError(500, "internal"))).toBe("server");
    expect(classifyAiError(apiError(400, "max_tokens: too large"))).toBe("bad_request");
    expect(isProviderOutage("bad_request")).toBe(false);
    expect(isProviderOutage("billing")).toBe(true);
  });

  it("ignores errors that aren't from the API", () => {
    expect(classifyAiError(new SyntaxError("Unexpected token"))).toBeNull();
  });
});

describe("gatewayModelId", () => {
  it("prefixes the provider once", () => {
    expect(gatewayModelId("claude-sonnet-5")).toBe("anthropic/claude-sonnet-5");
    expect(gatewayModelId("anthropic/claude-sonnet-5")).toBe("anthropic/claude-sonnet-5");
  });
});

describe("createClaudeMessage", () => {
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls.length = 0;
    process.env.ANTHROPIC_API_KEY = "direct-key";
    delete process.env.AI_GATEWAY_API_KEY;
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it("uses Anthropic directly when it works", async () => {
    directResult = async () => ok;
    await expect(createClaudeMessage("test", params)).resolves.toBe(ok);
    expect(calls).toEqual([{ baseURL: undefined, apiKey: "direct-key", model: "claude-sonnet-5" }]);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("retries through AI Gateway when Anthropic is out of credit, and logs it", async () => {
    directResult = async () => {
      throw apiError(400, "Your credit balance is too low to access the Anthropic API.");
    };
    gatewayResult = async () => ok;
    await expect(createClaudeMessage("chat", params)).resolves.toBe(ok);
    expect(calls[1]).toEqual({ baseURL: "https://ai-gateway.vercel.sh", apiKey: "oidc-token", model: "anthropic/claude-sonnet-5" });
    expect(String(errorLog.mock.calls[0][0])).toMatch(/^\[AI DOWN\] Anthropic direct failed \(billing\) for chat; served via AI Gateway/);
  });

  it("does not retry a bad request through the gateway", async () => {
    directResult = async () => {
      throw apiError(400, "messages: field required");
    };
    await expect(createClaudeMessage("chat", params)).rejects.toBeInstanceOf(Anthropic.APIError);
    expect(calls).toHaveLength(1);
  });

  it("throws AiUnavailableError and logs loudly when both routes fail", async () => {
    directResult = async () => {
      throw apiError(529, "overloaded");
    };
    gatewayResult = async () => {
      throw apiError(402, "insufficient funds");
    };
    const failure = await createClaudeMessage("chat", params).catch((err) => err);
    expect(failure).toBeInstanceOf(AiUnavailableError);
    expect(failure.kind).toBe("overloaded");
    expect(String(errorLog.mock.calls[0][0])).toMatch(/^\[AI DOWN\] Claude unavailable for chat/);
  });
});
