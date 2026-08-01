import { NextRequest, NextResponse } from "next/server";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getBillingMode, getRevenueCatPurchaseUrl } from "@/lib/billing/revenuecat";
import { getSessionUser } from "@/lib/integrations/supabase-server";
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

async function createStripeCheckout(request: NextRequest, user: { id: string; email?: string | null }) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  const successUrl = `${appUrl("/api/billing/checkout-success", request).toString()}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = appUrl("/onboarding", request);
  cancelUrl.searchParams.set("paywall", "1");

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    "subscription_data[trial_period_days]": String(CARD_TRIAL_DAYS),
    "metadata[owner_id]": user.id,
    "subscription_data[metadata][owner_id]": user.id,
    "subscription_data[metadata][trial_days]": String(CARD_TRIAL_DAYS),
  });

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

  const stripeCheckout = await createStripeCheckout(request, user);
  if (stripeCheckout) return stripeCheckout;

  const purchaseUrl = getRevenueCatPurchaseUrl();
  if (!purchaseUrl) {
    return NextResponse.json({ ok: false, error: "billing_not_configured" }, { status: 503 });
  }

  const checkoutUrl = new URL(purchaseUrl);
  checkoutUrl.pathname = `${checkoutUrl.pathname.replace(/\/$/, "")}/${encodeURIComponent(user.id)}`;
  if (user.email) checkoutUrl.searchParams.set("email", user.email);
  checkoutUrl.searchParams.set("skip_purchase_success", "true");

  return markCheckoutPending(NextResponse.redirect(checkoutUrl));
}
