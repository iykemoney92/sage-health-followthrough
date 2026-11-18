import { NextRequest, NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { resolveAccess, START_TRIAL_PATH } from "@/lib/billing/card-first";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import {
  getRevenueCatPurchaseUrl,
  getStripePlusPriceId,
  getStripeSecretKey,
  hasStripeCheckoutConfig,
} from "@/lib/billing/revenuecat";
import { hasUsedStripeTrial, listStripeSubscriptions } from "@/lib/billing/sync-plus-stripe";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { isNativeShellRequest } from "@/lib/native-shell";

export const runtime = "nodejs";

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

/** Where Stripe's "back" link returns: the screen the person started checkout from. */
function cancelUrl(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const url = appUrl(from === "billing" ? "/billing" : from === "locked" ? "/billing/locked" : START_TRIAL_PATH, request);
  url.searchParams.set("checkout", "cancelled");
  return url;
}

/**
 * A free trial is for an account that has never had one. The profile records a
 * trial that passed the card check; Stripe is asked too, because a profile row
 * can be lost and a second trial is free usage on our bill. If Stripe cannot be
 * read, a profile with no history still gets its trial.
 */
async function trialAllowed(userId: string, profileHasHistory: boolean) {
  if (profileHasHistory) return false;
  const subscriptions = await listStripeSubscriptions(userId);
  return subscriptions ? !hasUsedStripeTrial(subscriptions) : true;
}

async function createStripeCheckout(request: NextRequest, user: { id: string; email?: string | null }, withTrial: boolean) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;

  const successUrl = `${appUrl("/api/billing/checkout-success", request).toString()}?session_id={CHECKOUT_SESSION_ID}`;

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl(request).toString(),
    "metadata[owner_id]": user.id,
    "metadata[product]": "clariti",
    "subscription_data[metadata][owner_id]": user.id,
    "subscription_data[metadata][product]": "clariti",
    "line_items[0][quantity]": "1",
  });
  if (withTrial) {
    body.set("subscription_data[trial_period_days]", String(CARD_TRIAL_DAYS));
    body.set("subscription_data[metadata][trial_days]", String(CARD_TRIAL_DAYS));
    // A trial takes no payment today, so Stripe would otherwise skip the card.
    body.set("payment_method_collection", "always");
  }

  const priceId = getStripePlusPriceId();
  if (priceId) {
    body.set("line_items[0][price]", priceId);
  } else {
    // Test mode with no test price configured: build the same plan inline.
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", "999");
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", "Clariti Plus");
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
  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    console.error("[billing/checkout] stripe failed", payload.error?.message ?? response.status);
    return null;
  }
  return markCheckoutPending(NextResponse.redirect(payload.url));
}

/**
 * Web checkout entry point.
 *
 * Clariti's own Stripe Checkout comes first: its return runs the card check
 * (lib/billing/card-check.ts) before the trial unlocks anything, which a hosted
 * RevenueCat purchase link never came back through. The RevenueCat link stays
 * as the fallback for a deployment with no Stripe key.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  // Apple's Guideline 3.1.1 forbids selling a digital subscription through an
  // external checkout inside the app, and the client already routes the native
  // shell to StoreKit / Play Billing instead (components/upgrade-cta.tsx). This
  // is the second half of that: a stale page, a deep link, or a hand-typed URL
  // inside the app must not reach a web checkout either. The marker comes from
  // `appendUserAgent` in clariti-mobile/capacitor.config.ts.
  if (isNativeShellRequest(request)) {
    return NextResponse.redirect(appUrl("/billing", request));
  }

  // Already on a trial or plan (a second tab, a lost return, a stale page):
  // never open a second subscription. resolveAccess asks the stores when the
  // profile is behind, so this holds even before the profile has caught up.
  const access = await resolveAccess(await getSupabaseSessionClient(), user.id);
  if (access.hasPlus) return NextResponse.redirect(appUrl("/api/billing/enter", request));

  if (hasStripeCheckoutConfig()) {
    const trial = await trialAllowed(user.id, access.status !== "free" || Boolean(access.trialEndsAt));
    const stripeCheckout = await createStripeCheckout(request, user, trial);
    if (stripeCheckout) return stripeCheckout;
  }

  const purchaseUrl = getRevenueCatPurchaseUrl();
  if (purchaseUrl) {
    const checkoutUrl = new URL(purchaseUrl);
    checkoutUrl.pathname = `${checkoutUrl.pathname.replace(/\/$/, "")}/${encodeURIComponent(user.id)}`;
    if (user.email) checkoutUrl.searchParams.set("email", user.email);
    return markCheckoutPending(NextResponse.redirect(checkoutUrl));
  }

  const billingPage = appUrl("/billing", request);
  billingPage.searchParams.set("checkout", "use-page");
  return NextResponse.redirect(billingPage);
}
