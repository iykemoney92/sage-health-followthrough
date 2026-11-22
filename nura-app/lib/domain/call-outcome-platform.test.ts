import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compose: vi.fn(async (_n: string, _t: string, _p: string, reason?: string) => `followup:${reason ?? "no_answer"}`),
  whatsapp: vi.fn(async () => ({})),
  push: vi.fn(async () => ({ sent: 0, skipped: "no_subscriptions" })),
  email: vi.fn<(args: Record<string, unknown>) => Promise<{ ok: boolean }>>(async () => ({ ok: true })),
  placeCall: vi.fn(),
  readCredits: vi.fn(),
  recipient: vi.fn(async () => null),
}));

vi.mock("@/lib/domain/message-intake", () => ({ composeMissedCallFollowup: mocks.compose }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsappText: mocks.whatsapp }));
vi.mock("@/lib/integrations/push", () => ({ sendPushToOwner: mocks.push }));
vi.mock("@/lib/integrations/resend", () => ({
  sendAuthEmail: mocks.email,
  missedCheckInEmailHtml: (x: { ourSide?: boolean }) => `html ourSide=${Boolean(x.ourSide)}`,
  missedCheckInEmailText: (x: { ourSide?: boolean }) => `text ourSide=${Boolean(x.ourSide)}`,
  nuraEmailLogoAttachment: () => [],
}));
vi.mock("@/lib/ai/trace", () => ({ withAiTrace: (_c: unknown, fn: () => unknown) => fn() }));
vi.mock("@/lib/domain/voice-checkin-context", () => ({
  buildVoiceCheckinContext: async () => null,
  NO_CIRCLE_PASS_ON: "none",
}));
vi.mock("@/lib/care-recipient", () => ({
  loadRecipientForPlan: mocks.recipient,
  hasCalledRecipientBefore: async () => false,
  recipientCallSummaryText: () => "",
}));
vi.mock("@/lib/integrations/elevenlabs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/elevenlabs")>()),
  placeOutboundCall: mocks.placeCall,
}));
vi.mock("@/lib/integrations/elevenlabs-credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/elevenlabs-credits")>()),
  readVoiceCredits: mocks.readCredits,
}));

import { decideCallOutcome, placeDueRedials, resolveCallForCheckIn, type ResolvableCheckIn } from "./call-outcome";
import { parseConversationOutcome, VoiceCallStartError } from "@/lib/integrations/elevenlabs";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

const checkIn: ResolvableCheckIn = {
  id: "ci-1",
  owner_id: "owner-1",
  plan_id: "plan-1",
  prompt: "ask how the evening went",
  contact_phone: "+447000000000",
  call_conversation_id: "conv_8901",
  triggered_at: "2026-11-20T20:44:05Z",
  call_attempts: 1,
  nura_plans: { title: "Evening routine" },
};

const failed3000 = parseConversationOutcome({
  status: "failed",
  metadata: {
    call_duration_secs: 0,
    error: { code: 3000, reason: "The AI agent you are trying to reach is not available.", error_type: "call_initialization_error" },
  },
  transcript: [],
});

function db() {
  return fakeSupabase(
    (q) => {
      if (q.table === "nura_profiles" && q.op === "select")
        return { data: [{ display_name: "Sam Example", phone: "+447000000000", preferred_checkin_channels: ["voice", "whatsapp", "in_app"] }] };
      return undefined;
    },
    { email: "sam@example.org", user_metadata: {} },
  );
}

const plentyOfCredits = {
  level: "ok",
  credits: { used: 0, limit: 10_000, remaining: 10_000, resetsAt: null, tier: "payg" },
  error: null,
  floor: 1000,
  alertFraction: 0.2,
};

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockClear();
  mocks.readCredits.mockResolvedValue(plentyOfCredits);
});

