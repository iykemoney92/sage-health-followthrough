import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSubscriptionLockedOut } from "@/lib/billing/subscription";
import { getVerifiedSubscriptionAccess } from "@/lib/billing/verified-access";

const PROTECTED_PREFIXES = [
  "/today",
  "/plans",
  "/calendar",
  "/me",
  "/workspace",
  "/check-in",
  "/summary",
  "/notifications",
  "/onboarding",
  "/billing",
  "/upload-review",
  "/thread-proposal",
];
const AUTH_PAGES = ["/login", "/signup", "/welcome", "/forgot-password", "/auth/check-email"];
/** Surfaces that redirect expired/cancelled users to the lock screen. Free tier is allowed. */
const PLUS_LOCK_PREFIXES = [
  "/today",
  "/plans",
  "/calendar",
  "/me",
  "/workspace",
  "/check-in",
  "/summary",
  "/notifications",
];
// /billing stays reachable without Plus so users can manage checkout / see status.

function postAuthPath(user: { user_metadata?: Record<string, unknown> } | null) {
  return user?.user_metadata?.onboarding_complete === true ? "/today" : "/onboarding";
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Local visual QA routes — never require auth in development.
  if (pathname.startsWith("/dev/") && process.env.NODE_ENV !== "production") {
    return response;
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));
  const needsLockCheck = PLUS_LOCK_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const next = `${pathname}${request.nextUrl.search}`;
    if (next.startsWith("/") && !next.startsWith("//")) {
      url.searchParams.set("next", next);
    }
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = postAuthPath(user);
    return NextResponse.redirect(url);
  }

  // Post-purchase return must stay reachable before the RC webhook lands.
  const isBillingReturn = pathname === "/billing/return" || pathname.startsWith("/billing/return/");
  const isBillingLocked = pathname === "/billing/locked" || pathname.startsWith("/billing/locked/");
  if (user && isBillingReturn) {
    response.cookies.set("nura_checkout_pending", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30,
    });
  }

  // Finished onboarding with an expired/cancelled subscription → lock screen.
  // Free users (paywall skipped, never subscribed) keep free-tier access.
  if (user && needsLockCheck && !isBillingReturn && !isBillingLocked && user.user_metadata?.onboarding_complete === true) {
    const access = await getVerifiedSubscriptionAccess(supabase, user.id, user.email);
    if (!access.hasPlus && isSubscriptionLockedOut(access)) {
      const url = request.nextUrl.clone();
      url.pathname = "/billing/locked";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/today/:path*",
    "/plans/:path*",
    "/calendar/:path*",
    "/me/:path*",
    "/workspace/:path*",
    "/check-in/:path*",
    "/summary/:path*",
    "/notifications/:path*",
    "/onboarding",
    "/billing",
    "/billing/return",
    "/billing/locked",
    "/login",
    "/signup",
    "/welcome",
    "/forgot-password",
    "/update-password",
    "/auth/confirm",
    "/auth/check-email",
    "/upload-review",
    "/thread-proposal",
  ],
};
