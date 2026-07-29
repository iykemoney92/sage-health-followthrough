import { NextRequest, NextResponse } from "next/server";
import { getRevenueCatSubscriberApiKey, hasBillingPortalConfig } from "@/lib/billing/revenuecat";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

type RevenueCatSubscriberResponse = {
  subscriber?: {
    management_url?: string | null;
  };
};

type StripeCustomerSearchResponse = {
  data?: Array<{ id?: string }>;
};

type StripePortalSessionResponse = {
  url?: string;
  error?: { message?: string };
};

function billingUrl(request: NextRequest, reason?: string) {
  const url = appUrl("/billing", request);
  if (reason) url.searchParams.set("manage", reason);
  return url;
}

async function getRevenueCatManagementUrl(appUserId: string) {
  const apiKey = getRevenueCatSubscriberApiKey();
  if (!apiKey) return null;

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const payload = await response.json() as RevenueCatSubscriberResponse;
  return payload.subscriber?.management_url ?? null;
}

async function getStripePortalUrl(email: string, returnUrl: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  const customersResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
    cache: "no-store",
  });

  if (!customersResponse.ok) return null;
  const customers = await customersResponse.json() as StripeCustomerSearchResponse;
  const customerId = customers.data?.[0]?.id;
  if (!customerId) return null;

  const body = new URLSearchParams({
    customer: customerId,
    return_url: returnUrl,
  });

  const portalResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!portalResponse.ok) return null;
  const portal = await portalResponse.json() as StripePortalSessionResponse;
  return portal.url ?? null;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const returnUrl = appUrl("/billing", request).toString();
  if (!hasBillingPortalConfig()) {
    return NextResponse.redirect(billingUrl(request, "unavailable"));
  }

  const revenueCatUrl = await getRevenueCatManagementUrl(user.id);
  if (revenueCatUrl) {
    return NextResponse.redirect(revenueCatUrl);
  }

  if (user.email) {
    const stripeUrl = await getStripePortalUrl(user.email, returnUrl);
    if (stripeUrl) {
      return NextResponse.redirect(stripeUrl);
    }
  }

  return NextResponse.redirect(billingUrl(request, "unavailable"));
}
