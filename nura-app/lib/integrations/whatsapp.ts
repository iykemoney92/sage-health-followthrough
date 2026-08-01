import { logger } from "@/lib/logger";

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
