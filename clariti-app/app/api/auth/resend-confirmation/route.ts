import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { confirmEmailHtml, confirmEmailText, sendAuthEmail } from "@/lib/integrations/resend";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({ ok: false, error: "Couldn’t resend confirmation right now." }, { status: 502 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
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
    return NextResponse.json({ ok: true, message: "If that account needs confirmation, we sent a new email." });
  }

  if (magicLink.data.user?.email_confirmed_at) {
    return NextResponse.json({
      ok: true,
      message: "That email is already confirmed. You can sign in.",
      status: "already_confirmed",
    });
  }

  const confirmUrl = confirmUrlFromGenerateLink(origin, magicLink.data.properties);
  if (!confirmUrl) {
    return NextResponse.json({ ok: true, message: "If that account needs confirmation, we sent a new email." });
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
    return NextResponse.json({ ok: false, error: "Confirmation email couldn’t be sent right now." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: "If that account needs confirmation, we sent a new email.",
  });
}