describe("a call ElevenLabs refused (code 3000, 20 Nov)", () => {
  it("is Nura's failure, with the real reason recorded", () => {
    const decision = decideCallOutcome(failed3000, false);
    expect(decision).toEqual({
      kind: "not_connected",
      reason: "Voice unavailable (ElevenLabs 3000: The AI agent you are trying to reach is not available.)",
      cause: "platform_failure",
    });
  });

  it("goes straight to the text fallback - no redial into the outage - and tells the follow-up why", async () => {
    const fake = db();
    const result = await resolveCallForCheckIn(fake.client as never, checkIn, failed3000, false);

    expect(result).toBe("escalated");
    expect(mocks.placeCall).not.toHaveBeenCalled();
    expect(mocks.compose).toHaveBeenCalledWith("Sam", "Evening routine", "ask how the evening went", "platform_failure");
    expect(mocks.whatsapp).toHaveBeenCalledWith("447000000000", "followup:platform_failure");
    // The email says the call didn't go through on our side, not "Nura tried to call".
    expect(mocks.email.mock.calls[0][0]).toMatchObject({ subject: "Nura: checking in about Evening routine", html: "html ourSide=true" });

    const update = fake.updates("nura_check_ins").at(-1)!;
    expect(update.values).toMatchObject({
      call_status: "escalated_whatsapp",
      call_error: "Voice unavailable (ElevenLabs 3000: The AI agent you are trying to reach is not available.)",
    });
    expect(update.values).not.toHaveProperty("redial_at");
  });

  it("still redials a call the person simply didn't answer, and says so in the follow-up later", async () => {
    const fake = db();
    const noAnswer = { status: "done", callSuccessful: "failure", durationSecs: 2, hasTranscript: false };
    expect(await resolveCallForCheckIn(fake.client as never, checkIn, noAnswer, false)).toBe("redial_pending");
    expect(mocks.compose).not.toHaveBeenCalled();

    const second = await resolveCallForCheckIn(fake.client as never, { ...checkIn, call_attempts: 2 }, noAnswer, false);
    expect(second).toBe("escalated");
    expect(mocks.compose).toHaveBeenCalledWith("Sam", "Evening routine", "ask how the evening went", "no_answer");
  });
});

describe("redials respect the credit guard", () => {
  function redialDb() {
    return fakeSupabase(
      (q) => {
        if (q.table === "nura_check_ins" && q.op === "select" && q.filters.some(([, c, v]) => c === "call_status" && v === "redial_pending"))
          return { data: [checkIn] };
        if (q.table === "nura_profiles" && q.op === "select")
          return { data: [{ display_name: "Sam", phone: "+447000000000", preferred_checkin_channels: ["voice", "whatsapp"] }] };
        return undefined;
      },
      { email: "sam@example.org", user_metadata: {} },
    );
  }

  it("doesn't place the redial when credits are under one call's worth; texts instead", async () => {
    mocks.readCredits.mockResolvedValue({
      ...plentyOfCredits,
      level: "exhausted",
      credits: { used: 9_874, limit: 10_001, remaining: 127, resetsAt: null, tier: "payg" },
    });
    const fake = redialDb();
    await placeDueRedials(fake.client as never);

    expect(mocks.placeCall).not.toHaveBeenCalled();
    expect(mocks.compose).toHaveBeenCalledWith("Sam", "Evening routine", "ask how the evening went", "platform_failure");
    const update = fake.updates("nura_check_ins").at(-1)!;
    expect(update.values?.call_status).toBe("escalated_whatsapp");
    expect(String(update.values?.call_error)).toMatch(/^Call not placed \(redial: 127 of 10001 ElevenLabs credits left/);
  });

  it("a redial ElevenLabs refuses to start is recorded as Nura's failure, not a missed call", async () => {
    mocks.placeCall.mockRejectedValue(new VoiceCallStartError("The AI agent you are trying to reach is not available.", 400));
    const fake = redialDb();
    await placeDueRedials(fake.client as never);

    expect(mocks.placeCall).toHaveBeenCalledTimes(1);
    expect(mocks.compose).toHaveBeenCalledWith("Sam", "Evening routine", "ask how the evening went", "platform_failure");
    const update = fake.updates("nura_check_ins").at(-1)!;
    expect(String(update.values?.call_error)).toBe(
      "Voice unavailable (redial failed to start: The AI agent you are trying to reach is not available.)",
    );
  });
});
