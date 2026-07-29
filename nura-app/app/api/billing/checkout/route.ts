import { NextRequest, NextResponse } from "next/server";
import { getBillingMode, getRevenueCatPurchaseUrl } from "@/lib/billing/revenuecat";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

type StripeCheckoutSession = {
  url?: string | null;
  error?: { message?: string };
};

async function createStripeTestCheckout(request: NextRequest, user: { id: string; email?: string | null }) {
  const secretKey = process.env.STRIPE_TEST_SECRET_KEY;
  if (!secretKey) return null;

  const successUrl = `${appUrl("/api/billing/test-success", request).toString()}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = appUrl("/billing", request);
  cancelUrl.searchParams.set("checkout", "cancelled");

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": "999",
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": "Nura Plus",
    "line_items[0][price_data][product_data][description]": "Monthly access to Nura voice, WhatsApp, and expanded health thread features.",
    "subscription_data[trial_period_days]": "7",
    "metadata[owner_id]": user.id,
    "subscription_data[metadata][owner_id]": user.id,
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
  const payload = await response.json() as StripeCheckoutSession;
  if (!response.ok || !payload.url) {
    return NextResponse.json({ ok: false, error: payload.error?.message ?? "stripe_test_checkout_failed" }, { status: 502 });
  }
  return NextResponse.redirect(payload.url);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  if (getBillingMode() === "sandbox") {
    const testCheckout = await createStripeTestCheckout(request, user);
    if (testCheckout) return testCheckout;
  }

  const purchaseUrl = getRevenueCatPurchaseUrl();
  if (!purchaseUrl) {
    return NextResponse.json({ ok: false, error: "billing_not_configured" }, { status: 503 });
  }

  const checkoutUrl = new URL(purchaseUrl);
  checkoutUrl.pathname = `${checkoutUrl.pathname.replace(/\/$/, "")}/${encodeURIComponent(user.id)}`;

  return NextResponse.redirect(checkoutUrl);
}
