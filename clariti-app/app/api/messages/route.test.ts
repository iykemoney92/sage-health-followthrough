import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import fixture from "@/lib/ai/fixtures/eval-2026-11-20.json";

// Synthetic eval letter (the 20 Nov A7 rough scan), never a real reader's document.
const a7 = (fixture.cases as unknown as Record<string, { documentText: string; analysis: Record<string, unknown> }>)["A7-poor-ocr"];

// A fake Supabase session client: every query resolves to the rows queued for its table.
const rows: Record<string, unknown[]> = {};
function query(table: string) {
  const result = () => ({ data: rows[table] ?? [], error: null });
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  };
  for (const method of ["select", "eq", "in", "order", "limit"]) builder[method] = () => builder;
  builder.insert = (inserted: Array<Record<string, unknown>>) => {
    rows[table] = inserted.map((row, index) => ({ id: `m${index}`, ...row }));
    return builder;
  };
  return builder;
}
const fakeClient = { from: (table: string) => query(table) };

vi.mock("@/lib/integrations/supabase-server", () => ({
  getSessionUser: async () => ({ id: "u1", email: "reader@example.com", user_metadata: { clariti_ai_consent_at: "2026-11-01T00:00:00Z" } }),
  getSupabaseSessionClient: async () => fakeClient,
}));
vi.mock("@/lib/ai-consent", () => ({ hasAiConsent: () => true, aiConsentRequiredResponse: () => new Response(null, { status: 403 }) }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/billing/card-first", () => ({ requireTrialOrPlus: async () => null }));

let reply = "";
let lastSystem = "";
vi.mock("@/lib/ai/trace", () => ({
  withAiTrace: (_context: unknown, run: () => unknown) => run(),
  tracedModel: () =>
    new MockLanguageModelV4({
      provider: "anthropic.messages",
      modelId: "claude-opus-5",
      doGenerate: async (options) => {
        const prompt = options.prompt as Array<{ role: string; content: unknown }>;
        lastSystem = String(prompt.find((message) => message.role === "system")?.content ?? "");
        return {
          content: [{ type: "text", text: reply }],
          finishReason: { unified: "stop", raw: "end_turn" },
          usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
          warnings: [],
        };
      },
    }),
}));

const { POST } = await import("./route");

function request(content: string, country?: string) {
  return new Request("https://useclariti.app/api/messages", {
    method: "POST",
    headers: { "content-type": "application/json", ...(country ? { "x-vercel-ip-country": country } : {}) },
    body: JSON.stringify({ sessionId: "7c807fb0-0000-4000-8000-000000000001", content, analysis: a7.analysis }),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/messages safety rules", () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test-only";
    for (const key of Object.keys(rows)) delete rows[key];
    rows.clariti_session_documents = [{ document_id: "d1" }];
    rows.clariti_documents = [{ id: "d1", file_name: "scan_0042.jpg", kind: "medication_context", extracted_text: a7.documentText, created_at: "2026-11-12T09:00:00Z" }];
    lastSystem = "";
  });
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("gives a UK reader 999 / NHS 111 and the date and dose rules", async () => {
    reply = "Your review lists four medicines.";
    const res = await POST(request("What medicines am I on?", "GB"));
    expect(res.status).toBe(200);
    expect(lastSystem).toMatch(/call 999 in an emergency, or NHS 111/);
    expect(lastSystem).not.toMatch(/in the US, call 911/);
    expect(lastSystem).toMatch(/DATES: copy every date exactly/);
    expect(lastSystem).toMatch(/day\/month\/year unless the document is clearly American/);
    expect(lastSystem).toMatch(/DOSES FROM A ROUGH SCAN/);
    expect(lastSystem).toMatch(/country code GB/);
  });

  it("gives a US reader 911, and a reader nobody can place both", async () => {
    reply = "Your review lists four medicines.";
    await POST(request("What medicines am I on?", "US"));
    expect(lastSystem).toMatch(/in the US, call 911/);
    await POST(request("What medicines am I on?"));
    expect(lastSystem).toMatch(/give both: in the UK call 999 \(or NHS 111 for urgent advice\), in the US call 911/);
  });

  it("adds a check line when the reply misreads the scan's date and states a repaired dose", async () => {
    reply = "Your review from 11 Dec 2026 says metformin 500mg twice a day with food.";
    const body = await (await POST(request("When was my review and what metformin dose?", "GB"))).json();
    expect(body.assistant).toContain(reply);
    expect(body.assistant).toMatch(/Please check "11 Dec 2026" against your document/);
    expect(body.assistant).toMatch(/ask your pharmacist/);
  });

  it("leaves a reply alone when it copies the date and sends the reader to their copy", async () => {
    reply = "Your review is dated l2/ll/2026 on this copy, which reads as 12 November 2026. It lists metformin 5OOmg, which looks like 500mg: check it against your copy or ask your pharmacist.";
    const body = await (await POST(request("When was my review?", "GB"))).json();
    expect(body.assistant).toBe(reply);
  });
});
