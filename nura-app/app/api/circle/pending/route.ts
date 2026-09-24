import { NextResponse } from "next/server";
import { z } from "zod";
import { checkKeyedRateLimit, clientIpFromRequest } from "@/lib/auth/rate-limit";
import { INVITE_TOKEN_PATTERN, INVITE_TTL_DAYS, PENDING_INVITE_COOKIE } from "@/lib/care-circle";

const bodySchema = z.object({ token: z.string().regex(INVITE_TOKEN_PATTERN) });

/**
 * Remembers which invite a signed-out visitor opened. Sign-in, sign-up, Google, Apple and
 * email confirmation all end somewhere different, so rather than threading a `next` through
 * each of them the middleware brings anyone carrying this cookie back to /join once they
 * have an account.
 */
export async function POST(request: Request) {
  const limit = checkKeyedRateLimit(`circle-pending:${clientIpFromRequest(request)}`, 30, 60 * 10);
  if (limit.limited) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PENDING_INVITE_COOKIE, parsed.data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_TTL_DAYS * 24 * 60 * 60,
  });
  return response;
}
