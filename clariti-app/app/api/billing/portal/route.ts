import { NextRequest, NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { getRevenueCatSubscriberApiKey, getStripeSecretKey } from "@/lib/billing/revenuecat";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { isNativeShellRequest } from "@/lib/native-shell";

/**
 * A web subscriber pays through Clariti's own Stripe Checkout, which RevenueCat
 * knows nothing about, so their "Manage subscription" is Stripe's customer
 * portal: cancel, change card, see invoices.
 */
async function stripePortalUrl(request: NextRequest, userId: string) {
  const secretKey = getStripeSecretKey();
  const service = getOptionalSupabaseServiceClient();
  if (!secretKey || !service) return null;
  const { data } = await service.from("clariti_profiles").select("stripe_customer_id").eq("id", userId).maybeSingle();
  const customer = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (!customer?.startsWith("cus_")) return null;

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ customer, return_url: new URL("/billing", appOriginFromRequest(request)).toString() }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) {
    console.error("[billing/portal] stripe portal failed", response?.status ?? "network");
    return null;
  }
  return ((await response.json()) as { url?: string }).url ?? null;
}

type RevenueCatSubscriberResponse = {
  subscriber?: { management_url?: string | null };
};

function billingUrl(request: NextRequest, reason?: string) {
  const url = new URL("/billing", appOriginFromRequest(request));
  if (reason) url.searchParams.set("manage", reason);
  return url;
}

/**
 * "Manage subscription" on the web.
 *
 * RevenueCat's subscriber record carries the management URL for whichever store
 * actually processed the purchase, so this works for a Web Billing subscriber
 * and for someone who subscribed in the iOS app and later opened the site — the
 * latter lands on Apple's own subscriptions screen, which is the only place an
 * App Store subscription can be cancelled.
 *
 * The native app does not use this route: NativeUpgrade reads the same URL
 * straight from the RevenueCat SDK, with no server round trip.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/?auth=1&mode=signin", appOriginFromRequest(request)));
  }

  if (!isNativeShellRequest(request)) {
    const stripeUrl = await stripePortalUrl(request, user.id);
    if (stripeUrl) return NextResponse.redirect(stripeUrl);
  }

  const apiKey = getRevenueCatSubscriberApiKey();
  if (!apiKey) {
    return NextResponse.redirect(billingUrl(request, "unavailable"));
  }

  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) return NextResponse.redirect(billingUrl(request, "unavailable"));

    const payload = (await response.json()) as RevenueCatSubscriberResponse;
    const managementUrl = payload.subscriber?.management_url?.trim();

    // Absent whenever there is no active store subscription to manage — a
    // free-tier account, or one whose subscription has already lapsed.
    return managementUrl
      ? NextResponse.redirect(managementUrl)
      : NextResponse.redirect(billingUrl(request, "none"));
  } catch {
    return NextResponse.redirect(billingUrl(request, "unavailable"));
  }
}
