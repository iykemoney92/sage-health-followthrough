type PlaceOutboundCallInput = {
  toNumber: string;
  dynamicVariables: Record<string, string>;
  conversationConfigOverride?: Record<string, unknown>;
};

type OutboundCallResult = {
  success: boolean;
  message?: string;
  conversation_id?: string;
  callSid?: string;
};

export function isElevenLabsCallingConfigured() {
  const config = getElevenLabsCallingConfig();
  return Boolean(
    config.apiKey &&
    config.agentId &&
    config.agentPhoneNumberId,
  );
}

export function isClaritiElevenLabsAgentConfigured() {
  return Boolean(process.env.CLARITI_ELEVENLABS_AGENT_ID);
}

export async function placeOutboundCall({
  conversationConfigOverride,
  dynamicVariables,
  toNumber,
}: PlaceOutboundCallInput) {
  const { apiKey, agentId, agentPhoneNumberId } = getElevenLabsCallingConfig();

  if (!apiKey || !agentId || !agentPhoneNumberId) {
    throw new Error("ElevenLabs outbound calling is not configured.");
  }

  const conversationInitiationClientData: Record<string, unknown> = {
    dynamic_variables: dynamicVariables,
  };

  if (conversationConfigOverride) {
    conversationInitiationClientData.conversation_config_override = conversationConfigOverride;
  }

  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: toNumber,
      call_recording_enabled: true,
      conversation_initiation_client_data: conversationInitiationClientData,
    }),
  });

  const body = (await response.json().catch(() => null)) as OutboundCallResult | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message ?? `ElevenLabs outbound call failed (${response.status}).`);
  }

  return body;
}

export function toE164(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/[^\d]/g, "")}`;
  return `+${trimmed.replace(/[^\d]/g, "")}`;
}

function getElevenLabsCallingConfig() {
  return {
    apiKey: process.env.CLARITI_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY,
    agentId: process.env.CLARITI_ELEVENLABS_AGENT_ID,
    agentPhoneNumberId: process.env.CLARITI_ELEVENLABS_AGENT_PHONE_NUMBER_ID || process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID,
  };
}
