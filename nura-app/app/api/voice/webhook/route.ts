import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { parseConversationOutcome, type RawConversationBody } from "@/lib/integrations/elevenlabs";
import { resolveCallForCheckIn, type ResolvableCheckIn } from "@/lib/domain/call-outcome";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
/** ElevenLabs post-call webhooks fire the moment a conversation ends - ack fast, resolve in the background. */
export const maxDuration = 30;

// Replay-attack window ElevenLabs' own SDKs use when validating `t=` in the signature header.
const SIGNATURE_TOLERANCE_SECONDS = 1800;

/**
 * ElevenLabs signs webhook payloads as `ElevenLabs-Signature: t=<unix_ts>,v0=<hex_hmac>`, where
 * the HMAC-SHA256 is computed over `${timestamp}.${rawBody}` using the shared webhook secret.
 */
function verifyElevenLabsSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed outside local development - never accept unsigned webhook traffic in prod.
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[voice/webhook] ELEVENLABS_WEBHOOK_SECRET unset — allowing unsigned requests in development only");
    return true;
  }
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  if (!timestamp) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signatures = parts.filter((part) => part.startsWith("v0=")).map((part) => part.slice(3));
  if (signatures.length === 0) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  return signatures.some((sig) => {
    const provided = Buffer.from(sig, "hex");
    return provided.length === expectedBuf.length && timingSafeEqual(provided, expectedBuf);
  });
}

type WebhookPayload = {
  type?: string;
  data?: RawConversationBody & { conversation_id?: string };
};

async function handlePostCallWebhook(payload: WebhookPayload) {
  const conversationId = payload.data?.conversation_id;
  if (!conversationId) return;

  const outcome = parseConversationOutcome(payload.data ?? null);
  if (!outcome) return;

  const supabase = getSupabaseServerClient();

  // Only acts on a row that's still waiting on THIS conversation - if a redial has already
  // overwritten call_conversation_id with a newer attempt, this lookup finds nothing and a
  // late/duplicate webhook for the earlier attempt safely no-ops.
  const { data: checkIn } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, contact_phone, call_conversation_id, triggered_at, call_attempts, nura_plans(title)")
    .eq("call_conversation_id", conversationId)
    .eq("call_status", "placed")
    .maybeSingle();

  if (!checkIn) return;

  await resolveCallForCheckIn(supabase, checkIn as unknown as ResolvableCheckIn, outcome, false);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyElevenLabsSignature(rawBody, request.headers.get("elevenlabs-signature"))) {
      logger.warn("voice_webhook.invalid_signature");
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }

    let body: WebhookPayload | null = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // leave body null
    }

    // Only the full transcription webhook carries the fields resolveCallForCheckIn needs;
    // ignore post_call_audio / call_initiation_failure and anything unrecognized.
    if (!body || body.type !== "post_call_transcription") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Ack immediately, same pattern as the WhatsApp webhook - a slow DB write must never look
    // like a timeout to ElevenLabs and trigger a retry storm.
    after(() =>
      handlePostCallWebhook(body!).catch((error) => {
        logger.error("voice_webhook.background_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }),
    );

    return NextResponse.json({ ok: true, accepted: true });
  } catch (error) {
    logger.error("voice_webhook.unhandled_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    // Still 200 when possible so ElevenLabs doesn't disable/back off the webhook endpoint.
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Webhook failed." }, { status: 200 });
  }
}
