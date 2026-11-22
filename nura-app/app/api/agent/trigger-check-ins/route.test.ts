import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeSupabase } from "@/lib/testing/fake-supabase";

const m = vi.hoisted(() => ({
  db: null as null | ReturnType<typeof import("@/lib/testing/fake-supabase").fakeSupabase>,
  readCredits: vi.fn(),
  placeCall: vi.fn(),
  opener: vi.fn(async () => "opener: how did the evening go?"),
  followup: vi.fn(async (_n: string, _t: string, _p: string, reason?: string) => `followup:${reason ?? "no_answer"}`),
  whatsapp: vi.fn(async () => ({})),
  push: vi.fn(async () => ({ sent: 0, skipped: "no_subscriptions" })),
  email: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/integrations/supabase", () => ({ getSupabaseServerClient: () => m.db!.client }));
vi.mock("@/lib/billing/subscription", () => ({ getSubscriptionAccess: async () => ({ hasPlus: true }) }));
vi.mock("@/lib/billing/free-checkin", () => ({ ownersWhoUsedFreeCheckIn: async () => new Set(), pickFreeCheckIns: () => new Set() }));
vi.mock("@/lib/domain/nudges", () => ({ sendPlusSkipNotices: async () => undefined }));
vi.mock("@/lib/integrations/elevenlabs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/elevenlabs")>()),
  placeOutboundCall: m.placeCall,
  isElevenLabsCallingConfigured: () => true,
  getConversationOutcome: async () => null,
}));
vi.mock("@/lib/integrations/elevenlabs-credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/elevenlabs-credits")>()),
  readVoiceCredits: m.readCredits,
}));
vi.mock("@/lib/domain/voice-checkin-context", () => ({ buildVoiceCheckinContext: async () => null, NO_CIRCLE_PASS_ON: "none" }));
vi.mock("@/lib/integrations/push", () => ({ sendPushToOwner: m.push }));
vi.mock("@/lib/integrations/resend", () => ({
  sendAuthEmail: m.email,
  checkInEmailHtml: () => "html",
  checkInEmailText: () => "text",
  missedCheckInEmailHtml: () => "html",
  missedCheckInEmailText: () => "text",
  nuraEmailLogoAttachment: () => [],
}));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsappText: m.whatsapp }));
vi.mock("@/lib/domain/message-intake", () => ({ composeCheckinOpener: m.opener, composeMissedCallFollowup: m.followup }));
vi.mock("@/lib/domain/idle-wellness", () => ({
  scheduleIdleWellnessCheckIns: async () => ({ scheduled: [], skipped: 0 }),
  isWithinQuietHours: () => false,
  nextTimeOutsideQuietHours: (d: Date) => d,
}));
vi.mock("@/lib/health/health-signals", () => ({ scheduleHealthSignalCheckIns: async () => ({ scheduled: [], skipped: 0 }) }));
vi.mock("@/lib/profile-settings", () => ({ readProfileSettings: () => ({ quietHours: { enabled: false } }) }));
vi.mock("@/lib/domain/outreach-backoff", () => ({
  backoffDecision: () => "send",
  loadBackoff: async () => new Map(),
  pauseNote: () => "",
  PAUSE_ASKED: "paused_asked",
  PAUSE_HELD: "paused_quiet",
}));
vi.mock("@/lib/domain/user-timezone", () => ({ resolveUserTimeZone: async () => "Europe/London" }));
vi.mock("@/lib/care-recipient", () => ({
  RECIPIENT_QUIET_HOURS: { enabled: false, start: "21:00", end: "08:00" },
  hasCalledRecipientBefore: async () => false,
  loadRecipientsForPlans: async () => new Map(),
  loadRecipientForPlan: async () => null,
  recipientCallSummaryText: () => "",
}));
vi.mock("@/lib/ai/trace", () => ({ withAiTrace: (_c: unknown, fn: () => unknown) => fn() }));

import { POST } from "./route";

const due = {
  id: "ci-1",
  owner_id: "owner-1",
  plan_id: "plan-1",
  prompt: "ask how the evening went",
  scheduled_for: new Date(Date.now() - 60_000).toISOString(),
  contact_phone: "+447000000000",
  channel: "voice",
  nura_plans: { title: "Evening routine", category: "general" },
};

function makeDb() {
  return fakeSupabase(
    (q) => {
      if (q.table === "nura_check_ins" && q.op === "select" && q.filters.some(([f, c]) => f === "is" && c === "triggered_at"))
        return { data: [due] };
      if (q.table === "nura_check_ins" && q.op === "update" && q.selected) return { data: [{ id: "ci-1" }] }; // the claim
      if (q.table === "nura_profiles")
        return { data: [{ id: "owner-1", display_name: "Sam Example", phone: "+447000000000", preferred_checkin_channels: ["voice", "whatsapp", "in_app"] }] };
      return undefined;
    },
    { email: "sam@example.org", user_metadata: {} },
  );
}

