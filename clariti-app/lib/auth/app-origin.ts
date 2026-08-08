/** Resolve the public app origin used in auth emails and billing redirects. */

export function appOriginFromRequest(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Prefer the live request host so local/preview/prod each get the right link.
  try {
    const origin = new URL(request.url).origin;
    if (origin && !origin.includes("0.0.0.0")) return origin;
  } catch {
    // fall through
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return "https://useclariti.app";
}

/** Where Supabase should send users after they click the confirmation email. */
export function authEmailRedirectTo(request: Request) {
  return `${appOriginFromRequest(request)}/auth/confirm`;
}

/**
 * Allow only same-origin relative paths for auth redirects.
 * Rejects protocol-relative (`//evil.com`) and absolute URLs.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/") {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  try {
    const decoded = decodeURIComponent(trimmed);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  } catch {
    return fallback;
  }
  return trimmed;
}
