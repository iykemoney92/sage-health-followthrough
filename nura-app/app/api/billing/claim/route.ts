import { NextRequest, NextResponse } from "next/server";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

function clearCheckoutPending(response: NextResponse) {
  response.cookies.set("nura_checkout_pending", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/**
 * Post-checkout entitlement sync. Only grants Plus when RevenueCat confirms
 * an active entitlement — never via a client `force` flag.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    app_user_id?: string;
  };

  const supabase = getSupabaseServerClient();
  const appUserId = body.app_user_id && body.app_user_id === user.id ? body.app_user_id : user.id;

  const synced = await syncPlusFromRevenueCat(supabase, appUserId);
  const access = await getSubscriptionAccess(supabase, user.id);
  const response = NextResponse.json({
    ok: true,
    hasPlus: access.hasPlus,
    status: access.status,
    trialEndsAt: access.trialEndsAt,
    currentPeriodEndsAt: access.currentPeriodEndsAt,
    synced: synced.hasPlus,
    syncReason: "reason" in synced ? synced.reason : null,
  });

  if (access.hasPlus) clearCheckoutPending(response);
  return response;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const synced = await syncPlusFromRevenueCat(supabase, user.id);
  const access = await getSubscriptionAccess(supabase, user.id);

  return NextResponse.json({
    ok: true,
    hasPlus: access.hasPlus,
    status: access.status,
    trialEndsAt: access.trialEndsAt,
    currentPeriodEndsAt: access.currentPeriodEndsAt,
    synced: synced.hasPlus,
    syncReason: "reason" in synced ? synced.reason : null,
  });
}