const reading = (level: string, remaining: number | null) => ({
  level,
  credits: remaining === null ? null : { used: 10_000 - remaining, limit: 10_000, remaining, resetsAt: null, tier: "payg" },
  error: remaining === null ? "ElevenLabs subscription read failed (401)." : null,
  floor: 1000,
  alertFraction: 0.2,
});

function request() {
  return new NextRequest("https://usenura.app/api/agent/trigger-check-ins", {
    method: "POST",
    headers: { "x-agent-secret": "s3cret" },
  });
}

beforeEach(() => {
  vi.stubEnv("AGENT_TOOL_SECRET", "s3cret");
  for (const fn of [m.readCredits, m.placeCall, m.opener, m.followup, m.whatsapp, m.push, m.email]) fn.mockClear();
  m.db = makeDb();
});

const lastCheckInUpdate = () =>
  m.db!.updates("nura_check_ins").filter((u) => u.filters.some(([, c, v]) => c === "id" && v === "ci-1")).at(-1)!;

describe("trigger-check-ins: ElevenLabs credit guard", () => {
  it("doesn't ring when credits are under one call's worth; sends the check-in as a WhatsApp text instead", async () => {
    m.readCredits.mockResolvedValue(reading("exhausted", 127));
    const res = await POST(request());
    const body = await res.json();

    expect(m.placeCall).not.toHaveBeenCalled();
    expect(m.opener).toHaveBeenCalledWith("Sam", "Evening routine", "ask how the evening went", "general");
    expect(m.whatsapp).toHaveBeenCalledWith("447000000000", "opener: how did the evening go?");
    expect(m.followup).not.toHaveBeenCalled();
    expect(body.triggered).toEqual([expect.objectContaining({ checkInId: "ci-1", status: "sent_whatsapp", voiceUnavailable: true })]);
    expect(lastCheckInUpdate().values).toMatchObject({ call_status: "sent_whatsapp" });
    expect(String(lastCheckInUpdate().values?.call_error)).toMatch(
      /^Call not placed \(127 of 10000 ElevenLabs credits left, under the 1000 needed for a call\); sent whatsapp instead of calling\.$/,
    );
  });

  it("falls back to push/email when WhatsApp isn't allowed", async () => {
    m.readCredits.mockResolvedValue(reading("exhausted", 0));
    m.db = fakeSupabase(
      (q) => {
        if (q.table === "nura_check_ins" && q.op === "select" && q.filters.some(([f, c]) => f === "is" && c === "triggered_at"))
          return { data: [due] };
        if (q.table === "nura_check_ins" && q.op === "update" && q.selected) return { data: [{ id: "ci-1" }] };
        if (q.table === "nura_profiles")
          return { data: [{ id: "owner-1", display_name: "Sam", phone: "+447000000000", preferred_checkin_channels: ["voice", "in_app"] }] };
        return undefined;
      },
      { email: "sam@usenura-test.org", user_metadata: {} },
    );
    await POST(request());
    expect(m.placeCall).not.toHaveBeenCalled();
    expect(m.whatsapp).not.toHaveBeenCalled();
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(lastCheckInUpdate().values).toMatchObject({ call_status: "escalated_email" });
  });

  it("places the call as usual when credits are fine", async () => {
    m.readCredits.mockResolvedValue(reading("ok", 10_000));
    m.placeCall.mockResolvedValue({ success: true, conversation_id: "conv_new" });
    await POST(request());
    expect(m.placeCall).toHaveBeenCalledTimes(1);
    expect(lastCheckInUpdate().values).toMatchObject({ call_status: "placed", call_conversation_id: "conv_new" });
  });

  it("when ElevenLabs refuses to start the call: real reason recorded, text sent, follow-up told it was Nura's failure", async () => {
    const { VoiceCallStartError } = await import("@/lib/integrations/elevenlabs");
    m.readCredits.mockResolvedValue(reading("unknown", null));
    m.placeCall.mockRejectedValue(new VoiceCallStartError("The AI agent you are trying to reach is not available.", 400));
    await POST(request());

    expect(m.followup).toHaveBeenCalledWith("Sam", "Evening routine", "ask how the evening went", "platform_failure");
    expect(m.whatsapp).toHaveBeenCalledWith("447000000000", "followup:platform_failure");
    expect(lastCheckInUpdate().values).toMatchObject({
      call_status: "escalated_whatsapp",
      call_error: "Voice unavailable (call failed to start: The AI agent you are trying to reach is not available.); sent whatsapp instead.",
    });
  });
});
