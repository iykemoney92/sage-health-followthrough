"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { safeNextPath } from "@/lib/auth/safe-path";

export type OAuthProvider = "google" | "apple";

/**
 * Where the provider sends the native app back to.
 *
 * A custom scheme rather than the https:// Universal Link: iOS does not reliably
 * hand a Universal Link back to the app when the navigation originates inside
 * SFSafariViewController, but it always honours a registered custom scheme. The
 * matching CFBundleURLTypes entry lives in nura-mobile's Info.plist, and the URL
 * is on Supabase's redirect allow list.
 */
export const NATIVE_OAUTH_REDIRECT = "app.usenura.mobile://auth/callback";

/** Carries the post-sign-in destination across the Safari round trip. */
export const OAUTH_NEXT_KEY = "nura-oauth-next";

/** Shown when the in-app browser refuses to open the provider's page. */
const OPEN_FAILED = "Couldn’t open the sign-in page. Try again.";

export function isNativeShell() {
  return Capacitor.isNativePlatform();
}

/**
 * Starts a provider sign-in, using whichever handoff the current surface allows.
 *
 * On the web this is an ordinary redirect. Inside the app it can't be: Google
 * refuses OAuth from an embedded WebView (`disallowed_useragent`), so the
 * authorization page has to open in SFSafariViewController — a real Safari
 * process the provider will trust. `skipBrowserRedirect` keeps Supabase from
 * navigating the WebView itself and hands us the URL to open instead.
 *
 * The PKCE verifier is written by `createBrowserClient` into a cookie on
 * usenura.app, so whichever surface finishes the exchange — the server route on
 * web, the WebView on native — can read it back. That's why the native return
 * trip lands in the WebView rather than trying to exchange in Safari.
 */
export async function signInWithProvider(provider: OAuthProvider, next?: string | null) {
  const supabase = getSupabaseBrowserClient();
  const nextPath = safeNextPath(next, "");

  if (isNativeShell()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: NATIVE_OAUTH_REDIRECT,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error };
    if (!data?.url) return { error: { message: "Couldn’t start sign-in. Try again." } };

    // Remembered across the round trip because the return arrives via
    // appUrlOpen, which carries only what the provider put in the URL.
    if (nextPath) window.sessionStorage.setItem(OAUTH_NEXT_KEY, nextPath);
    // Default (full-screen) presentation rather than `presentationStyle:
    // "popover"`. On iPhone the popover style silently degrades to a full-screen
    // sheet, so it looked correct in testing; on iPad it is a real popover, and
    // App Review found both provider buttons dead there. Full screen is what
    // SFSafariViewController is documented for and behaves identically on every
    // device, which is the only property that matters for a sign-in handoff.
    try {
      await Browser.open({ url: data.url });
    } catch {
      // Never propagate: the caller disables both provider buttons while a
      // sign-in is pending, so a rejection here leaves them stuck reading
      // "Opening…" with nothing on screen — the unresponsive button App Review
      // reported under guideline 2.1(a).
      return { error: { message: OPEN_FAILED } };
    }
    return { error: null };
  }

  // Land back on /login: middleware already sends a signed-in visitor on an auth
  // page to /today or /onboarding depending on onboarding_complete, so the
  // callback doesn't need to duplicate that decision.
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", nextPath || "/login");

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });
  return { error };
}
