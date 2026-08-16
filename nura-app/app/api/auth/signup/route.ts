import { NextResponse } from "next/server";
import { z } from "zod";
import { appOriginFromRequest, normalizeEmail } from "@/lib/auth/helpers";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { authRateLimitedResponse, checkKeyedRateLimit, clientIpFromRequest } from "@/lib/auth/rate-limit";
import {
  CONFIRM_POLL_EXP_KEY,
  CONFIRM_POLL_HASH_KEY,
  PENDING_CONFIRM_COOKIE,
  PENDING_CONFIRM_TTL_SECONDS,
  createPendingConfirmToken,
  encodePendingConfirmCookie,
  pendingConfirmCookieOptions,
} from "@/lib/auth/pending-confirm";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { getAvatarUrl } from "@/lib/avatar";
import {
  confirmEmailHtml,
  confirmEmailText,
  nuraEmailLogoAttachment,
  sendAuthEmail,
} from "@/lib/integrations/resend";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Check your name, email, and password, then try again." }, { status: 400 });
  }

  if (!hasSupabaseServiceRole()) {
    console.error("[signup] SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json({ ok: false, error: "Couldn’t create your account right now. Try again in a minute." }, { status: 502 });
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;
  const name = parsed.data.name.trim();
  const ip = clientIpFromRequest(request);

  const emailLimit = checkKeyedRateLimit(`signup-email:${email}`, 5, 60 * 60);
  const ipLimit = checkKeyedRateLimit(`signup-ip:${ip}`, 20, 60 * 60);
  if (emailLimit.limited || ipLimit.limited) {
    return authRateLimitedResponse(Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds));
  }

  const supabase = getSupabaseAdminClient();
  const avatarUrl = getAvatarUrl(name || email);

  // Lets /auth/check-email poll itself into a session once the link is opened
  // elsewhere — in the native app the link opens Safari, whose cookie jar the
  // WebView can't see, so without this the app waits on that screen forever.
  const pendingConfirm = createPendingConfirmToken();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      display_name: name,
      avatar_url: avatarUrl,
      onboarding_complete: false,
      [CONFIRM_POLL_HASH_KEY]: pendingConfirm.hash,
      [CONFIRM_POLL_EXP_KEY]: Date.now() + PENDING_CONFIRM_TTL_SECONDS * 1000,
    },
  });

  if (createError) {
    const lower = createError.message.toLowerCase();
    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      return NextResponse.json(
        {
          ok: false,
          error: "An account with this email already exists. Sign in, or reset your password if you’ve forgotten it.",
          code: "email_exists",
        },
        { status: 409 },
      );
    }
    console.error("[signup] createUser failed", createError.message);
    return NextResponse.json({ ok: false, error: createError.message || "Couldn’t create your account." }, { status: 400 });
  }

  // Every path below this point has a created, unconfirmed account, so they all
  // need the polling cookie — otherwise check-email silently can't recover.
  function pendingConfirmResponse(body: Record<string, unknown>) {
    const response = NextResponse.json(body);
    response.cookies.set(
      PENDING_CONFIRM_COOKIE,
      encodePendingConfirmCookie(email, pendingConfirm.token),
      pendingConfirmCookieOptions(),
    );
    return response;
  }

  const origin = appOriginFromRequest(request);
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${origin}/auth/confirm` },
  });

  if (linkError || !linkData?.properties) {
    console.error("[signup] generateLink failed", linkError?.message);
    // Account exists — still ask them to use check-email / resend.
    return pendingConfirmResponse({
      ok: true,
      needsConfirmation: true,
      email,
      message: "Account created. Check your email to confirm it — if nothing arrives, resend from the next screen.",
    });
  }

  const confirmUrl = confirmUrlFromGenerateLink(origin, linkData.properties);
  if (!confirmUrl) {
    return pendingConfirmResponse({
      ok: true,
      needsConfirmation: true,
      email,
      message: "Account created. Check your email to confirm it.",
    });
  }

  const firstName = name.split(/\s+/)[0] || undefined;
  const sent = await sendAuthEmail({
    to: email,
    subject: "Confirm your Nura email",
    html: confirmEmailHtml({ confirmUrl, firstName }),
    text: confirmEmailText({ confirmUrl, firstName }),
    idempotencyKey: `signup-confirm/${email}/${crypto.randomUUID()}`,
    attachments: nuraEmailLogoAttachment(),
  });

  const isDev = process.env.NODE_ENV !== "production";

  if (!sent.ok) {
    console.error("[signup] confirmation email failed", sent.error);
    return pendingConfirmResponse({
      ok: true,
      needsConfirmation: true,
      email,
      message: isDev
        ? "Account created. Dev mode: email delivery failed — use the confirmation link below."
        : "Account created. If the email doesn’t arrive, resend from the next screen.",
      ...(isDev ? { devConfirmUrl: confirmUrl } : {}),
    });
  }

  return pendingConfirmResponse({
    ok: true,
    needsConfirmation: true,
    email,
    userId: created.user?.id ?? null,
    message: "Account created. Check your email to confirm it.",
    // Local/test: always expose confirm URL so E2E can finish without opening an inbox.
    ...(isDev ? { devConfirmUrl: confirmUrl } : {}),
  });
}
