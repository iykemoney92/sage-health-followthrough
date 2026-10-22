import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONSENT_TOKEN_PATTERN,
  buildConsentShare,
  firstRecipientCallTime,
  hashConsentToken,
  maskPhone,
  newConsentToken,
  normalizeRecipientPhone,
  recipientCallBrief,
  recipientOpeningLine,
  recipientCallSummaryText,
  recipientThreadContext,
  type CareRecipient,
} from "@/lib/care-recipient";
import { missedRecipientCallBody } from "@/lib/care-circle-alerts";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";
import { getZonedParts } from "@/lib/timezone";

const OWNER = "4b1c2c0e-1a52-4b55-9d5e-2f8f3d2c9a11";
const PLAN = "a7d2a0c4-7b3e-4f0a-9a63-0c2b6f1f7e22";

describe("normalizeRecipientPhone", () => {
  it("keeps full international numbers as digits", () => {
    expect(normalizeRecipientPhone("+44 7700 900123")).toBe("447700900123");
    expect(normalizeRecipientPhone("1 (415) 555-0100")).toBe("14155550100");
  });

  it("rejects numbers too short or too long to be real", () => {
    expect(normalizeRecipientPhone("12345")).toBeNull();
    expect(normalizeRecipientPhone("1".repeat(16))).toBeNull();
    expect(normalizeRecipientPhone("")).toBeNull();
  });

  it("masks all but the last four digits", () => {
    expect(maskPhone("447700900123")).toBe("•••0123");
  });
});

describe("consent tokens", () => {
  it("are unguessable, match the route pattern, and only their hash is kept", () => {
    const a = newConsentToken();
    const b = newConsentToken();
    expect(a.token).not.toBe(b.token);
    expect(CONSENT_TOKEN_PATTERN.test(a.token)).toBe(true);
    expect(a.hash).toBe(hashConsentToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(new Date(a.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60_000);
  });

  it("builds a message the owner sends themselves, with the link in it", () => {
    const share = buildConsentShare("https://usenura.app/", "tok_abcdefghijklmnopqrstuvwxyz", "2026-10-30T00:00:00Z", {
      ownerFirstName: "Sarah",
      recipientFirstName: "Margaret",
      planTitle: "Mum's heart follow-up",
    });
    expect(share.url).toBe("https://usenura.app/agree/tok_abcdefghijklmnopqrstuvwxyz");
    expect(share.text).toContain("Hi Margaret, it's Sarah.");
    expect(share.text).toContain(share.url);
    expect(decodeURIComponent(share.whatsappUrl)).toContain(share.url);
    expect(share.smsUrl.startsWith("sms:")).toBe(true);
  });
});

describe("firstRecipientCallTime", () => {
  it("rings within half an hour during their daytime", () => {
    // 15:00 in London (BST) on a weekday.
    const now = new Date("2026-10-07T14:00:00Z");
    const at = firstRecipientCallTime(now, "Europe/London");
    expect(at.getTime() - now.getTime()).toBe(30 * 60_000);
  });

  it("waits until 10am their time when it's evening where they are", () => {
    // 22:00 in New York.
    const now = new Date("2026-10-08T02:00:00Z");
    const at = firstRecipientCallTime(now, "America/New_York");
    const parts = getZonedParts(at, "America/New_York");
    expect(parts.hour).toBe(10);
    expect(parts.day).toBe(8);
  });

  it("waits until 10am the same day when it's early morning where they are", () => {
    // 06:00 in London (BST).
    const now = new Date("2026-10-08T05:00:00Z");
    const at = firstRecipientCallTime(now, "Europe/London");
    const parts = getZonedParts(at, "Europe/London");
    expect(parts.hour).toBe(10);
    expect(parts.day).toBe(8);
  });
});

describe("what the agent is told on a call to someone else", () => {
  it("names who set it up, gives the stop rule and the stop tool", () => {
    const brief = recipientCallBrief("Margaret", "Sarah", true);
    expect(brief).toContain("This call is to Margaret, not the account holder.");
    expect(brief).toContain("Sarah set up this Journey");
    expect(brief).toContain("first call");
    expect(brief).toContain('"stop"');
    expect(brief).toContain("stop_calls");
    expect(brief).toContain("Never repeat anything Sarah told you privately");
  });

  it("opens the first call by saying who set it up", () => {
    expect(recipientOpeningLine("Margaret", "Sarah", "your heart follow-up", true)).toBe(
      "Hi Margaret, it's Nura, the assistant Sarah set up to check in with you about your heart follow-up. Is now an OK time for a quick chat?",
    );
    expect(recipientOpeningLine("Margaret", "Sarah", "your heart follow-up", false)).toContain("it's Nura again");
  });

  it("only carries the plan itself into the call", () => {
    const text = recipientThreadContext(
      { title: "Heart follow-up", category: "chronic_care", current_focus: "Daily walks", next_step: "Book the echo" },
      "America/Chicago",
      "Thu 10:00",
    );
    expect(text).toContain("Care plan: Heart follow-up");
    expect(text).toContain("Next step: Book the echo");
    expect(text).toContain("America/Chicago");
  });
});

type Query = { table: string };

/** A stand-in Supabase client that serves canned rows and records which tables were read. */
function fakeSupabase(rows: Record<string, unknown>) {
  const reads: Query[] = [];
  const builder = (table: string) => {
    reads.push({ table });
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq", "neq", "is", "in", "order", "limit", "gte", "lte", "not"]) chain[method] = self;
    chain.maybeSingle = async () => ({ data: rows[table] ?? null, error: null });
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: rows[`${table}[]`] ?? [], error: null });
    return chain;
  };
  return { client: { from: builder, rpc: async () => ({ data: null }) } as unknown as SupabaseClient, reads };
}

