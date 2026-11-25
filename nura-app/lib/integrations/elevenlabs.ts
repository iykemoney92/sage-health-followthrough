type PlaceOutboundCallInput = {
  toNumber: string;
  dynamicVariables: Record<string, string>;
  /** Optional per-journey agent override (e.g. postpartum midwife voice). */
  agentId?: string;
  /**
   * Replaces the agent's opening line for this call only - used for calls to the person a plan
   * is about, who hasn't heard of Nura. Needs first_message overrides enabled on the agent.
   */
  firstMessage?: string;
};

type OutboundCallResult = {
  success: boolean;
  message?: string;
  conversation_id?: string;
  callSid?: string;
};

export type ConversationOutcome = {
  status: string;
  callSuccessful: string | null;
  durationSecs: number;
  /**
   * The person actually said something. ElevenLabs writes a "..." user turn every time nobody
   * replies, so a call to voicemail or dead air still has a transcript - those turns don't count.
   */
  hasTranscript: boolean;
  /** The agent's voicemail_detection tool fired (it left the voicemail message and hung up). */
  reachedVoicemail?: boolean;
  /** ElevenLabs' own short summary of the conversation, once it has finished processing. */
  summary?: string | null;
  /**
   * The call never started because of a problem on our side (ElevenLabs refused it: credits ran
   * out, "agent not available", a config error). The person did nothing wrong - they never rang.
   */
  platformError?: VoicePlatformError | null;
};

export type VoicePlatformError = {
  code: number | null;
  reason: string;
  /** Looks account-wide (credits/quota, agent not available, auth) - every call would fail the same way. */
  accountWide: boolean;
};

/**
 * ElevenLabs answers a call it won't run with code 3000 "The AI agent you are trying to reach is
 * not available." That is what every Nura call got from 20 Nov 2026 when the free credits ran out,
 * so it's treated as account-wide, like an explicit quota/credit/auth error.
 */
export function isAccountWideVoiceError(code: number | null | undefined, text: string | null | undefined) {
  if (code === 3000 || code === 401 || code === 402 || code === 429) return true;
  return /quota|credit|insufficient|not available|unavailable|payment|subscription|exceeded|unauthori[sz]ed|missing.*permission|not configured/i.test(
    text ?? "",
  );
}

/** Thrown when ElevenLabs refuses to start an outbound call (the phone never rang). */
export class VoiceCallStartError extends Error {
  readonly status: number | null;
  readonly accountWide: boolean;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "VoiceCallStartError";
    this.status = status;
    this.accountWide = isAccountWideVoiceError(status, message) || (status !== null && status >= 500);
  }
}

export function isElevenLabsCallingConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_AGENT_ID &&
    process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID,
  );
}

export async function placeOutboundCall({ toNumber, dynamicVariables, agentId, firstMessage }: PlaceOutboundCallInput) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const defaultAgentId = process.env.ELEVENLABS_AGENT_ID;
  const resolvedAgentId = agentId || defaultAgentId;
  const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  if (!apiKey || !resolvedAgentId || !agentPhoneNumberId) {
    throw new VoiceCallStartError("ElevenLabs outbound calling is not configured.", null);
  }

  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: resolvedAgentId,
        agent_phone_number_id: agentPhoneNumberId,
        to_number: toNumber,
        call_recording_enabled: true,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
          ...(firstMessage ? { conversation_config_override: { agent: { first_message: firstMessage } } } : {}),
        },
      }),
    });
  } catch (error) {
    throw new VoiceCallStartError(
      `ElevenLabs could not be reached (${error instanceof Error ? error.message : "network error"}).`,
      503,
    );
  }

  const body = (await response.json().catch(() => null)) as (OutboundCallResult & { detail?: unknown }) | null;

  if (!response.ok || !body?.success) {
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : body?.detail && typeof body.detail === "object"
          ? String((body.detail as { message?: unknown }).message ?? "")
          : "";
    throw new VoiceCallStartError(
      body?.message || detail || `ElevenLabs outbound call failed (${response.status}).`,
      response.ok ? null : response.status,
    );
  }

  return body;
}

type PlaceWhatsappCallInput = {
  /** The person's WhatsApp number: digits only, country code first. */
  whatsappUserId: string;
  /** Nura's WhatsApp phone number ID (Meta's ID, not the number). */
  whatsappPhoneNumberId: string;
  /** Template ElevenLabs sends first if the person hasn't yet allowed calls. */
  permissionTemplateName: string;
  permissionTemplateLanguage: string;
  dynamicVariables: Record<string, string>;
  agentId?: string;
  firstMessage?: string;
};

/**
 * Rings the person on WhatsApp instead of their phone line. Only call this once Meta says the
 * person has allowed calls: without permission ElevenLabs sends the permission template and
 * holds the call until they answer it, which could be hours later.
 */
