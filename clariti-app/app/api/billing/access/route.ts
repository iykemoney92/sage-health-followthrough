import { NextResponse } from "next/server";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import {
  FREE_DOCUMENT_LIMIT,
  FREE_VIDEO_LIMIT,
  getSubscriptionAccess,
  isSubscriptionLockedOut,
  markExpiredSubscriptionIfNeeded,
} from "@/lib/billing/subscription";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const service = getOptionalSupabaseServiceClient();
  const supabase = service ?? (await getSupabaseSessionClient());

  if (service) {
    await syncPlusFromRevenueCat(service, user.id);
  }

  let access = await getSubscriptionAccess(supabase, user.id);
  if (!access.hasPlus && access.status === "expired" && service) {
    access = await markExpiredSubscriptionIfNeeded(service, user.id, access);
  }

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
  });
}
