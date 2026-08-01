import { NextRequest, NextResponse } from "next/server";
import { getBillingMode } from "@/lib/billing/revenuecat";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

export const runtime = "nodejs";

type StripeCheckoutSession = {
  id?: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  customer?: string | { id?: string } | null;
  metadata?: { owner_id?: string } | null;
  subscription?: string | { id?: string } | null;
};

function getStripeSecretKey() {
  const mode = getBillingMode();
  if (mode === "live") {
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
  }
  return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

function customerIdFrom(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value.startsWith("cus_") ? value : null;
  return value.id?.startsWith("cus_") ? value.id : null;
}

async function fetchCheckoutSession(sessionId: string) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as StripeCheckoutSession;
}

function addDaysIso(from: Date, days: number) {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

/**
 * Verified Stripe Checkout return. Grants Plus only when the session is complete
 * and owned by the signed-in user.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(appUrl("/billing/return", request));
  }

  const session = await fetchCheckoutSession(sessionId);
  const ownerOk = session?.metadata?.owner_id === user.id;
  const complete =
    session?.mode === "subscription"
    && session.status === "complete"
    && (session.payment_status === "paid" || session.payment_status === "no_payment_required");

  if (!session || !ownerOk || !complete) {
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "failed");
    return NextResponse.redirect(url);
  }

  const now = new Date();
  const trialEndsAt = addDaysIso(now, CARD_TRIAL_DAYS);
  const customerId = customerIdFrom(session.customer);
  const supabase = getSupabaseServerClient();

  const upsertPayload: Record<string, string> = {
    id: user.id,
    subscription_tier: "plus",
    subscription_status: "trialing",
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt,
    subscription_current_period_ends_at: trialEndsAt,
    revenuecat_app_user_id: user.id,
    subscription_updated_at: now.toISOString(),
  };

  // Persist Stripe customer when the column exists (added in 0018 companion if present).
  if (customerId) {
    upsertPayload.stripe_customer_id = customerId;
  }

  let { error } = await supabase.from("nura_profiles").upsert(upsertPayload, { onConflict: "id" });

  if (error && /stripe_customer_id/i.test(error.message) && customerId) {
    delete upsertPayload.stripe_customer_id;
    ({ error } = await supabase.from("nura_profiles").upsert(upsertPayload, { onConflict: "id" }));
  }

  if (error) {
    console.error("[billing/checkout-success] profile update failed", error.message);
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "profile-update-failed");
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(appUrl("/today", request));
  response.cookies.set("nura_checkout_pending", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
