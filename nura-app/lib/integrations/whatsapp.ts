import { logger } from "@/lib/logger";

// Matches the in-app upload cap (lib/ai/attachments.ts) so WhatsApp media gets the same
// size treatment instead of silently blowing up the Claude request payload.
const MAX_MEDIA_BYTES = 4_500_000;

// Per-call cap, not cumulative - a stalled connection on either fetch used to hang until the
// route's 60s maxDuration killed the whole function before any catch block could log anything.
// Sized to leave most of the budget for resolveDecision's own 45s ceiling plus the reply send.
const MEDIA_FETCH_TIMEOUT_MS = 9_000;

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

  let stage: "metadata" | "download" = "metadata";
  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MEDIA_FETCH_TIMEOUT_MS),
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

    stage = "download";
    const fileResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MEDIA_FETCH_TIMEOUT_MS),
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

    logger.info("whatsapp.media.download_succeeded", {
      mediaId,
      bytes: buffer.byteLength,
      mimeType: meta.mime_type ?? "application/octet-stream",
    });
    return { base64: buffer.toString("base64"), mimeType: meta.mime_type ?? "application/octet-stream" };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    logger.error("whatsapp.media.download_error", {
      mediaId,
      stage,
      timedOut,
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

// ---------------------------------------------------------------------------------------------
// Messages and calls Nura starts herself.
//
// Meta only delivers a free-form text within 24 hours of the person's last message (the
// "customer service window"). Outside it the send is accepted and then dropped (error 131047),
// which is why no WhatsApp check-in was ever delivered before 25 Nov 2026. Outside the window
// Nura must send an approved template; the person's reply reopens the window.
// ---------------------------------------------------------------------------------------------

const GRAPH_CALLING_VERSION = "v23.0";
/** Meta: "More than 24 hours have passed since the recipient last replied". */
export const META_OUTSIDE_WINDOW_ERROR = 131047;

/** Vercel env values for these carry a trailing newline; a raw one breaks JSON bodies. */
function whatsappConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

export function whatsappPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
}

export function checkinTemplateName() {
  return process.env.WHATSAPP_CHECKIN_TEMPLATE?.trim() || "nura_checkin";
}

export function callPermissionTemplateName() {
  return process.env.WHATSAPP_CALL_PERMISSION_TEMPLATE?.trim() || "nura_call_permission";
}

export function whatsappTemplateLanguage() {
  return process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
}

/** The numeric code out of a Graph API error body, e.g. 131047. */
export function metaErrorCode(errorText: string | null | undefined): number | null {
  if (!errorText) return null;
  try {
    const code = (JSON.parse(errorText) as { error?: { code?: unknown } })?.error?.code;
    return typeof code === "number" ? code : null;
  } catch {
    const match = /\(#(\d{3,6})\)/.exec(errorText);
    return match ? Number(match[1]) : null;
  }
}

/**
 * Template variables can't hold new lines, tabs or runs of spaces, and Meta rejects empty ones.
 * Keeps them short so the fixed wording stays the bulk of the message.
 */
export function templateParam(value: string | null | undefined, fallback: string, maxLength = 80) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

export async function sendWhatsappTemplate(to: string, templateName: string, bodyParams: string[]) {
  const config = whatsappConfig();
  if (!config) {
    logger.warn("whatsapp.template.skipped_not_configured");
    return { skipped: true as const };
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_CALLING_VERSION}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: whatsappTemplateLanguage() },
        components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not send WhatsApp template.");
    logger.error("whatsapp.template.failed", {
      status: response.status,
      template: templateName,
      toSuffix: to.slice(-4),
      error: errorText.slice(0, 500),
    });
    return { skipped: false as const, error: errorText };
  }

  return { skipped: false as const };
}

export type WhatsappCallPermission = {
  /** "no_permission" | "temporary" | "permanent" */
  status: string;
  /** The person has said yes and Meta's call limits allow a call now. */
  canStartCall: boolean;
  /** Meta's limits (1 a day, 2 a week) allow asking now. */
  canRequest: boolean;
};

type CallPermissionResponse = {
  permission?: { status?: string };
  actions?: Array<{ action_name?: string; can_perform_action?: boolean }>;
};

export function parseCallPermission(body: CallPermissionResponse | null): WhatsappCallPermission | null {
  const status = body?.permission?.status;
  if (!status) return null;
  const can = (name: string) => Boolean(body?.actions?.find((a) => a.action_name === name)?.can_perform_action);
  return {
    status,
    canStartCall: (status === "temporary" || status === "permanent") && can("start_call"),
    canRequest: status === "no_permission" && can("send_call_permission_request"),
  };
}

/** Whether Nura may call this person on WhatsApp right now. Null when Meta can't say. */
export async function getWhatsappCallPermission(userWaId: string): Promise<WhatsappCallPermission | null> {
  const config = whatsappConfig();
  if (!config) return null;
  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_CALLING_VERSION}/${config.phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(userWaId)}`,
      { headers: { Authorization: `Bearer ${config.token}` }, signal: AbortSignal.timeout(4_000) },
    );
    if (!response.ok) {
      logger.warn("whatsapp.call_permission.lookup_failed", {
        status: response.status,
        error: (await response.text().catch(() => "")).slice(0, 300),
      });
      return null;
    }
    return parseCallPermission((await response.json().catch(() => null)) as CallPermissionResponse | null);
  } catch (error) {
    logger.warn("whatsapp.call_permission.lookup_error", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
