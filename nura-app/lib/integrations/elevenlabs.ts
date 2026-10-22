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
  hasTranscript: boolean;
  /** ElevenLabs' own short summary of the conversation, once it has finished processing. */
  summary?: string | null;
};

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
    throw new Error("ElevenLabs outbound calling is not configured.");
  }

  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
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

  const body = (await response.json().catch(() => null)) as OutboundCallResult | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message ?? `ElevenLabs outbound call failed (${response.status}).`);
  }

  return body;
}

export type RawConversationBody = {
  status?: string;
  call_successful?: string | boolean | null;
  metadata?: { call_duration_secs?: number; duration_secs?: number } | null;
  analysis?: { call_successful?: string | boolean | null; transcript_summary?: string | null } | null;
  transcript?: unknown[] | null;
};

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
  const hasTranscript = Array.isArray(body.transcript) && body.transcript.length > 0;

  return {
    status: String(body.status ?? "unknown"),
    callSuccessful,
    durationSecs,
    hasTranscript,
    summary: body.analysis?.transcript_summary?.trim() || null,
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
