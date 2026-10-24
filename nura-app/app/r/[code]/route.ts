import { NextResponse } from "next/server";
import { checkKeyedRateLimit, clientIpFromRequest } from "@/lib/auth/rate-limit";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { lookupReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/referrals";

// Relative on purpose: the cookie is set on whatever host the visitor typed, and an absolute
// URL built from request.url can name a different one (www vs apex, the dev server's own host),
// leaving the cookie behind.
function redirectTo(location: string) {
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

/**
 * An invite link (usenura.app/r/<code>). Remembers the code in a cookie and hands over to
 * /invited, which explains the gift. Sign-up, Google, Apple and email confirmation all end in
 * different places, so the code rides in the cookie rather than through each of them.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;

  const limit = checkKeyedRateLimit(`referral-open:${clientIpFromRequest(request)}`, 60, 60 * 10);
  if (limit.limited) return redirectTo("/invited");

  const owner = await lookupReferralCode(getSupabaseAdminClient(), rawCode).catch(() => null);
  if (!owner) return redirectTo("/invited?invalid=1");

  const response = redirectTo("/invited");
  response.cookies.set(REFERRAL_COOKIE, owner.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
  });
  return response;
}
