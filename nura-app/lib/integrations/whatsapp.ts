import { logger } from "@/lib/logger";

// Matches the in-app upload cap (lib/ai/attachments.ts) so WhatsApp media gets the same
// size treatment instead of silently blowing up the Claude request payload.
const MAX_MEDIA_BYTES = 4_500_000;

/**
 * WhatsApp inbound messages only carry a media id, not the bytes - this resolves that id to
 * a short-lived CDN URL via the Graph API, then downloads and base64-encodes the file so it
 * can be handed to the same vision/transcription pipeline the in-app uploads use.
 */
export async function downloadWhatsappMedia(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    logger.warn("whatsapp.media.skipped_not_configured");
    return null;
  }

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaResponse.ok) {
      logger.error("whatsapp.media.metadata_failed", { status: metaResponse.status, mediaId });
      return null;
    }

    const meta = (await metaResponse.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.url) {
      logger.error("whatsapp.media.no_url", { mediaId });
      return null;
    }
    if (typeof meta.file_size === "number" && meta.file_size > MAX_MEDIA_BYTES) {
      logger.warn("whatsapp.media.too_large", { mediaId, fileSize: meta.file_size });
      return null;
    }

    const fileResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fileResponse.ok) {
      logger.error("whatsapp.media.download_failed", { status: fileResponse.status, mediaId });
      return null;
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) {
      logger.warn("whatsapp.media.too_large_after_download", { mediaId, size: buffer.byteLength });
      return null;
    }

    return { base64: buffer.toString("base64"), mimeType: meta.mime_type ?? "application/octet-stream" };
  } catch (error) {
    logger.error("whatsapp.media.download_error", {
      mediaId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function sendWhatsappText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    logger.warn("whatsapp.send.skipped_not_configured");
    return { skipped: true as const };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not send WhatsApp message.");
    logger.error("whatsapp.send.failed", {
      status: response.status,
      toSuffix: to.slice(-4),
      error: errorText.slice(0, 500),
    });
    return { skipped: false as const, error: errorText };
  }

  return { skipped: false as const };
}
