type PlaceOutboundCallInput = {
  toNumber: string;
  dynamicVariables: Record<string, string>;
  /** Optional per-journey agent override (e.g. postpartum midwife voice). */
  agentId?: string;
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
};

export function isElevenLabsCallingConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_AGENT_ID &&
    process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID,
  );
}

export async function placeOutboundCall({ toNumber, dynamicVariables, agentId }: PlaceOutboundCallInput) {
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
  analysis?: { call_successful?: string | boolean | null } | null;
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
