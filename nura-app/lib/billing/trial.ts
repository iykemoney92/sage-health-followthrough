/** Enforced card-linked Plus trial — charged only after this many days. */
export const CARD_TRIAL_DAYS = 14;

/**
 * Soft-trial length for the legacy skip-paywall path.
 * Kept equal to the card trial so nothing in the product still promises 7 days.
 */
export const SOFT_TRIAL_DAYS = CARD_TRIAL_DAYS;
