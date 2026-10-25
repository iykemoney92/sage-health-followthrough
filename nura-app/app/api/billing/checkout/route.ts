import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { giftTrialEnd } from "@/lib/billing/gift-checkout";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getBillingMode, getRevenueCatPurchaseUrl } from "@/lib/billing/revenuecat";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { getActiveFriendGift } from "@/lib/referrals";
import { appUrl } from "@/lib/url";

type StripeCheckoutSession = {
  url?: string | null;
  error?: { message?: string };
};

function getStripeSecretKey() {
  const mode = getBillingMode();
  if (mode === "live") {
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
  }
  return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

/** Prefer an existing Plus price id so RevenueCat/Stripe catalogs stay aligned. */
function getStripePlusPriceId() {
  const explicit = process.env.STRIPE_PLUS_PRICE_ID?.trim();
  if (explicit) return explicit;
  const fromList = (process.env.REVENUECAT_PLUS_PRODUCT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .find((id) => id.startsWith("price_"));
  return fromList || null;
}

function markCheckoutPending(response: NextResponse) {
  response.cookies.set("nura_checkout_pending", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}

function checkoutCancelUrl(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("return");
  if (returnTo === "locked") {
    return appUrl("/billing/locked", request);
  }
  if (returnTo === "billing") {
    return appUrl("/billing", request);
  }
  const cancelUrl = appUrl("/onboarding", request);
  cancelUrl.searchParams.set("paywall", "1");
  if (returnTo === "expired") {
    cancelUrl.searchParams.set("reason", "expired");
  }
  return cancelUrl;
}

async function createStripeCheckout(
  request: NextRequest,
  user: { id: string; email?: string | null },
  options?: { trialEnd?: Date },
) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  const successUrl = `${appUrl("/api/billing/checkout-success", request).toString()}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = checkoutCancelUrl(request);

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    "metadata[owner_id]": user.id,
    "subscription_data[metadata][owner_id]": user.id,
  });
  if (options?.trialEnd) {
    // Invite gift: the card trial ends when the gift does, so there's no charge before then.
    const trialEndsAt = options.trialEnd.toISOString();
    body.set("subscription_data[trial_end]", String(Math.floor(options.trialEnd.getTime() / 1000)));
    body.set("metadata[trial_ends_at]", trialEndsAt);
    body.set("metadata[source]", "invite_gift");
    body.set("subscription_data[metadata][trial_ends_at]", trialEndsAt);
    body.set("subscription_data[metadata][source]", "invite_gift");
  } else {
    body.set("subscription_data[trial_period_days]", String(CARD_TRIAL_DAYS));
    body.set("subscription_data[metadata][trial_days]", String(CARD_TRIAL_DAYS));
  }

  const priceId = getStripePlusPriceId();
  if (priceId) {
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
  } else {
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", "999");
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", "Nura Plus");
    body.set(
      "line_items[0][price_data][product_data][description]",
      `${CARD_TRIAL_DAYS}-day free trial, then monthly access to voice, WhatsApp, and expanded Care plans.`,
    );
  }

  if (user.email) body.set("customer_email", user.email);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const payload = (await response.json()) as StripeCheckoutSession;
  if (!response.ok || !payload.url) {
    console.error("[billing/checkout] stripe failed", payload.error?.message ?? response.status);
    return null;
  }
  return markCheckoutPending(NextResponse.redirect(payload.url));
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  // Someone on an invite gift adding a card: Stripe Checkout with the trial ending on the
  // gift's last day. RevenueCat's purchase link can only start its fixed 14-day trial.
  if (request.nextUrl.searchParams.get("gift") === "1") {
    const gift = await getActiveFriendGift(getSupabaseAdminClient(), user.id).catch(() => null);
    const trialEnd = giftTrialEnd(gift?.until);
    if (trialEnd) {
      const giftCheckout = await createStripeCheckout(request, user, { trialEnd });
      if (giftCheckout) return giftCheckout;
    }
  }

  // Primary path: RevenueCat Web Purchase (Stripe is only a fallback if RC isn't configured).
  const purchaseUrl = getRevenueCatPurchaseUrl();
  if (purchaseUrl) {
    const checkoutUrl = new URL(purchaseUrl);
    checkoutUrl.pathname = `${checkoutUrl.pathname.replace(/\/$/, "")}/${encodeURIComponent(user.id)}`;
    if (user.email) checkoutUrl.searchParams.set("email", user.email);
    checkoutUrl.searchParams.set("skip_purchase_success", "true");
    return markCheckoutPending(NextResponse.redirect(checkoutUrl));
  }

  const stripeCheckout = await createStripeCheckout(request, user);
  if (stripeCheckout) return stripeCheckout;

  return NextResponse.json({ ok: false, error: "billing_not_configured" }, { status: 503 });
}
