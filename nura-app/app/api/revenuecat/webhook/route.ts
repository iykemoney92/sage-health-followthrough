import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { extendStripeTrialIfNeeded } from "@/lib/billing/extend-stripe-trial";
import {
  getPlusProductIds,
  subscriptionUpdateFor,
  type RevenueCatEvent,
} from "@/lib/billing/revenuecat-webhook";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function eventIdFor(payloadText: string, event: RevenueCatEvent) {
  if (event.id) return event.id;
  return createHash("sha256").update(payloadText).digest("hex");
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

async function applyProfileUpdate(
  event: RevenueCatEvent,
  update: NonNullable<ReturnType<typeof subscriptionUpdateFor>>,
) {
  const supabase = getSupabaseServerClient();
  const profileUpdate = {
    ...update,
    revenuecat_app_user_id: event.app_user_id,
    revenuecat_original_app_user_id: event.original_app_user_id ?? null,
    subscription_updated_at: new Date().toISOString(),
  };

  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  for (const candidate of candidates) {
    const query = supabase.from("nura_profiles").update(profileUpdate);
    const { data: updatedProfile, error: updateError } = isUuid(candidate)
      ? await query.eq("id", candidate).select("id").maybeSingle()
      : await query.eq("revenuecat_app_user_id", candidate).select("id").maybeSingle();

    if (updateError) {
      return { error: updateError.message, profileId: null as string | null };
    }
    if (updatedProfile?.id) {
      return { error: null as string | null, profileId: updatedProfile.id as string };
    }
  }

  return { error: null as string | null, profileId: null as string | null };
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
  let payload: { event?: RevenueCatEvent };
  try {
    payload = JSON.parse(payloadText) as { event?: RevenueCatEvent };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

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

  // Align Stripe trial length with CARD_TRIAL_DAYS before we persist dates.
  let trialExtension: Awaited<ReturnType<typeof extendStripeTrialIfNeeded>> | null = null;
  if (event.type === "INITIAL_PURCHASE" || event.type === "RENEWAL") {
    try {
      trialExtension = await extendStripeTrialIfNeeded(event);
      if (trialExtension.extended) {
        logger.info("revenuecat_webhook.stripe_trial_extended", {
          eventId,
          subscriptionId: trialExtension.subscriptionId,
          trialEndsAt: trialExtension.trialEndsAt,
        });
      } else if (trialExtension.reason !== "not_needed") {
        logger.warn("revenuecat_webhook.stripe_trial_extend_skipped", {
          eventId,
          reason: trialExtension.reason,
        });
      }
    } catch (error) {
      logger.warn("revenuecat_webhook.stripe_trial_extend_error", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Always map short store trials to the 14-day product promise in our DB,
  // and best-effort extend the Stripe subscription to match.
  const appliedUpdate = subscriptionUpdateFor(event, { extendShortTrials: true });
  if (!appliedUpdate) {
    return NextResponse.json({ ok: true, ignored: true, eventId });
  }

  const { error: updateError, profileId } = await applyProfileUpdate(event, appliedUpdate);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError }, { status: 500 });
  }

  if (!profileId) {
    logger.warn("revenuecat_webhook.profile_not_found", {
      eventId,
      eventType: event.type,
      appUserId: event.app_user_id,
    });
    return NextResponse.json({ ok: true, eventId, processed: false, reason: "profile_not_found" });
  }

  logger.info("revenuecat_webhook.subscription_updated", {
    eventId,
    eventType: event.type,
    periodType: event.period_type ?? null,
    profileId,
    tier: appliedUpdate.subscription_tier,
    status: appliedUpdate.subscription_status,
    periodEndsAt: appliedUpdate.subscription_current_period_ends_at,
    trialEndsAt: appliedUpdate.trial_ends_at ?? null,
    trialExtended: Boolean(trialExtension?.extended),
  });

  return NextResponse.json({
    ok: true,
    eventId,
    profileId,
    status: appliedUpdate.subscription_status,
    trialExtended: Boolean(trialExtension?.extended),
  });
}
