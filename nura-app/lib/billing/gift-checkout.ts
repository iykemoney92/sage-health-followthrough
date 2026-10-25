/**
 * Card step for someone on an invite gift (30 days of Plus, no card). Adding a card is
 * optional; when they do, the Stripe trial is set to end exactly when the gift does, so
 * Plus carries on without a gap and nothing is charged before the gift's last day.
 *
 * This goes straight to Stripe Checkout rather than the RevenueCat purchase link: that
 * link always starts the product's fixed 14-day trial, which would charge a gifted friend
 * halfway through the month they were promised for free.
 */

/** Stripe Checkout refuses a subscription trial_end less than 48 hours away. */
export const STRIPE_MIN_TRIAL_END_HOURS = 48;

/**
 * When the card trial should end for a gift running until `giftUntil`, or null when the
 * gift ends too soon for Stripe to accept (the normal checkout is used instead).
 */
export function giftTrialEnd(giftUntil: string | null | undefined, now = new Date()): Date | null {
  if (!giftUntil) return null;
  const end = new Date(giftUntil);
  if (Number.isNaN(end.getTime())) return null;
  // A small margin so a slow Checkout page load doesn't tip it under Stripe's minimum.
  const minimum = now.getTime() + (STRIPE_MIN_TRIAL_END_HOURS + 1) * 60 * 60_000;
  return end.getTime() >= minimum ? end : null;
}

/**
 * The trial end checkout-success should record: the one the session was created with when
 * it's still ahead, else the standard card trial from now.
 */
export function recordedTrialEnd(metadataTrialEndsAt: string | null | undefined, fallbackDays: number, now = new Date()) {
  if (metadataTrialEndsAt) {
    const end = new Date(metadataTrialEndsAt);
    if (!Number.isNaN(end.getTime()) && end.getTime() > now.getTime()) return end.toISOString();
  }
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + fallbackDays);
  return fallback.toISOString();
}
