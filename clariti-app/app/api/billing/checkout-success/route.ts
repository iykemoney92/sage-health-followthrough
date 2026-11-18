import { NextRequest, NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { checkTrialCard } from "@/lib/billing/card-check";
import { START_TRIAL_PATH } from "@/lib/billing/card-first";
import { getStripeSecretKey } from "@/lib/billing/revenuecat";
import { writeStripeSubscription, type StripeSubscription } from "@/lib/billing/sync-plus-stripe";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

type StripeCheckoutSession = {
  mode?: string;
  status?: string;
  payment_status?: string;
  customer?: string | { id?: string } | null;
  metadata?: { owner_id?: string } | null;
  subscription?: string | { id?: string } | null;
};

function appUrl(path: string, request: NextRequest) {
  return new URL(path, appOriginFromRequest(request));
}

function failed(request: NextRequest, reason: string, path = "/billing") {
  const url = appUrl(path, request);
  url.searchParams.set("checkout", reason);
  return NextResponse.redirect(url);
}

async function stripeGet<T>(secretKey: string, path: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as T) : null;
}

/**
 * Verified Stripe Checkout return. Plus is granted only for a complete session
 * that belongs to the signed-in user and whose card passed the check; the dates
 * written are the subscription's own, read back from Stripe.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(appUrl("/login", request));

  const sessionId = request.nextUrl.searchParams.get("session_id");
  const secretKey = getStripeSecretKey();
  const service = getOptionalSupabaseServiceClient();

  if (!sessionId || !secretKey || !service) {
    return NextResponse.redirect(appUrl("/billing", request));
  }

  const session = await stripeGet<StripeCheckoutSession>(secretKey, `checkout/sessions/${encodeURIComponent(sessionId)}`);

  const ownerOk = session?.metadata?.owner_id === user.id;
  const complete =
    session?.mode === "subscription"
    && session.status === "complete"
    && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
  const subscriptionId = typeof session?.subscription === "string" ? session.subscription : session?.subscription?.id;

  if (!session || !ownerOk || !complete || !subscriptionId) {
    return failed(request, "failed");
  }

  // The card must be able to pay before the trial unlocks anything. A declined
  // card cancels the trial inside checkTrialCard and does not use the trial up.
  const check = await checkTrialCard(secretKey, subscriptionId);
  if (check === "failed") {
    return failed(request, "card_declined", START_TRIAL_PATH);
  }

  const subscription = await stripeGet<StripeSubscription>(secretKey, `subscriptions/${encodeURIComponent(subscriptionId)}`);
  const written = subscription
    ? await writeStripeSubscription(service, user.id, {
        ...subscription,
        customer: subscription.customer ?? session.customer,
      })
    : { hasPlus: false as const };

  if (!written.hasPlus) {
    console.error("[billing/checkout-success] could not record subscription", subscriptionId);
    return failed(request, "profile-update-failed");
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
