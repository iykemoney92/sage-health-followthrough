// Client-safe half of referrals (lib/referrals.ts pulls in node:crypto).

/**
 * The message that goes with an invite link. It says nothing about the sender's health - only
 * that they use Nura - because it lands in someone else's chat.
 *
 * The gift is left out inside the app: App Review reads anything that looks like free Plus
 * outside the App Store closely, so the native shell shares a plain recommendation and the
 * landing page explains the offer.
 */
export function referralShareText(url: string, { mentionGift }: { mentionGift: boolean }) {
  return mentionGift
    ? `I've been using Nura to keep on top of appointments and follow-ups. Here's 30 days of Nura Plus free, no card needed: ${url}`
    : `I've been using Nura to keep on top of appointments and follow-ups. Have a look: ${url}`;
}

/** A wa.me link with no recipient: WhatsApp asks the sender who to send it to. */
export function referralWhatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
