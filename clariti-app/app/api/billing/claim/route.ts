import { NextResponse } from "next/server";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

/**
 * Post-purchase entitlement sync. Only grants Plus when RevenueCat's REST API
 * confirms an active entitlement — never from a client-supplied flag. Called
 * right after returning from checkout so the user does not have to wait for
 * the webhook to land.
 */
async function claim() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const service = getOptionalSupabaseServiceClient();
  const supabase = service ?? (await getSupabaseSessionClient());
  const synced = service
    ? await syncPlusFromRevenueCat(service, user.id)
    : { hasPlus: false, reason: "no_service_client" as const };

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

export async function POST() {
  return claim();
}

export async function GET() {
  return claim();
}
