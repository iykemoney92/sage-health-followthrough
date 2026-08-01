import { NextResponse } from "next/server";
import { z } from "zod";
import { appOriginFromRequest, normalizeEmail } from "@/lib/auth/helpers";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { authRateLimitedResponse, checkKeyedRateLimit, clientIpFromRequest } from "@/lib/auth/rate-limit";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import {
  confirmEmailHtml,
  confirmEmailText,
  nuraEmailLogoAttachment,
  sendAuthEmail,
} from "@/lib/integrations/resend";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ip = clientIpFromRequest(request);
  const emailLimit = checkKeyedRateLimit(`confirm-email:${email}`, 3, 60 * 15);
  const ipLimit = checkKeyedRateLimit(`confirm-ip:${ip}`, 10, 60 * 15);
  if (emailLimit.limited || ipLimit.limited) {
    return authRateLimitedResponse(Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds));
  }

  if (!hasSupabaseServiceRole()) {
    console.error("[resend-confirmation] SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json(
      { ok: false, error: "Confirmation email couldn’t be sent right now. Try again in a minute." },
      { status: 502 },
    );
  }

  const origin = appOriginFromRequest(request);
  const redirectTo = `${origin}/auth/confirm`;
  const supabase = getSupabaseAdminClient();

  let properties: {
    hashed_token?: string | null;
    verification_type?: string | null;
    action_link?: string | null;
  } | null = null;
  let firstName: string | undefined;
  let confirmedAt: string | null | undefined;

  // "signup" link type requires a password (it can create the user), which we
  // don't have here - this resends to an already-created, unconfirmed user, so
  // "magiclink" is the correct type: no password needed, no risk of touching
  // whatever password they originally chose.
  const magicLink = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (!magicLink.error && magicLink.data?.properties) {
    properties = magicLink.data.properties;
    confirmedAt = magicLink.data.user?.email_confirmed_at;
    firstName =
      (magicLink.data.user?.user_metadata?.display_name as string | undefined)?.split(/\s+/)[0] || undefined;
  }

  if (!properties) {
    return NextResponse.json({
      ok: true,
      message: "If that address still needs confirming, we’ve sent another email.",
    });
  }

  if (confirmedAt) {
    return NextResponse.json({
      ok: true,
      message: "That email is already confirmed. You can sign in.",
      status: "already_confirmed",
    });
  }

  const confirmUrl = confirmUrlFromGenerateLink(origin, properties);
  if (!confirmUrl) {
    return NextResponse.json({
      ok: true,
      message: "If that address still needs confirming, we’ve sent another email.",
    });
  }

  const sent = await sendAuthEmail({
    to: email,
    subject: "Confirm your Nura email",
    html: confirmEmailHtml({ confirmUrl, firstName }),
    text: confirmEmailText({ confirmUrl, firstName }),
    idempotencyKey: `confirm-email/${email}/${crypto.randomUUID()}`,
    attachments: nuraEmailLogoAttachment(),
  });

  if (!sent.ok) {
    console.error("[resend-confirmation] resend failed", sent.error);
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      console.info("[resend-confirmation] dev confirm link", confirmUrl);
      return NextResponse.json({
        ok: true,
        message: "Dev mode: email delivery failed, so use this confirmation link instead.",
        devConfirmUrl: confirmUrl,
      });
    }
    return NextResponse.json(
      { ok: false, error: "Confirmation email couldn’t be sent right now. Try again in a minute." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "If that address still needs confirming, we’ve sent another email.",
  });
}
