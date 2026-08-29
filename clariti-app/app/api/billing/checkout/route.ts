import { NextRequest, NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getBillingMode, getRevenueCatPurchaseUrl } from "@/lib/billing/revenuecat";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { isNativeShellRequest } from "@/lib/native-shell";

function getStripeSecretKey() {
  const mode = getBillingMode();
  if (mode === "live") {
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
  }
  return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

function appUrl(path: string, request: NextRequest) {
  return new URL(path, appOriginFromRequest(request));
}

function markCheckoutPending(response: NextResponse) {
  response.cookies.set("clariti_checkout_pending", "1", {
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
  const priceId = process.env.STRIPE_PLUS_PRICE_ID?.trim();
  if (!secretKey || !priceId) return null;

  const successUrl = `${appUrl("/api/billing/checkout-success", request).toString()}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = appUrl("/billing", request);
  cancelUrl.searchParams.set("checkout", "cancelled");

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl.toString(),
    "subscription_data[trial_period_days]": String(CARD_TRIAL_DAYS),
    "metadata[owner_id]": user.id,
    "subscription_data[metadata][owner_id]": user.id,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
  });
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
  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    console.error("[billing/checkout] stripe failed", payload.error?.message ?? response.status);
    return null;
  }
  return markCheckoutPending(NextResponse.redirect(payload.url));
}

/**
 * Redirect-based checkout entry point. Uses RevenueCat Web Purchase Links
 * (appends the signed-in user id as the RC app user id). Stripe Checkout remains
 * only as an emergency fallback when no purchase URL is configured.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  // Apple's Guideline 3.1.1 forbids selling a digital subscription through an
  // external checkout inside the app, and the client already routes the native
  // shell to StoreKit instead (components/upgrade-cta.tsx). This is the second
  // half of that: a stale page, a deep link, or a hand-typed URL inside the app
  // must not reach pay.rev.cat either. The marker comes from `appendUserAgent`
  // in clariti-mobile/capacitor.config.ts.
  if (isNativeShellRequest(request)) {
    return NextResponse.redirect(appUrl("/billing", request));
  }

  const purchaseUrl = getRevenueCatPurchaseUrl();
  if (purchaseUrl) {
    const checkoutUrl = new URL(purchaseUrl);
    checkoutUrl.pathname = `${checkoutUrl.pathname.replace(/\/$/, "")}/${encodeURIComponent(user.id)}`;
    if (user.email) checkoutUrl.searchParams.set("email", user.email);
    return markCheckoutPending(NextResponse.redirect(checkoutUrl));
  }

  const stripeCheckout = await createStripeCheckout(request, user);
  if (stripeCheckout) return stripeCheckout;

  const billingPage = appUrl("/billing", request);
  billingPage.searchParams.set("checkout", "use-page");
  return NextResponse.redirect(billingPage);
}
