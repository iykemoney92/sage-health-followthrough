import { NextRequest, NextResponse } from "next/server";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import {
  getSubscriptionAccess,
  isSubscriptionLockedOut,
  markExpiredSubscriptionIfNeeded,
} from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

export const runtime = "nodejs";

/**
 * Post-checkout entry: sync RevenueCat entitlements, then route to Today or paywall.
 * Never grants Plus from a query param or cookie alone — only verified entitlements.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const supabase = getSupabaseServerClient();

  await syncPlusFromRevenueCat(supabase, user.id);
  let access = await getSubscriptionAccess(supabase, user.id);

  // Brief retry while RevenueCat catches up after Stripe Checkout.
  const checkoutPending = request.cookies.get("nura_checkout_pending")?.value === "1";
  if (!access.hasPlus && checkoutPending) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await syncPlusFromRevenueCat(supabase, user.id);
    access = await getSubscriptionAccess(supabase, user.id);
  }

  if (!access.hasPlus) {
    access = await markExpiredSubscriptionIfNeeded(supabase, user.id, access);
    if (isSubscriptionLockedOut(access)) {
      return NextResponse.redirect(appUrl("/billing/locked", request));
    }
    const paywall = appUrl("/onboarding", request);
    paywall.searchParams.set("paywall", "1");
    return NextResponse.redirect(paywall);
  }

  const response = NextResponse.redirect(appUrl("/today", request));
  response.cookies.set("nura_checkout_pending", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
