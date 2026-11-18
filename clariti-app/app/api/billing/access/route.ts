import { NextRequest, NextResponse } from "next/server";
import { cardFirstApplies, resolveAccess } from "@/lib/billing/card-first";
import { hasWebCheckoutConfig } from "@/lib/billing/revenuecat";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { FREE_DOCUMENT_LIMIT, FREE_VIDEO_LIMIT, isSubscriptionLockedOut } from "@/lib/billing/subscription";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const service = getOptionalSupabaseServiceClient();

  // RevenueCat is read even for an account that has Plus, so a store refund or
  // lapse shows here; resolveAccess then asks Stripe only if Plus is still off.
  if (service) {
    await syncPlusFromRevenueCat(service, user.id);
  }
  const access = await resolveAccess(await getSupabaseSessionClient(), user.id);

  return NextResponse.json({
    ok: true,
    hasPlus: access.hasPlus,
    status: access.status,
    locked: isSubscriptionLockedOut(access),
    trialEndsAt: access.trialEndsAt,
    currentPeriodEndsAt: access.currentPeriodEndsAt,
    documentsAnalyzedCount: access.documentsAnalyzedCount,
    videosGeneratedCount: access.videosGeneratedCount,
    freeDocumentLimit: FREE_DOCUMENT_LIMIT,
    freeVideoLimit: FREE_VIDEO_LIMIT,
    // Card-first on this surface: no analysis without a trial or plan.
    cardFirst: cardFirstApplies(request.headers.get("user-agent")),
    trialDays: CARD_TRIAL_DAYS,
    // A free trial is offered once; after that the same button renews.
    trialEligible: access.status === "free" && !access.trialEndsAt,
    // So the web paywall can drop the Upgrade button rather than send someone to
    // a checkout that is not configured. The native shell ignores this and buys
    // through StoreKit either way.
    webCheckoutAvailable: hasWebCheckoutConfig(),
  });
}
