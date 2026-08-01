import { NextRequest, NextResponse } from "next/server";
import { getStripeTestCheckoutSession, grantStripeTestPlus } from "@/lib/billing/stripe-test";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { appUrl } from "@/lib/url";

/**
 * Legacy test-only success handler. Production Checkout uses
 * `/api/billing/checkout-success` with a mode-aware Stripe secret.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    const url = appUrl("/api/billing/checkout-success", request);
    if (sessionId) url.searchParams.set("session_id", sessionId);
    return NextResponse.redirect(url);
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(appUrl("/billing", request));
  }

  const session = await getStripeTestCheckoutSession(sessionId);
  if (session?.mode !== "subscription" || session.status !== "complete" || session.metadata?.owner_id !== user.id) {
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "failed");
    return NextResponse.redirect(url);
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await grantStripeTestPlus(supabase, user.id);

  if (error) {
    const url = appUrl("/billing", request);
    url.searchParams.set("checkout", "profile-update-failed");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(appUrl("/today", request));
}
