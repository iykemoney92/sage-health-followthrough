import { NextRequest, NextResponse } from "next/server";
import {
  grantStripeTestPlus,
  StripeCheckoutSession,
  StripeWebhookEvent,
  verifyStripeWebhook,
} from "@/lib/billing/stripe-test";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payloadText = await request.text();
  if (!verifyStripeWebhook(payloadText, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const event = JSON.parse(payloadText) as StripeWebhookEvent;
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data?.object as StripeCheckoutSession | undefined;
  const ownerId = session?.metadata?.owner_id;
  if (session?.mode !== "subscription" || session.status !== "complete" || !ownerId) {
    return NextResponse.json({ ok: false, error: "invalid_checkout_session" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await grantStripeTestPlus(supabase, ownerId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: event.id ?? null, ownerId });
}
