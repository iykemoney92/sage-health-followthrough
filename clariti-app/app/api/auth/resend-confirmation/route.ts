import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceAnonRateLimit } from "@/lib/auth/anon-rate-limit";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { confirmEmailHtml, confirmEmailText, sendAuthEmail } from "@/lib/integrations/resend";

const bodySchema = z.object({
  email: z.string().email(),
});

/**
 * One answer for every address, whichever way the work below goes.
 *
 * The route used to say "That email is already confirmed" to a confirmed
 * account and something else to everyone else, which let anyone sort addresses
 * into Clariti members and strangers a request at a time.
 */
const ACCEPTED = {
  ok: true,
  message: "If that account needs confirmation, we sent a new email.",
} as const;

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  // Before any admin call: generateLink mails the address it is given and
  // creates the account as a side effect, so an unthrottled caller here can send
  // Clariti-branded mail to strangers until Resend suspends the sending domain
  // and confirmation stops working for real signups.
  const throttled = enforceAnonRateLimit(request, "resendConfirmation", email);
  if (throttled) return throttled;

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({ ok: false, error: "Couldn’t resend confirmation right now." }, { status: 502 });
  }

  const admin = getSupabaseAdminClient();
  const origin = appOriginFromRequest(request);
  const redirectTo = `${origin}/auth/confirm`;

  // magiclink works for existing unconfirmed users without needing their password.
  const magicLink = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (magicLink.error || !magicLink.data?.properties) {
    console.error("[resend-confirmation] generateLink failed", magicLink.error?.message);
    return NextResponse.json(ACCEPTED);
  }

  // Nothing to send, but the answer stays the same as the one a real resend gets.
  if (magicLink.data.user?.email_confirmed_at) {
    return NextResponse.json(ACCEPTED);
  }

  const confirmUrl = confirmUrlFromGenerateLink(origin, magicLink.data.properties);
  if (!confirmUrl) {
    return NextResponse.json(ACCEPTED);
  }

  const firstName =
    (magicLink.data.user?.user_metadata?.display_name as string | undefined)?.split(/\s+/)[0] || undefined;

  const sent = await sendAuthEmail({
    to: email,
    subject: "Confirm your Clariti email",
    html: confirmEmailHtml({ confirmUrl, firstName }),
    text: confirmEmailText({ confirmUrl, firstName }),
    idempotencyKey: `clariti-resend-confirm/${email}/${crypto.randomUUID()}`,
  });

  if (!sent.ok) {
    console.error("[resend-confirmation] resend failed", sent.error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: true,
        message: "Dev mode: email delivery failed — use the confirmation link below.",
        devConfirmUrl: confirmUrl,
      });
    }
    // Only an unconfirmed account ever reaches a send, so reporting the failure
    // would say out loud what the uniform answer above exists to withhold.
    return NextResponse.json(ACCEPTED);
  }

  return NextResponse.json(ACCEPTED);
}