export async function placeWhatsappCall(input: PlaceWhatsappCallInput) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const resolvedAgentId = input.agentId || process.env.ELEVENLABS_AGENT_ID?.trim();
  if (!apiKey || !resolvedAgentId) {
    throw new VoiceCallStartError("ElevenLabs WhatsApp calling is not configured.", null);
  }

  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/convai/whatsapp/outbound-call", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: resolvedAgentId,
        whatsapp_phone_number_id: input.whatsappPhoneNumberId,
        whatsapp_user_id: input.whatsappUserId,
        whatsapp_call_permission_request_template_name: input.permissionTemplateName,
        whatsapp_call_permission_request_template_language_code: input.permissionTemplateLanguage,
        conversation_initiation_client_data: {
          dynamic_variables: input.dynamicVariables,
          ...(input.firstMessage ? { conversation_config_override: { agent: { first_message: input.firstMessage } } } : {}),
        },
      }),
    });
  } catch (error) {
    throw new VoiceCallStartError(
      `ElevenLabs could not be reached (${error instanceof Error ? error.message : "network error"}).`,
      503,
    );
  }

  const body = (await response.json().catch(() => null)) as (OutboundCallResult & { detail?: unknown }) | null;
  if (!response.ok || !body?.success || !body.conversation_id) {
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : body?.detail && typeof body.detail === "object"
          ? JSON.stringify(body.detail).slice(0, 300)
          : "";
    throw new VoiceCallStartError(
      body?.message || detail || `ElevenLabs WhatsApp call failed (${response.status}).`,
      response.ok ? null : response.status,
    );
  }

  return body;
}

export type RawConversationBody = {
  status?: string;
  call_successful?: string | boolean | null;
  metadata?: {
    call_duration_secs?: number;
    duration_secs?: number;
    termination_reason?: string | null;
    /** Set when ElevenLabs refused to start the call, e.g. {code: 3000, reason: "The AI agent ... is not available."}. */
    error?: { code?: number | null; reason?: string | null; error_type?: string | null } | null;
  } | null;
  analysis?: { call_successful?: string | boolean | null; transcript_summary?: string | null } | null;
  transcript?: unknown[] | null;
};

type TranscriptTurn = {
  role?: string;
  message?: string | null;
  platform_event?: string | null;
  tool_calls?: Array<{ tool_name?: string } | null> | null;
} | null;

/** A user turn with real words in it - not the "..." placeholder ElevenLabs writes on a turn timeout. */
function isRealUserTurn(turn: TranscriptTurn) {
  if (turn?.role !== "user" || turn.platform_event) return false;
  const text = (turn.message ?? "").replace(/[.\s…]/g, "");
  return text.length > 0;
}

/**
 * Shared shape parser for a conversation outcome — used both by the polling GET below and by
 * the ElevenLabs post-call webhook handler, whose payload carries the same fields under `data`.
 * Keeping this in one place means the poller and the webhook can never disagree about what
 * counts as "connected".
 */
export function parseConversationOutcome(body: RawConversationBody | null): ConversationOutcome | null {
  if (!body) return null;

  const callSuccessfulRaw = body.analysis?.call_successful ?? body.call_successful ?? null;
  const callSuccessful =
    callSuccessfulRaw === true
      ? "success"
      : callSuccessfulRaw === false
        ? "failure"
        : typeof callSuccessfulRaw === "string"
          ? callSuccessfulRaw
          : null;

  const durationSecs =
    Number(body.metadata?.call_duration_secs ?? body.metadata?.duration_secs ?? 0) || 0;
  const turns = (Array.isArray(body.transcript) ? body.transcript : []) as TranscriptTurn[];
  const hasTranscript = turns.some(isRealUserTurn);
  const reachedVoicemail =
    turns.some((turn) => (turn?.tool_calls ?? []).some((call) => call?.tool_name === "voicemail_detection")) ||
    /voicemail/i.test(body.metadata?.termination_reason ?? "");

  const rawError = body.metadata?.error ?? null;
  const platformError: VoicePlatformError | null =
    rawError && (rawError.code != null || rawError.reason)
      ? {
          code: typeof rawError.code === "number" ? rawError.code : null,
          reason: (rawError.reason ?? rawError.error_type ?? "unknown error").trim(),
          accountWide: isAccountWideVoiceError(rawError.code, `${rawError.reason ?? ""} ${rawError.error_type ?? ""}`),
        }
      : null;

  return {
    status: String(body.status ?? "unknown"),
    callSuccessful,
    durationSecs,
    hasTranscript,
    reachedVoicemail,
    summary: body.analysis?.transcript_summary?.trim() || null,
    platformError,
  };
}

/** Poll ElevenLabs for whether an outbound check-in call was actually answered. */
export async function getConversationOutcome(conversationId: string): Promise<ConversationOutcome | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !conversationId) return null;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      headers: { "xi-api-key": apiKey },
    });
    if (!response.ok) return null;

    const body = (await response.json().catch(() => null)) as RawConversationBody | null;
    return parseConversationOutcome(body);
  } catch {
    return null;
  }
}

/**
 * Permanently deletes one conversation (audio and transcript) from ElevenLabs. Used when a
 * person deletes their Nura account, so their call recordings go with the rest of their data.
 * Returns true when it's gone, including when ElevenLabs no longer has it.
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !conversationId) return false;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
      method: "DELETE",
      headers: { "xi-api-key": apiKey },
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
