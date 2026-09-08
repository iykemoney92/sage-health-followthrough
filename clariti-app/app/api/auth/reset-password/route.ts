import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceAnonRateLimit } from "@/lib/auth/anon-rate-limit";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { resetPasswordEmailHtml, resetPasswordEmailText, sendAuthEmail } from "@/lib/integrations/resend";

const bodySchema = z.object({
  email: z.string().email(),
});

/**
 * The same answer for every address, whether or not it has an account.
 *
 * Anything narrower turns this route into a membership oracle: type an address,
 * read the response, learn whether that person uses Clariti. What they use
 * Clariti for is health paperwork, so that alone is worth protecting.
 */
const ACCEPTED = {
  ok: true,
  message: "If that email has a Clariti account, we’ve sent a link to set a new password.",
} as const;

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  const throttled = enforceAnonRateLimit(request, "resetPassword", email);
  if (throttled) return throttled;

  // A missing service role is a configuration fault, not a fact about the
  // address, so it can be reported plainly without leaking anything.
  if (!hasSupabaseServiceRole()) {
    console.error("[auth/reset-password] SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json({ ok: false, error: "Couldn’t send a reset link right now." }, { status: 502 });
  }

  const admin = getSupabaseAdminClient();
  const origin = appOriginFromRequest(request);

  // recovery, unlike magiclink, refuses an address it has never seen instead of
  // creating it — so an unknown address costs one admin call and no account.
  const link = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/confirm` },
  });

  if (link.error || !link.data?.properties) {
    // "User not found" lands here alongside real outages, and the two have to be
    // indistinguishable from outside.
    console.error("[auth/reset-password] generateLink failed", link.error?.message);
    return NextResponse.json(ACCEPTED);
  }

  const resetUrl = confirmUrlFromGenerateLink(origin, link.data.properties);
  if (!resetUrl) {
    console.error("[auth/reset-password] generateLink returned no usable link");
    return NextResponse.json(ACCEPTED);
  }

  const firstName = (link.data.user?.user_metadata?.display_name as string | undefined)?.split(/\s+/)[0] || undefined;

  const sent = await sendAuthEmail({
    to: email,
    subject: "Reset your Clariti password",
    html: resetPasswordEmailHtml({ resetUrl, firstName }),
    text: resetPasswordEmailText({ resetUrl, firstName }),
    idempotencyKey: `clariti-reset-password/${email}/${crypto.randomUUID()}`,
  });

  if (!sent.ok) {
    console.error("[auth/reset-password] reset email failed", sent.error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ...ACCEPTED, devResetUrl: resetUrl, emailError: sent.error });
    }
    // A send failure only ever happens for an address that exists, so reporting
    // it would rebuild the oracle the generic answer above exists to close. The
    // logged error is what has to raise the alarm instead.
    return NextResponse.json(ACCEPTED);
  }

  return NextResponse.json(ACCEPTED);
}
