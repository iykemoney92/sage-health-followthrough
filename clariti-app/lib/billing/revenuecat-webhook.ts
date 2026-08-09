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

export function isoFromMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

/** Clariti Plus product ids across Test Store / Web Billing. */
export function getPlusProductIds() {
  return (
    process.env.CLARITI_REVENUECAT_PLUS_PRODUCT_IDS ??
    "clariti_plus_monthly,clariti_plus_annual,proda7c04cd424,prod8eaa5e9b2c"
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

/**
 * Maps a RevenueCat webhook event → clariti_profiles subscription fields.
 * Returns null when the event should be acknowledged but not change access.
 */
export function subscriptionUpdateFor(event: RevenueCatEvent): ProfileSubscriptionUpdate | null {
  const type = event.type ?? "UNKNOWN";
  const periodType = (event.period_type ?? "").toUpperCase();
  const periodEnd = isoFromMs(event.expiration_at_ms);
  const purchasedAt = isoFromMs(event.purchased_at_ms);
  const graceEnd = isoFromMs(event.grace_period_expiration_at_ms);
  const stillEntitled = isFutureIso(periodEnd);
  const plusEvent = isPlusProduct(event);

  if (!plusEvent && !["TRANSFER", "SUBSCRIBER_ALIAS"].includes(type)) {
    return null;
  }

  const immediateCancel = type === "CANCELLATION" && (
    event.cancel_reason === "CUSTOMER_SUPPORT"
    || event.cancel_reason === "DEVELOPER_INITIATED"
    || (typeof event.price === "number" && event.price < 0)
    || !stillEntitled
  );

  if (type === "INITIAL_PURCHASE" || type === "TEMPORARY_ENTITLEMENT_GRANT" || type === "SUBSCRIPTION_EXTENDED") {
    const isTrial = periodType === "TRIAL" || periodType === "INTRO";

    if (isTrial) {
      return {
        subscription_tier: "plus",
        subscription_status: "trialing",
        subscription_current_period_ends_at: periodEnd,
        trial_started_at: purchasedAt ?? new Date().toISOString(),
        trial_ends_at: periodEnd,
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
      return {
        subscription_tier: "plus",
        subscription_status: "trialing",
        subscription_current_period_ends_at: periodEnd,
        trial_started_at: purchasedAt,
        trial_ends_at: periodEnd,
      };
    }

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
        ? { trial_started_at: purchasedAt, trial_ends_at: periodEnd }
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

/** Referenced for parity with Nura's card-trial helpers; Clariti's card trial is 7 days. */
export function cardTrialDays() {
  return CARD_TRIAL_DAYS;
}
