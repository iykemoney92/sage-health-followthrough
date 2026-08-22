import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth/safe-path";

/**
 * Handles legacy Supabase PKCE `?code=` redirects using cookie-stored verifiers.
 * Prefer token_hash links for email confirmation (cross-browser safe).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"), "/auth/confirm");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // Email confirmation arrives without `next` and expects the confirm screen.
  // Provider sign-in passes one, and just wants to land in the app — middleware
  // takes it from /login to /today or /onboarding.
  const requestedNext = safeNextPath(url.searchParams.get("next"), "");
  const success = new URL(requestedNext || "/auth/confirm?confirmed=1", url.origin);

  const forward = new URL(nextPath, url.origin);
  // Preserve token_hash flow by bouncing to the confirm page.
  if (tokenHash) {
    forward.searchParams.set("token_hash", tokenHash);
    if (type) forward.searchParams.set("type", type);
    return NextResponse.redirect(forward);
  }

  if (!code) {
    const failed = new URL("/auth/confirm", url.origin);
    failed.searchParams.set("error", "missing_code");
    failed.searchParams.set("error_description", "This confirmation link is incomplete. Request a new email.");
    return NextResponse.redirect(failed);
  }

  let response = NextResponse.redirect(success);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(success);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const failed = new URL("/auth/confirm", url.origin);
    failed.searchParams.set("error", "pkce");
    failed.searchParams.set(
      "error_description",
      error.message.includes("code verifier")
        ? "This link can’t be completed in this browser. Go back and resend a fresh confirmation email, then open it here."
        : error.message,
    );
    return NextResponse.redirect(failed);
  }

  return response;
}