describe("buildVoiceCheckinContext for a call to someone else", () => {
  const recipient: CareRecipient = {
    id: "r1",
    plan_id: PLAN,
    owner_id: OWNER,
    first_name: "Margaret",
    relationship: "parent",
    phone: "13125550100",
    time_zone: "America/Chicago",
    consent_status: "granted",
    consent_method: "link",
    consent_at: "2026-10-20T15:00:00Z",
    consent_expires_at: null,
    revoked_at: null,
    revoke_reason: null,
    first_checkin_prompt: null,
  };

  it("never reads the owner's messages, uploads or notes, and speaks to the recipient", async () => {
    const { client, reads } = fakeSupabase({
      nura_plans: {
        id: PLAN,
        title: "Mum's heart follow-up",
        category: "chronic_care",
        current_focus: "Daily walks",
        next_step: "Book the echo",
        why_this_exists: "PRIVATE: I'm worried she's hiding how bad it is",
      },
      nura_check_ins: { prompt: "Ask how the walks are going" },
    });

    const context = await buildVoiceCheckinContext(client, OWNER, PLAN, "Sarah", {
      recipient,
      ownerFirstName: "Sarah",
      isFirstCall: true,
    });

    expect(context).not.toBeNull();
    const tables = new Set(reads.map((r) => r.table));
    expect(tables.has("nura_messages")).toBe(false);
    expect(tables.has("nura_source_contexts")).toBe(false);
    expect(tables.has("nura_observations")).toBe(false);

    const vars = context!.dynamicVariables;
    expect(vars.user_name).toBe("Margaret");
    expect(vars.on_behalf_of).toBe("Sarah");
    expect(vars.user_timezone).toBe("America/Chicago");
    expect(vars.checkin_goal).toBe("Ask how the walks are going");
    expect(JSON.stringify(vars)).not.toContain("PRIVATE");
    expect(vars.circle_pass_on).toContain("pass on to Sarah");
    expect(context!.firstMessage).toContain("Hi Margaret, it's Nura, the assistant Sarah set up");
  });
});

describe("after a call to someone else", () => {
  it("names the people in ElevenLabs' summary", () => {
    expect(
      recipientCallSummaryText(
        "The agent called the user to check on their walks. The user said the user's knee was sore and asked the agent to stop calling.",
        "Margaret",
      ),
    ).toBe("Nura called Margaret to check on their walks. Margaret said Margaret's knee was sore and asked Nura to stop calling.");
  });

  it("treats a missing summary as empty", () => {
    expect(recipientCallSummaryText(null, "Margaret")).toBe("");
  });

  it("tells the circle Nura couldn't reach them, not that the owner missed something", () => {
    const body = missedRecipientCallBody("Margaret", "Heart follow-up", "2026-10-22T09:00:00Z");
    expect(body).toContain("Nura couldn't reach Margaret");
    expect(body).toContain('"Heart follow-up"');
  });
});
