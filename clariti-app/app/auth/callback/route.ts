import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { appOriginFromRequest, safeNextPath } from "@/lib/auth/app-origin";

/**
 * Cookie-aware PKCE code exchange for email confirmation links.
 * Prefer landing on /auth/confirm (client) which forwards here when it sees `?code=`.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = appOriginFromRequest(request);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"), "/auth/confirm");

  const redirect = (path: string, params?: Record<string, string>) => {
    const target = new URL(path, origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        target.searchParams.set(key, value);
      }
    }
    return NextResponse.redirect(target);
  };

  // token_hash must be verified in the browser (or via verifyOtp) — hand off to confirm.
  if (tokenHash) {
    const target = new URL("/auth/confirm", origin);
    target.searchParams.set("token_hash", tokenHash);
    if (type) target.searchParams.set("type", type);
    target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  if (!code) {
    return redirect("/auth/confirm", { confirmed: "1", next });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return redirect("/auth/confirm", {
      error: "auth_config",
      error_description: "Clariti auth is not configured.",
    });
  }

  let response = redirect(next.includes("confirm") ? next : "/auth/confirm", {
    confirmed: "1",
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = redirect(next.includes("confirm") ? next : "/auth/confirm", {
            confirmed: "1",
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Email is often already confirmed by Supabase's verify hop; session just didn't stick
    // (common when the link is opened in a different browser than signup).
    return redirect("/auth/confirm", {
      confirmed: "1",
      error: "pkce",
      error_description: error.message.includes("code verifier")
        ? "This link can’t finish sign-in in this browser. Your email should still be confirmed — sign in with your password."
        : error.message,
    });
  }

  return response;
}
