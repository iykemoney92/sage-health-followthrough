import { NextRequest, NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { getBillingMode } from "@/lib/billing/revenuecat";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

type StripeCheckoutSession = {
  mode?: string;
  status?: string;
  payment_status?: string;
  customer?: string | { id?: string } | null;
  metadata?: { owner_id?: string } | null;
};

function getStripeSecretKey() {
  const mode = getBillingMode();
  if (mode === "live") return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
  return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

function customerIdFrom(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value.startsWith("cus_") ? value : null;
  return value.id?.startsWith("cus_") ? value.id : null;
}

function appUrl(path: string, request: NextRequest) {
  return new URL(path, appOriginFromRequest(request));
}

/** Verified Stripe Checkout return — only grants Plus for a complete, owner-matched session. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(appUrl("/login", request));

  const sessionId = request.nextUrl.searchParams.get("session_id");
  const secretKey = getStripeSecretKey();
  const service = getOptionalSupabaseServiceClient();

  if (!sessionId || !secretKey || !service) {
    return NextResponse.redirect(appUrl("/billing", request));
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  const session = response.ok ? ((await response.json()) as StripeCheckoutSession) : null;

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
  const trialEndsAt = new Date(now.getTime() + CARD_TRIAL_DAYS * 86_400_000).toISOString();
  const customerId = customerIdFrom(session.customer);

  const { error } = await service.from("clariti_profiles").upsert(
    {
      id: user.id,
      subscription_tier: "plus",
      subscription_status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt,
      subscription_current_period_ends_at: trialEndsAt,
      revenuecat_app_user_id: user.id,
      subscription_updated_at: now.toISOString(),
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[billing/checkout-success] profile update failed", error.message);
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "profile-update-failed");
    return NextResponse.redirect(url);
  }

  const redirectResponse = NextResponse.redirect(appUrl("/billing/return", request));
  redirectResponse.cookies.set("clariti_checkout_pending", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return redirectResponse;
}
