import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { PLUS_ENTITLEMENT_ID } from "@/lib/billing/subscription";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function isoFromMs(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}

function eventIdFor(payloadText: string, event: RevenueCatEvent) {
  if (event.id) return event.id;
  return createHash("sha256").update(payloadText).digest("hex");
}

function isPlusProduct(event: RevenueCatEvent) {
  const entitlementIds = event.entitlement_ids ?? [];
  if (entitlementIds.includes(PLUS_ENTITLEMENT_ID)) return true;

  const plusProductIds = getPlusProductIds();
  return Boolean(event.product_id && plusProductIds.includes(event.product_id));
}

function getPlusProductIds() {
  return (
    process.env.REVENUECAT_PLUS_PRODUCT_IDS ??
      "prod_UxrFQntebp8P6e,prod48328e2cc1,price_1TxvWrLRJZHcAjIaS9VlfzTM"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSupabaseUsesServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function processWithRevenueCatRpc(payload: { event?: RevenueCatEvent }, authHeader: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("nura_process_revenuecat_webhook", {
    p_auth_header: authHeader,
    p_payload: payload,
    p_plus_product_ids: getPlusProductIds(),
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "28000" ? 401 : 500 });
  }

  return NextResponse.json(data ?? { ok: true });
}

function subscriptionUpdateFor(event: RevenueCatEvent) {
  const type = event.type ?? "UNKNOWN";
  const periodEnd = isoFromMs(event.expiration_at_ms);
  const stillPaid = periodEnd ? new Date(periodEnd).getTime() > Date.now() : false;
  const plusEvent = isPlusProduct(event);

  if (!plusEvent) {
    return null;
  }

  if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"].includes(type)) {
    return { subscription_tier: "plus", subscription_status: "active", subscription_current_period_ends_at: periodEnd };
  }

  if (type === "CANCELLATION") {
    return {
      subscription_tier: stillPaid ? "plus" : "free",
      subscription_status: "cancelled",
      subscription_current_period_ends_at: periodEnd,
    };
  }

  if (type === "BILLING_ISSUE") {
    return {
      subscription_tier: stillPaid ? "plus" : "free",
      subscription_status: stillPaid ? "grace_period" : "expired",
      subscription_current_period_ends_at: periodEnd,
    };
  }

  if (["EXPIRATION", "SUBSCRIPTION_PAUSED"].includes(type)) {
    return { subscription_tier: "free", subscription_status: "expired", subscription_current_period_ends_at: periodEnd };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const expectedAuth = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
  if (!expectedAuth) {
    return NextResponse.json({ ok: false, error: "RevenueCat webhook auth is not configured." }, { status: 503 });
  }

  const incomingAuth = request.headers.get("authorization") ?? "";
  if (!incomingAuth || !safeEqual(incomingAuth, expectedAuth)) {
    logger.warn("revenuecat_webhook.unauthorized");
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payloadText = await request.text();
  const payload = JSON.parse(payloadText) as { event?: RevenueCatEvent };
  const event = payload.event;
  if (!event?.type || !event.app_user_id) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }

  if (!getSupabaseUsesServiceRole()) {
    return processWithRevenueCatRpc(payload, expectedAuth);
  }

  const supabase = getSupabaseServerClient();
  const eventId = eventIdFor(payloadText, event);
  const { error: eventInsertError } = await supabase
    .from("nura_revenuecat_webhook_events")
    .insert({
      event_id: eventId,
      event_type: event.type,
      app_user_id: event.app_user_id,
      payload,
    });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ ok: false, error: eventInsertError.message }, { status: 500 });
  }

  const update = subscriptionUpdateFor(event);
  if (!update) {
    return NextResponse.json({ ok: true, ignored: true, eventId });
  }

  const profileUpdate = {
    ...update,
    revenuecat_app_user_id: event.app_user_id,
    revenuecat_original_app_user_id: event.original_app_user_id ?? null,
    subscription_updated_at: new Date().toISOString(),
  };

  const query = supabase.from("nura_profiles").update(profileUpdate);
  const { data: updatedProfile, error: updateError } = isUuid(event.app_user_id)
    ? await query.eq("id", event.app_user_id).select("id").maybeSingle()
    : await query.eq("revenuecat_app_user_id", event.app_user_id).select("id").maybeSingle();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  if (!updatedProfile) {
    logger.warn("revenuecat_webhook.profile_not_found", { eventId, eventType: event.type, appUserId: event.app_user_id });
    return NextResponse.json({ ok: true, eventId, processed: false, reason: "profile_not_found" });
  }

  logger.info("revenuecat_webhook.subscription_updated", {
    eventId,
    eventType: event.type,
    profileId: updatedProfile.id,
    tier: update.subscription_tier,
    status: update.subscription_status,
  });

  return NextResponse.json({ ok: true, eventId, profileId: updatedProfile.id });
}
