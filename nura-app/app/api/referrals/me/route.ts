import { NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/helpers";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { countFriendsJoined, getOrCreateReferralCode, referralUrl } from "@/lib/referrals";

/** The caller's invite link (minted on first ask) and how many people have joined through it. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const admin = getSupabaseAdminClient();
    const [code, joined] = await Promise.all([getOrCreateReferralCode(admin, user.id), countFriendsJoined(admin, user.id)]);
    return NextResponse.json({ ok: true, code, url: referralUrl(appOriginFromRequest(request), code), joined });
  } catch (error) {
    console.error("[referrals] invite link failed", error);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 500 });
  }
}
