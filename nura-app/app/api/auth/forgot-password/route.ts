import { NextResponse } from "next/server";
import { z } from "zod";
import { appOriginFromRequest, normalizeEmail } from "@/lib/auth/helpers";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { authRateLimitedResponse, checkKeyedRateLimit, clientIpFromRequest } from "@/lib/auth/rate-limit";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import {
  nuraEmailLogoAttachment,
  passwordResetEmailHtml,
  passwordResetEmailText,
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
  const emailLimit = checkKeyedRateLimit(`forgot-email:${email}`, 3, 60 * 15);
  const ipLimit = checkKeyedRateLimit(`forgot-ip:${ip}`, 10, 60 * 15);
  if (emailLimit.limited || ipLimit.limited) {
    return authRateLimitedResponse(Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds));
  }

  if (!hasSupabaseServiceRole()) {
    console.error("[forgot-password] SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json(
      { ok: false, error: "Password reset couldn’t be sent right now. Try again in a minute." },
      { status: 502 },
    );
  }

  const origin = appOriginFromRequest(request);
  const redirectTo = `${origin}/update-password`;
  const supabase = getSupabaseAdminClient();

  // Generic success for missing users — avoid account enumeration.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, you’ll get a reset link shortly.",
    });
  }

  const firstName =
    (linkData.user?.user_metadata?.display_name as string | undefined)?.split(/\s+/)[0] || undefined;
  const resetUrl = confirmUrlFromGenerateLink(origin, linkData.properties);
  if (!resetUrl) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, you’ll get a reset link shortly.",
    });
  }

  const sent = await sendAuthEmail({
    to: email,
    subject: "Reset your Nura password",
    html: passwordResetEmailHtml({ resetUrl, firstName }),
    text: passwordResetEmailText({ resetUrl, firstName }),
    idempotencyKey: `password-reset/${email}/${crypto.randomUUID()}`,
    attachments: nuraEmailLogoAttachment(),
  });

  if (!sent.ok) {
    console.error("[forgot-password] resend failed", sent.error);
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      console.info("[forgot-password] dev reset link", resetUrl);
      return NextResponse.json({
        ok: true,
        message:
          "Dev mode: email delivery failed, so use this reset link instead. Real inboxes work once Resend is configured for production.",
        devResetUrl: resetUrl,
      });
    }
    return NextResponse.json(
      { ok: false, error: "Password reset couldn’t be sent right now. Try again in a minute." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, you’ll get a reset link shortly.",
  });
}
