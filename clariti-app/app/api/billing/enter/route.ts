import { NextRequest, NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import {
  getSubscriptionAccess,
  isSubscriptionLockedOut,
  markExpiredSubscriptionIfNeeded,
} from "@/lib/billing/subscription";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

function appUrl(path: string, request: NextRequest) {
  return new URL(path, appOriginFromRequest(request));
}

/**
 * Post-checkout entry point: sync RevenueCat entitlements, then route to the
 * workspace or the paywall. Never grants Plus from a query param/cookie alone.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login", request));
  }

  const service = getOptionalSupabaseServiceClient();
  const supabase = service ?? (await getSupabaseSessionClient());

  if (service) await syncPlusFromRevenueCat(service, user.id);
  let access = await getSubscriptionAccess(supabase, user.id);

  const checkoutPending = request.cookies.get("clariti_checkout_pending")?.value === "1";
  if (!access.hasPlus && checkoutPending && service) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await syncPlusFromRevenueCat(service, user.id);
    access = await getSubscriptionAccess(supabase, user.id);
  }

  if (!access.hasPlus) {
    if (service) access = await markExpiredSubscriptionIfNeeded(service, user.id, access);
    if (isSubscriptionLockedOut(access)) {
      return NextResponse.redirect(appUrl("/billing/locked", request));
    }
    return NextResponse.redirect(appUrl("/billing", request));
  }

  const response = NextResponse.redirect(appUrl("/workspace", request));
  response.cookies.set("clariti_checkout_pending", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
