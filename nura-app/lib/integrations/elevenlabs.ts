type PlaceOutboundCallInput = {
  toNumber: string;
  dynamicVariables: Record<string, string>;
};

type OutboundCallResult = {
  success: boolean;
  message?: string;
  conversation_id?: string;
  callSid?: string;
};

export function isElevenLabsCallingConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_AGENT_ID &&
    process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID,
  );
}

export async function placeOutboundCall({ toNumber, dynamicVariables }: PlaceOutboundCallInput) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  if (!apiKey || !agentId || !agentPhoneNumberId) {
    throw new Error("ElevenLabs outbound calling is not configured.");
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
