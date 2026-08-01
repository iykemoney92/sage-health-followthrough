import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";

export type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  cancel_reason?: string | null;
  expiration_reason?: string | null;
  is_trial_conversion?: boolean | null;
  store?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  price?: number | null;
  aliases?: string[] | null;
};

export type ProfileSubscriptionUpdate = {
  subscription_tier: "free" | "plus";
  subscription_status: "free" | "trialing" | "active" | "grace_period" | "cancelled" | "expired";
  subscription_current_period_ends_at: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isoFromMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

export function getPlusProductIds() {
  return (
    process.env.REVENUECAT_PLUS_PRODUCT_IDS ??
    "prod_UxrFQntebp8P6e,prod48328e2cc1,price_1TxvWrLRJZHcAjIaS9VlfzTM"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isPlusProduct(event: RevenueCatEvent, plusProductIds = getPlusProductIds()) {
  const entitlementIds = event.entitlement_ids ?? [];
  if (entitlementIds.includes("plus")) return true;
  return Boolean(event.product_id && plusProductIds.includes(event.product_id));
}

function isFutureIso(value: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function trialLengthDays(purchasedAtMs: number | null | undefined, expirationAtMs: number | null | undefined) {
  if (typeof purchasedAtMs !== "number" || typeof expirationAtMs !== "number") return null;
  const days = (expirationAtMs - purchasedAtMs) / MS_PER_DAY;
  if (!Number.isFinite(days) || days <= 0) return null;
  return days;
}

/**
 * If RC/Stripe started a shorter trial than our product promise, compute the
 * intended 14-day end from purchase time. Caller should also extend Stripe.
 */
export function desiredCardTrialEndsAt(event: RevenueCatEvent) {
  const purchasedAt = typeof event.purchased_at_ms === "number"
    ? event.purchased_at_ms
    : typeof event.event_timestamp_ms === "number"
      ? event.event_timestamp_ms
      : Date.now();
  return new Date(purchasedAt + CARD_TRIAL_DAYS * MS_PER_DAY).toISOString();
}

export function shouldExtendCardTrial(event: RevenueCatEvent) {
  if ((event.period_type ?? "").toUpperCase() !== "TRIAL") return false;
  const days = trialLengthDays(event.purchased_at_ms, event.expiration_at_ms);
  // Allow small clock skew / inclusive day counting around a week-long trial.
  return days != null && days < CARD_TRIAL_DAYS - 0.5;
}

/**
 * Maps a RevenueCat webhook event → nura_profiles subscription fields.
 * Returns null when the event should be acknowledged but not change access.
 */
export function subscriptionUpdateFor(
  event: RevenueCatEvent,
  options?: { extendShortTrials?: boolean },
): ProfileSubscriptionUpdate | null {
  const type = event.type ?? "UNKNOWN";
  const periodType = (event.period_type ?? "").toUpperCase();
  const periodEnd = isoFromMs(event.expiration_at_ms);
  const purchasedAt = isoFromMs(event.purchased_at_ms);
  const graceEnd = isoFromMs(event.grace_period_expiration_at_ms);
  const stillEntitled = isFutureIso(periodEnd);
  const plusEvent = isPlusProduct(event);
  const extendShortTrials = options?.extendShortTrials !== false;

  if (!plusEvent && !["TRANSFER", "SUBSCRIBER_ALIAS"].includes(type)) {
    return null;
  }

  // Refunds / support cancellations that end access immediately.
  const immediateCancel = type === "CANCELLATION" && (
    event.cancel_reason === "CUSTOMER_SUPPORT"
    || event.cancel_reason === "DEVELOPER_INITIATED"
    || (typeof event.price === "number" && event.price < 0)
    || !stillEntitled
  );

  if (type === "INITIAL_PURCHASE" || type === "TEMPORARY_ENTITLEMENT_GRANT" || type === "SUBSCRIPTION_EXTENDED") {
    const isTrial = periodType === "TRIAL" || periodType === "INTRO";
    const useExtendedTrial = isTrial && extendShortTrials && shouldExtendCardTrial(event);
    const trialEndsAt = useExtendedTrial ? desiredCardTrialEndsAt(event) : periodEnd;

    if (isTrial) {
      return {
        subscription_tier: "plus",
        subscription_status: "trialing",
        subscription_current_period_ends_at: trialEndsAt,
        trial_started_at: purchasedAt ?? new Date().toISOString(),
        trial_ends_at: trialEndsAt,
      };
    }

    return {
      subscription_tier: "plus",
      subscription_status: "active",
      subscription_current_period_ends_at: periodEnd,
    };
  }

  if (type === "RENEWAL" || type === "UNCANCELLATION") {
    if (periodType === "TRIAL" && !event.is_trial_conversion) {
      const useExtendedTrial = extendShortTrials && shouldExtendCardTrial(event);
      const trialEndsAt = useExtendedTrial ? desiredCardTrialEndsAt(event) : periodEnd;
      return {
        subscription_tier: "plus",
        subscription_status: "trialing",
        subscription_current_period_ends_at: trialEndsAt,
        trial_started_at: purchasedAt,
        trial_ends_at: trialEndsAt,
      };
    }

    // Paid renewal or uncancel — keep historical trial_ends_at untouched.
    return {
      subscription_tier: "plus",
      subscription_status: "active",
      subscription_current_period_ends_at: periodEnd,
    };
  }

  if (type === "PRODUCT_CHANGE") {
    return {
      subscription_tier: "plus",
      subscription_status: periodType === "TRIAL" ? "trialing" : "active",
      subscription_current_period_ends_at: periodEnd,
      ...(periodType === "TRIAL"
        ? {
            trial_started_at: purchasedAt,
            trial_ends_at: periodEnd,
          }
        : {}),
    };
  }

  if (type === "CANCELLATION") {
    if (immediateCancel) {
      return {
        subscription_tier: "free",
        subscription_status: "expired",
        subscription_current_period_ends_at: periodEnd ?? new Date().toISOString(),
      };
    }

    // Auto-renew off — keep Plus until the paid/trial period actually ends.
    return {
      subscription_tier: stillEntitled ? "plus" : "free",
      subscription_status: "cancelled",
      subscription_current_period_ends_at: periodEnd,
    };
  }

  if (type === "BILLING_ISSUE") {
    const graceUntil = graceEnd ?? periodEnd;
    const inGrace = isFutureIso(graceUntil);
    return {
      subscription_tier: inGrace ? "plus" : "free",
      subscription_status: inGrace ? "grace_period" : "expired",
      subscription_current_period_ends_at: graceUntil,
    };
  }

  if (type === "EXPIRATION" || type === "SUBSCRIPTION_PAUSED") {
    return {
      subscription_tier: "free",
      subscription_status: "expired",
      subscription_current_period_ends_at: periodEnd,
    };
  }

  // NON_RENEWING_PURCHASE, TRANSFER, EXPERIMENT_*, TEST, etc. — ack only.
  return null;
}
