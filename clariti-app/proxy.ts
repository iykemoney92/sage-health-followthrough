import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /follow-ups belongs here too: the page lists scheduled check-ins with document
// titles on them. Its API already requires a session, so a signed-out visitor
// only ever saw an empty shell — but an empty shell of somebody's health
// follow-ups is still the wrong page to render.
const PROTECTED_PREFIXES = ["/workspace", "/documents", "/history", "/settings", "/follow-ups"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));
  const redirectAuthPageToHome = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "1");
    url.searchParams.set("mode", pathname.startsWith("/signup") ? "signup" : "signin");
    return NextResponse.redirect(url);
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (isAuthPage) return redirectAuthPageToHome();

    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth", "1");
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

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

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "1");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage) return redirectAuthPageToHome();

  return response;
}

export const config = {
  matcher: [
    "/workspace/:path*",
    "/documents/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/follow-ups/:path*",
    "/login",
    "/signup",
  ],
};
