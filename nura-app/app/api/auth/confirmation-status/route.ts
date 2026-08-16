import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkKeyedRateLimit, clientIpFromRequest } from "@/lib/auth/rate-limit";
import {
  CONFIRM_POLL_EXP_KEY,
  CONFIRM_POLL_HASH_KEY,
  PENDING_CONFIRM_COOKIE,
  confirmTokenMatches,
  decodePendingConfirmCookie,
  pendingConfirmExpired,
} from "@/lib/auth/pending-confirm";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/** Nothing to report — deliberately identical for "no cookie", "bad token" and
 *  "not confirmed yet", so this can't be used to probe account state. */
const PENDING = { ok: true, confirmed: false } as const;

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = checkKeyedRateLimit(`confirm-poll-ip:${ip}`, 120, 60 * 10);
  if (limit.limited) {
    return NextResponse.json(PENDING);
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(PENDING);
  }

  const cookieStore = await cookies();
  const pending = decodePendingConfirmCookie(cookieStore.get(PENDING_CONFIRM_COOKIE)?.value);
  if (!pending) {
    return NextResponse.json(PENDING);
  }

  const admin = getSupabaseAdminClient();

  // One call answers both questions: whether the address is confirmed yet, and
  // (if so) a token_hash we can redeem for a real session. "magiclink" needs no
  // password, so the user's chosen password is never touched.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: pending.email });
  const user = link.data?.user;
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !user || !tokenHash) {
    return NextResponse.json(PENDING);
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (!confirmTokenMatches(pending.token, metadata[CONFIRM_POLL_HASH_KEY])) {
    return NextResponse.json(PENDING);
  }
  if (pendingConfirmExpired(metadata[CONFIRM_POLL_EXP_KEY])) {
    return NextResponse.json(PENDING);
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(PENDING);
  }

  // Confirmed and proven to be the browser that signed up — redeem the session.
  const supabase = await getSupabaseSessionClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (verifyError) {
    console.error("[confirmation-status] verifyOtp failed", verifyError.message);
    return NextResponse.json(PENDING);
  }

  // Burn the token so the cookie can't mint a second session later.
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...metadata,
      [CONFIRM_POLL_HASH_KEY]: null,
      [CONFIRM_POLL_EXP_KEY]: null,
    },
  });

  const next = metadata.onboarding_complete === true ? "/today" : "/onboarding";
  const response = NextResponse.json({ ok: true, confirmed: true, next });
  response.cookies.delete(PENDING_CONFIRM_COOKIE);
  return response;
}
