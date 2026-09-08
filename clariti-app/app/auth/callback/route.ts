import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { appOriginFromRequest } from "@/lib/auth/app-origin";
import { recordProviderTokenPresence } from "@/lib/auth/provider-tokens";
import { safeNextPath } from "@/lib/auth/safe-path";

/**
 * Cookie-aware PKCE code exchange for email confirmation links.
 * Prefer landing on /auth/confirm (client) which forwards here when it sees `?code=`.
 */
/**
 * Whether the session came from a recovery link.
 *
 * The access token carries the methods that established it, and only Supabase
 * could have issued it a moment ago over TLS — so the claims are read, not
 * verified. What they decide is which screen somebody lands on, never what they
 * are allowed to do.
 */
function isRecoverySession(accessToken: string | undefined) {
  const payload = accessToken?.split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      amr?: { method?: string }[];
    };
    return (claims.amr ?? []).some((entry) => entry.method === "recovery");
  } catch {
    return false;
  }
}

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

  // The link type travels with every hand-off below. /auth/confirm decides
  // whether somebody is confirming an email or resetting a password purely from
  // it, and dropping it on the PKCE leg is what let a recovery link finish with
  // "Your email is confirmed" and a redirect home instead of a password form.
  const carriedType: Record<string, string> = type ? { type } : {};

  if (!code) {
    return redirect("/auth/confirm", { confirmed: "1", next, ...carriedType });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return redirect("/auth/confirm", {
      error: "auth_config",
      error_description: "Clariti auth is not configured.",
    });
  }

  let response = redirect(next.includes("confirm") ? next : "/auth/confirm", {
    confirmed: "1",
    ...carriedType,
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
            ...carriedType,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) recordProviderTokenPresence(data.session);
  if (!error && !carriedType.type && isRecoverySession(data.session?.access_token)) {
    // Supabase's own verify hop does not always pass the type on, so the session
    // it just handed back is asked instead. Without this a reset link that
    // arrived as a code finishes as an ordinary confirmation — congratulated,
    // sent home, password never changed. Cookies are carried across because they
    // are what makes the exchange stick.
    const recovered = redirect("/auth/confirm", { confirmed: "1", type: "recovery" });
    for (const cookie of response.cookies.getAll()) recovered.cookies.set(cookie);
    return recovered;
  }
  if (error) {
    // Email is often already confirmed by Supabase's verify hop; session just didn't stick
    // (common when the link is opened in a different browser than signup).
    return redirect("/auth/confirm", {
      ...carriedType,
      confirmed: "1",
      error: "pkce",
      error_description: error.message.includes("code verifier")
        ? "This link can’t finish sign-in in this browser. Your email should still be confirmed — sign in with your password."
        : error.message,
    });
  }

  return response;
}
