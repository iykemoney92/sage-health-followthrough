import { HEALTH_BRIEF_HEADER } from "@/lib/health/health-brief";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { parseConversationOutcome, type RawConversationBody } from "@/lib/integrations/elevenlabs";
import { AI_TRACE_PRODUCT, aiTraceEnabled, hasOptedOut } from "./trace";
import { sendVoiceEvents, voiceCallEvents, type ElevenLabsConversation } from "./voice-trace-core";

/**
 * AI quality checks for Nura's voice calls (19 Nov 2026). Every finished call of the Nura voice agent reaches the
 * post-call webhook (app/api/voice/webhook), which sends it to PostHog LLM analytics (EU): one `$ai_trace` per call
 * and one `$ai_generation` per reply Nura spoke (lib/ai/voice-trace-core.ts). Text only, never audio; phone
 * numbers and email addresses are masked.
 *
 * The call belongs to the Nura account that scheduled it (the check-in's owner_id, the same Supabase user id the
 * app identifies with) - for a call to someone the person cares for, that is still the carer's account. Same
 * rules as the text tracing in ./trace.ts: production only, AI_TRACE=off stops it, nothing is sent for a person who
 * turned Product analytics off, and when the call was prepared with Apple Health / Health Connect data everything
 * Nura said on it is withheld (the person's own words still go).
 */

const LLM = "gemini-2.5-flash";
const HEALTH_WITHHELD = "[withheld: this call used Apple Health / Health Connect data]";

type CallData = RawConversationBody &
  ElevenLabsConversation & {
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null;
  };

type CheckInRow = { id: string; owner_id: string; plan_id: string | null; care_recipient_id?: string | null };

function callStatus(data: CallData): string {
  if (data.status === "failed") return "failed";
  const outcome = parseConversationOutcome(data);
  if (outcome?.reachedVoicemail) return "voicemail";
  return outcome?.hasTranscript ? "completed" : "no_answer";
}

/** Builds the events for one finished Nura call; exported for tests and the backfill check. */
export async function nuraVoiceTraceEvents(data: CallData, checkIn: CheckInRow | null) {
  const vars = data.conversation_initiation_client_data?.dynamic_variables ?? {};
  // Outbound check-ins are placed by our server, which sets user_id itself; the check-in row wins when found.
  const varUser = typeof vars.user_id === "string" && vars.user_id ? vars.user_id : null;
  const distinctId = checkIn?.owner_id ?? varUser;
  const usedHealthData = Object.values(vars).some((v) => typeof v === "string" && v.includes(HEALTH_BRIEF_HEADER));
  const forRecipient = typeof vars.on_behalf_of === "string" && vars.on_behalf_of.trim() !== "";
  return voiceCallEvents(data, {
    product: AI_TRACE_PRODUCT,
    span: forRecipient ? "care_recipient_call" : "checkin_call",
    distinctId,
    sessionId: checkIn?.plan_id ?? (typeof vars.plan_id === "string" ? vars.plan_id : null),
    callStatus: callStatus(data),
    model: LLM,
    withholdReplies: usedHealthData ? HEALTH_WITHHELD : null,
    extra: {
      check_in_id: checkIn?.id,
      plan_id: checkIn?.plan_id ?? undefined,
      call_kind: forRecipient ? "care_recipient" : checkIn ? "check_in" : "other",
      health_data_withheld: usedHealthData || undefined,
    },
  });
}

/** Called from the post-call webhook (in after()). Never throws. */
export async function traceNuraCall(data: CallData | undefined | null): Promise<void> {
  if (!aiTraceEnabled() || !data?.conversation_id) return;
  try {
    const { data: checkIn } = await getSupabaseServerClient()
      .from("nura_check_ins")
      .select("id, owner_id, plan_id")
      .eq("call_conversation_id", data.conversation_id)
      .maybeSingle();
    const events = await nuraVoiceTraceEvents(data, (checkIn as CheckInRow | null) ?? null);
    const distinctId = events[0]?.properties.$process_person_profile === false ? null : events[0]?.distinct_id;
    if (distinctId && (await hasOptedOut(distinctId))) return;
    await sendVoiceEvents(events);
  } catch (e) {
    console.error("[voice trace]", e instanceof Error ? e.message : String(e));
  }
}
