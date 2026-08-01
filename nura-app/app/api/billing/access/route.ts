import { NextResponse } from "next/server";
import { reconcileShortCardTrial } from "@/lib/billing/reconcile-trial";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  await syncPlusFromRevenueCat(supabase, user.id);
  const reconciled = await reconcileShortCardTrial(supabase, user.id);
  const access = await getSubscriptionAccess(supabase, user.id);

  return NextResponse.json({
    ok: true,
    hasPlus: access.hasPlus,
    status: access.status,
    trialEndsAt: access.trialEndsAt,
    currentPeriodEndsAt: access.currentPeriodEndsAt,
    trialReconciled: reconciled.updated,
  });
}
