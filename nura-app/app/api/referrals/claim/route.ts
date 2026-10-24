import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { claimReferral, getActiveFriendGift, REFERRAL_COOKIE } from "@/lib/referrals";

/**
 * Called by onboarding. Email sign-ups were already claimed when the account was created; this
 * catches Google and Apple sign-ups, which never pass through /api/auth/signup. Either way it
 * answers with the gift the person has now, so onboarding can skip the card screen.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  const code = cookieStore.get(REFERRAL_COOKIE)?.value;

  try {
    const admin = getSupabaseAdminClient();
    if (code) {
      const result = await claimReferral(admin, { refereeId: user.id, rawCode: code, source: "onboarding" });
      if (result.status !== "already_claimed") console.info("[referrals] claim", { source: "onboarding", status: result.status });
    }
    const gift = await getActiveFriendGift(admin, user.id);
    const response = NextResponse.json({ ok: true, gift });
    if (code) response.cookies.delete(REFERRAL_COOKIE);
    return response;
  } catch (error) {
    console.error("[referrals] claim failed", error);
    return NextResponse.json({ ok: false, gift: null }, { status: 500 });
  }
}
