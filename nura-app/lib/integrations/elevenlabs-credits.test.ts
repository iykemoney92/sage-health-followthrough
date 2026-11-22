import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assessCredits,
  CREDIT_CACHE_MS,
  DEFAULT_CREDIT_FLOOR,
  parseSubscription,
  readVoiceCredits,
  resetCreditCache,
  type VoiceCredits,
} from "./elevenlabs-credits";
import { isAccountWideVoiceError, parseConversationOutcome, VoiceCallStartError } from "./elevenlabs";
import {
  decideVoiceGate,
  isVoiceUnavailableNote,
  recentVoiceFailure,
  voiceSkippedNote,
  voiceUnavailableNote,
  VOICE_UNAVAILABLE,
} from "@/lib/domain/voice-availability";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

const credits = (used: number, limit = 10_000): VoiceCredits => ({
  used,
  limit,
  remaining: limit - used,
  resetsAt: "2026-12-22T19:49:54.000Z",
  tier: "payg",
});

afterEach(() => {
  resetCreditCache();
  vi.unstubAllEnvs();
});

describe("credit guard: assessCredits", () => {
  it("is ok with plenty left", () => {
    expect(assessCredits(credits(0))).toBe("ok");
    expect(assessCredits(credits(7_900))).toBe("ok");
  });

  it("is low under 20% of the allowance", () => {
    expect(assessCredits(credits(8_100))).toBe("low");
  });

  it("is exhausted under the floor for one call (the 20 Nov state: 127 left)", () => {
    expect(assessCredits(credits(9_874, 10_001))).toBe("exhausted");
    expect(assessCredits(credits(10_000 - DEFAULT_CREDIT_FLOOR + 1))).toBe("exhausted");
  });

  it("is unknown without a reading", () => {
    expect(assessCredits(null)).toBe("unknown");
    expect(assessCredits({ ...credits(0), limit: 0 })).toBe("unknown");
  });

  it("takes the floor and alert share from env", () => {
    vi.stubEnv("ELEVENLABS_CREDIT_FLOOR", "3000");
    vi.stubEnv("ELEVENLABS_CREDIT_ALERT_FRACTION", "0.5");
    expect(assessCredits(credits(7_500))).toBe("exhausted");
    expect(assessCredits(credits(6_000))).toBe("low");
  });
});

describe("credit guard: reading the balance", () => {
  it("parses the subscription payload ElevenLabs returns", () => {
    expect(
      parseSubscription({ tier: "payg", character_count: 0, character_limit: 10_000, next_character_count_reset_unix: 1797968994 }),
    ).toEqual({ used: 0, limit: 10_000, remaining: 10_000, resetsAt: "2026-12-22T19:49:54.000Z", tier: "payg" });
    expect(parseSubscription({ detail: { message: "missing the permission user_read" } })).toBeNull();
  });

  it("caches a reading for a few minutes, then reads again", async () => {
    const fetcher = vi.fn(async () => ({ credits: credits(9_500), error: null }));
    const t0 = 1_000_000;
    const first = await readVoiceCredits(t0, fetcher);
    await readVoiceCredits(t0 + CREDIT_CACHE_MS - 1, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.level).toBe("exhausted");
    await readVoiceCredits(t0 + CREDIT_CACHE_MS, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reports unknown (and why) when the key can't read the balance", async () => {
    const reading = await readVoiceCredits(0, async () => ({ credits: null, error: "ElevenLabs subscription read failed (401)." }));
    expect(reading.level).toBe("unknown");
    expect(reading.error).toContain("401");
  });
});

describe("credit guard: may Nura place a call?", () => {
  const reading = (level: "ok" | "low" | "exhausted" | "unknown", c: VoiceCredits | null) => ({
    level,
    credits: c,
    error: null,
    floor: DEFAULT_CREDIT_FLOOR,
    alertFraction: 0.2,
  });

  it("blocks the call when credits are under the floor", () => {
    const gate = decideVoiceGate(reading("exhausted", credits(9_874, 10_001)), null);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.reason).toContain("127 of 10001 ElevenLabs credits left");
  });

  it("blocks the call while a recent account-wide failure holds the breaker open", () => {
    const gate = decideVoiceGate(reading("unknown", null), voiceUnavailableNote("ElevenLabs 3000: agent not available"));
    expect(gate.allowed).toBe(false);
  });

  it("allows the call when credits are fine or low-but-enough and nothing failed", () => {
    expect(decideVoiceGate(reading("ok", credits(0)), null).allowed).toBe(true);
    expect(decideVoiceGate(reading("low", credits(8_500)), null).allowed).toBe(true);
    expect(decideVoiceGate(reading("unknown", null), null).allowed).toBe(true);
  });

  it("only real failures feed the breaker, never a skipped call (or voice would stay off for ever)", () => {
    expect(isVoiceUnavailableNote(voiceUnavailableNote("x"))).toBe(true);
    expect(isVoiceUnavailableNote(voiceSkippedNote("credits low"))).toBe(false);
  });

  it("looks for a recent Voice-unavailable failure in the breaker window", async () => {
    const db = fakeSupabase((q) =>
      q.table === "nura_check_ins" ? { data: [{ call_error: `${VOICE_UNAVAILABLE} (ElevenLabs 3000: x)` }] } : undefined,
    );
    const found = await recentVoiceFailure(db.client as never, new Date("2026-11-22T10:00:00Z"));
    expect(found).toContain("ElevenLabs 3000");
    const q = db.queries[0];
    expect(q.filters).toContainEqual(["like", "call_error", `${VOICE_UNAVAILABLE}%`]);
    expect(q.filters).toContainEqual(["gte", "triggered_at", "2026-11-22T09:30:00.000Z"]);
  });
});

describe("ElevenLabs refusing a call", () => {
  it("reads the real 3000 'agent not available' failure (conv_8901…, 20 Nov) as an account-wide platform error", () => {
    const outcome = parseConversationOutcome({
      status: "failed",
      metadata: {
        call_duration_secs: 0,
        termination_reason: "",
        error: {
          code: 3000,
          reason: "The AI agent you are trying to reach is not available.",
          error_type: "call_initialization_error",
        },
      },
      transcript: [],
    });
    expect(outcome?.platformError).toEqual({
      code: 3000,
      reason: "The AI agent you are trying to reach is not available.",
      accountWide: true,
    });
  });

  it("has no platform error on an ordinary call", () => {
    expect(parseConversationOutcome({ status: "done", metadata: { call_duration_secs: 40 }, transcript: [] })?.platformError).toBeNull();
  });

  it("classifies start errors", () => {
    expect(new VoiceCallStartError("Insufficient credits", 401).accountWide).toBe(true);
    expect(new VoiceCallStartError("Upstream error", 502).accountWide).toBe(true);
    expect(new VoiceCallStartError("Invalid phone number", 422).accountWide).toBe(false);
    expect(isAccountWideVoiceError(null, "quota exceeded")).toBe(true);
  });
});
