import type { NextRequest } from "next/server";

/**
 * Whether a request came from the Capacitor shell rather than a browser.
 *
 * `server.url` in clariti-mobile points at useclariti.app, so the WebView's
 * origin, cookies, and referrer are identical to the website's — this token,
 * added via `appendUserAgent` in clariti-mobile/capacitor.config.ts, is the only
 * thing that distinguishes them server-side.
 *
 * It is a hint, not a security boundary: a browser can send any user agent it
 * likes. That is fine for its one job — keeping the app's own surfaces off the
 * web checkout for Guideline 3.1.1 — because spoofing it only ever costs the
 * spoofer the ability to pay.
 */
export function isNativeShellRequest(request: NextRequest) {
  return (request.headers.get("user-agent") ?? "").includes("ClaritiApp");
}
