import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { subscriptionUpdateFor, type RevenueCatEvent } from "@/lib/billing/revenuecat-webhook";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";

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
  return event.id || createHash("sha256").update(payloadText).digest("hex");
}

async function applyProfileUpdate(
  supabase: NonNullable<ReturnType<typeof getOptionalSupabaseServiceClient>>,
  event: RevenueCatEvent,
  update: NonNullable<ReturnType<typeof subscriptionUpdateFor>>,
) {
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
    const query = supabase.from("clariti_profiles").update(profileUpdate);
    const { data: updatedProfile, error: updateError } = isUuid(candidate)
      ? await query.eq("id", candidate).select("id").maybeSingle()
      : await query.eq("revenuecat_app_user_id", candidate).select("id").maybeSingle();

    if (updateError) return { error: updateError.message, profileId: null as string | null };
    if (updatedProfile?.id) return { error: null as string | null, profileId: updatedProfile.id as string };
  }

  return { error: null as string | null, profileId: null as string | null };
}

export async function POST(request: NextRequest) {
  const expectedAuth = process.env.CLARITI_REVENUECAT_WEBHOOK_AUTH_HEADER;
  if (!expectedAuth) {
    return NextResponse.json({ ok: false, error: "RevenueCat webhook auth is not configured." }, { status: 503 });
  }

  const incomingAuth = request.headers.get("authorization") ?? "";
  if (!incomingAuth || !safeEqual(incomingAuth, expectedAuth)) {
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

  const supabase = getOptionalSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service role is not configured." }, { status: 503 });
  }

  const eventId = eventIdFor(payloadText, event);
  const { error: eventInsertError } = await supabase
    .from("clariti_revenuecat_webhook_events")
    .insert({ event_id: eventId, event_type: event.type, app_user_id: event.app_user_id, payload });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ ok: false, error: eventInsertError.message }, { status: 500 });
  }

  const appliedUpdate = subscriptionUpdateFor(event);
  if (!appliedUpdate) {
    return NextResponse.json({ ok: true, ignored: true, eventId });
  }

  const { error: updateError, profileId } = await applyProfileUpdate(supabase, event, appliedUpdate);
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError }, { status: 500 });
  }
  if (!profileId) {
    return NextResponse.json({ ok: true, eventId, processed: false, reason: "profile_not_found" });
  }

  return NextResponse.json({
    ok: true,
    eventId,
    profileId,
    status: appliedUpdate.subscription_status,
  });
}
