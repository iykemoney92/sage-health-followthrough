export type CheckinChannel = "voice" | "whatsapp" | "in_app";

/**
 * Picks the default proactive check-in channel from what the user allows.
 * Phone calls are preferred when voice is allowed — WhatsApp is a fallback /
 * missed-call path, not the default just because the chat is on WhatsApp.
 */
export function primaryCheckinChannel(
  allowed: CheckinChannel[],
  preferred?: string | null,
): CheckinChannel {
  if (
    (preferred === "voice" || preferred === "whatsapp" || preferred === "in_app") &&
    allowed.includes(preferred)
  ) {
    return preferred;
  }
  if (allowed.includes("voice")) return "voice";
  if (allowed.includes("whatsapp")) return "whatsapp";
  if (allowed.includes("in_app")) return "in_app";
  return allowed[0] ?? "in_app";
}

/** Keep the preferred channel first in the stored allow-list for stable defaults. */
export function orderCheckinChannels(
  channels: CheckinChannel[],
  preferred?: string | null,
): CheckinChannel[] {
  const unique = [...new Set(channels)];
  const primary = primaryCheckinChannel(unique, preferred);
  return [primary, ...unique.filter((c) => c !== primary)];
}
