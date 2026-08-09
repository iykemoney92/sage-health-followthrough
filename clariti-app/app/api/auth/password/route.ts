import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { confirmUrlFromGenerateLink } from "@/lib/auth/links";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { confirmEmailHtml, confirmEmailText, sendAuthEmail } from "@/lib/integrations/resend";
import { getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const authSchema = z.object({
  mode: z.enum(["signin", "signup"]),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = authSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email and password." }, { status: 400 });
  }

  const { mode, password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name?.trim() || undefined;

  if (mode === "signin") {
    const supabase = await getSupabaseSessionClient();
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 401 });
    }
    const { session, user } = result.data;
    if (!session || !user) {
      return NextResponse.json(
        { ok: false, error: "Check your email to confirm your account, then sign in." },
        { status: 401 },
      );
    }
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.user_metadata?.display_name },
    });
  }

  // Signup: create user + send Clariti-branded confirmation via Resend (not Supabase's default mailer).
  if (!hasSupabaseServiceRole()) {
    console.error("[auth/password] SUPABASE_SERVICE_ROLE_KEY missing");
    return NextResponse.json({ ok: false, error: "Couldn’t create your account right now. Try again in a minute." }, { status: 502 });
  }

  const admin = getSupabaseAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      display_name: name,
    },
  });

  if (createError) {
    const lower = createError.message.toLowerCase();
    if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
      return NextResponse.json(
        {
          ok: false,
          error: "An account with this email already exists. Sign in, or reset your password if you’ve forgotten it.",
        },
        { status: 409 },
      );
    }
    console.error("[auth/password] createUser failed", createError.message);
    return NextResponse.json({ ok: false, error: createError.message || "Couldn’t create your account." }, { status: 400 });
  }

  const origin = appOriginFromRequest(request);
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${origin}/auth/confirm` },
  });

  if (linkError || !linkData?.properties) {
    console.error("[auth/password] generateLink failed", linkError?.message);
    return NextResponse.json({
      ok: true,
      requiresEmailConfirmation: true,
      user: created.user
        ? { id: created.user.id, email: created.user.email, name: created.user.user_metadata?.display_name }
        : null,
    });
  }

  const confirmUrl = confirmUrlFromGenerateLink(origin, linkData.properties);
  if (!confirmUrl) {
    return NextResponse.json({
      ok: true,
      requiresEmailConfirmation: true,
      user: created.user
        ? { id: created.user.id, email: created.user.email, name: created.user.user_metadata?.display_name }
        : null,
    });
  }

  const firstName = name?.split(/\s+/)[0];
  const sent = await sendAuthEmail({
    to: email,
    subject: "Confirm your Clariti email",
    html: confirmEmailHtml({ confirmUrl, firstName }),
    text: confirmEmailText({ confirmUrl, firstName }),
    idempotencyKey: `clariti-signup-confirm/${email}/${crypto.randomUUID()}`,
  });

  const isDev = process.env.NODE_ENV !== "production";
  if (!sent.ok) {
    console.error("[auth/password] confirmation email failed", sent.error);
    // Account exists but mail failed — don't pretend an email was sent.
    return NextResponse.json(
      {
        ok: false,
        error: "Account created, but the confirmation email couldn’t be sent. Try “Resend confirmation email” in a minute.",
        requiresEmailConfirmation: true,
        user: created.user
          ? { id: created.user.id, email: created.user.email, name: created.user.user_metadata?.display_name }
          : null,
        ...(isDev ? { devConfirmUrl: confirmUrl, emailError: sent.error } : {}),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    requiresEmailConfirmation: true,
    user: created.user
      ? { id: created.user.id, email: created.user.email, name: created.user.user_metadata?.display_name }
      : null,
    ...(isDev ? { devConfirmUrl: confirmUrl } : {}),
  });
}
