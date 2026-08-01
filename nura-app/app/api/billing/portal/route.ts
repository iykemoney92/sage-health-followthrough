import { NextRequest, NextResponse } from "next/server";
import { getRevenueCatSubscriberApiKey, hasBillingPortalConfig } from "@/lib/billing/revenuecat";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

type RevenueCatSubscriberResponse = {
  subscriber?: {
    management_url?: string | null;
    subscriber_attributes?: Record<string, { value?: string | null }>;
    subscriptions?: Record<
      string,
      {
        store?: string | null;
        store_transaction_id?: string | null;
      }
    >;
  };
};

type StripeCustomerSearchResponse = {
  data?: Array<{ id?: string }>;
};

type StripePortalSessionResponse = {
  url?: string;
  error?: { message?: string };
};

type StripeSubscriptionItem = {
  subscription?: string | { id?: string } | null;
};

type StripeSubscription = {
  customer?: string | { id?: string } | null;
};

type StripeInvoice = {
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
};

function billingUrl(request: NextRequest, reason?: string) {
  const url = appUrl("/billing", request);
  if (reason) url.searchParams.set("manage", reason);
  return url;
}

function getStripeSecretKeyForPortal() {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || "";
}

function getRevenueCatApiKey() {
  return (
    getRevenueCatSubscriberApiKey()
    || process.env.REVENUECAT_PUBLIC_API_KEY
    || ""
  ).replace(/\\n/g, "").trim();
}

function customerIdFrom(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value.startsWith("cus_") ? value : null;
  return value.id?.startsWith("cus_") ? value.id : null;
}

function subscriptionIdFrom(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value.startsWith("sub_") ? value : null;
  return value.id?.startsWith("sub_") ? value.id : null;
}

async function stripeGet<T>(path: string, secretKey: string): Promise<T | null> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function getRevenueCatSubscriber(appUserId: string) {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return null;

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as RevenueCatSubscriberResponse;
}

async function resolveStripeCustomerIdFromRc(
  subscriber: RevenueCatSubscriberResponse["subscriber"],
  secretKey: string,
  email?: string | null,
) {
  const subscriptions = Object.values(subscriber?.subscriptions ?? {});
  for (const sub of subscriptions) {
    const tx = sub.store_transaction_id;
    if (!tx) continue;

    if (tx.startsWith("cus_")) return tx;

    if (tx.startsWith("sub_")) {
      const subscription = await stripeGet<StripeSubscription>(`subscriptions/${encodeURIComponent(tx)}`, secretKey);
      const customerId = customerIdFrom(subscription?.customer);
      if (customerId) return customerId;
    }

    if (tx.startsWith("si_")) {
      const item = await stripeGet<StripeSubscriptionItem>(
        `subscription_items/${encodeURIComponent(tx)}`,
        secretKey,
      );
      const subscriptionId = subscriptionIdFrom(item?.subscription);
      if (subscriptionId) {
        const subscription = await stripeGet<StripeSubscription>(
          `subscriptions/${encodeURIComponent(subscriptionId)}`,
          secretKey,
        );
        const customerId = customerIdFrom(subscription?.customer);
        if (customerId) return customerId;
      }
    }

    if (tx.startsWith("in_")) {
      const invoice = await stripeGet<StripeInvoice>(`invoices/${encodeURIComponent(tx)}`, secretKey);
      const customerId = customerIdFrom(invoice?.customer);
      if (customerId) return customerId;
    }
  }

  if (email) {
    const customers = await stripeGet<StripeCustomerSearchResponse>(
      `customers?email=${encodeURIComponent(email)}&limit=1`,
      secretKey,
    );
    const customerId = customers?.data?.[0]?.id;
    if (customerId?.startsWith("cus_")) return customerId;
  }

  return null;
}

async function createStripePortalUrl(customerId: string, returnUrl: string, secretKey: string) {
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
  const portal = (await portalResponse.json()) as StripePortalSessionResponse;
  return portal.url ?? null;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const returnUrl = appUrl("/billing", request).toString();
  const configuredLoginUrl = process.env.STRIPE_CUSTOMER_PORTAL_LOGIN_URL?.trim();

  if (!hasBillingPortalConfig() && !configuredLoginUrl && !getRevenueCatApiKey()) {
    return NextResponse.redirect(billingUrl(request, "unavailable"));
  }

  const rcPayload = await getRevenueCatSubscriber(user.id);
  const managementUrl = rcPayload?.subscriber?.management_url?.trim();
  if (managementUrl) {
    return NextResponse.redirect(managementUrl);
  }

  const secretKey = getStripeSecretKeyForPortal();
  if (secretKey) {
    const email =
      rcPayload?.subscriber?.subscriber_attributes?.$email?.value
      || user.email
      || null;

    let customerId: string | null = null;
    try {
      const supabase = getSupabaseServerClient();
      const { data: profile } = await supabase
        .from("nura_profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      const stored = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
      if (stored?.startsWith("cus_")) customerId = stored;
    } catch {
      // Column may not exist yet — fall through to RC/email resolution.
    }

    if (!customerId) {
      customerId = await resolveStripeCustomerIdFromRc(rcPayload?.subscriber, secretKey, email);
    }

    // Last resort: email lookup even when RC has no subscriptions (common after Checkout lag).
    if (!customerId && email) {
      const customers = await stripeGet<StripeCustomerSearchResponse>(
        `customers?email=${encodeURIComponent(email)}&limit=1`,
        secretKey,
      );
      const found = customers?.data?.[0]?.id;
      if (found?.startsWith("cus_")) customerId = found;
    }

    if (customerId) {
      const stripeUrl = await createStripePortalUrl(customerId, returnUrl, secretKey);
      if (stripeUrl) return NextResponse.redirect(stripeUrl);
    }
  }

  // Stripe Customer Portal login page (email → magic link). Configure in Stripe + env.
  if (configuredLoginUrl) {
    return NextResponse.redirect(configuredLoginUrl);
  }

  return NextResponse.redirect(billingUrl(request, "unavailable"));
}
