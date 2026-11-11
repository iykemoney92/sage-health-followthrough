import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase session client: only the calls the POST route makes. Each
// insert pulls the next queued result, so a test decides how the first insert and
// its fallback come back.
const inserts: { data: unknown; error: { message: string } | null }[] = [];
const inserted: Record<string, unknown>[] = [];

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
  c.maybeSingle = async () => result;
  return c;
}

const fakeClient = {
  from(table: string) {
    if (table === "clariti_sessions") return chain({ data: { id: "s1" }, error: null });
    if (table === "clariti_messages") {
      return { insert: () => chain({ data: { id: "m1", role: "assistant", content: "Done.", created_at: "2026-11-11T00:00:00Z" }, error: null }) };
    }
    return {
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return chain(inserts.shift() ?? { data: null, error: null });
      },
    };
  },
};

vi.mock("@/lib/integrations/supabase-server", () => ({
  getSessionUser: async () => ({ id: "u1", email: "reader@example.com", email_confirmed_at: "2026-11-01T00:00:00Z" }),
  getSupabaseSessionClient: async () => fakeClient,
  hasSupabaseBrowserConfig: () => true,
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/billing/subscription", () => ({ getSubscriptionAccess: async () => ({ hasPlus: true }) }));
vi.mock("@/lib/observability/report-error", () => ({ reportError: vi.fn() }));

const { POST } = await import("./route");

const analysis = {
  kind: "medical_bill",
  title: "Northside bill",
  summary: "A bill.",
  plainEnglish: "You owe $40.",
  sourceAnchors: ["Amount due"],
  keyPoints: [{ label: "Due", detail: "$40", sourceAnchor: "Amount due" }],
  questions: ["Is this covered?"],
  nextActions: ["Compare with the EOB"],
  safetyNote: "Check with your insurer.",
};

function request() {
  return new Request("https://useclariti.app/api/follow-ups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "s1", channel: "email", scheduledFor: "2026-11-12T17:00:00.000Z", action: "Compare with the EOB", analysis }),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/follow-ups", () => {
  beforeEach(() => {
    inserts.length = 0;
    inserted.length = 0;
  });

  it("saves the check-in and says Done", async () => {
    inserts.push({ data: { id: "f1" }, error: null });
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.followUp.persisted).toBe(true);
    expect(inserted[0]).toMatchObject({ owner_id: "u1", phone_number: "reader@example.com", action: "Compare with the EOB" });
  });

  it("never says Done when the check-in could not be saved (11 Nov 2026)", async () => {
    inserts.push({ data: null, error: { message: "column \"analysis_payload\" does not exist" } });
    inserts.push({ data: null, error: { message: "new row violates row-level security policy" } });
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(inserted).toHaveLength(2);
  });

  it("still saves through the fallback when only the newer columns are missing", async () => {
    inserts.push({ data: null, error: { message: "column \"analysis_payload\" does not exist" } });
    inserts.push({ data: { id: "f2" }, error: null });
    const body = await (await POST(request())).json();
    expect(body.ok).toBe(true);
    expect(body.followUp.id).toBe("f2");
    expect(inserted[1]).not.toHaveProperty("analysis_payload");
  });
});
