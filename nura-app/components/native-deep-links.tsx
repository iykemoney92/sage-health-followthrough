"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { OAUTH_NEXT_KEY } from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/safe-path";

/** Must match CFBundleURLTypes in nura-mobile's Info.plist and Supabase's allow list. */
const NATIVE_SCHEME = "app.usenura.mobile:";

/**
 * Routes Universal Links into the WebView instead of letting them bounce to Safari,
 * and finishes provider sign-in when Safari hands the app back.
 *
 * Without this, tapping the email-confirmation link opens Safari, Supabase sets the
 * session in Safari's cookie jar, and the app — which has a completely separate jar —
 * sits on /auth/check-email forever. iOS hands the URL to the app via
 * `continue userActivity` (already forwarded to Capacitor in AppDelegate.swift), which
 * surfaces here as `appUrlOpen`.
 *
 * Two shapes arrive on that one event and they're handled very differently:
 *
 *  - An https:// Universal Link on our own origin is *navigated to*. Only same-origin
 *    URLs are followed: `appUrlOpen` also fires for other registered domains, and
 *    navigating the WebView to an attacker-supplied origin would hand them the app's
 *    session cookies.
 *  - Our custom scheme is the OAuth return leg. It is never navigated to — any app on
 *    the device can open a custom-scheme URL, so nothing in it is trusted as a
 *    destination. Only the `code` is read, and it's worthless without the PKCE verifier
 *    cookie this WebView holds.
 */
export function NativeDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    let cancelled = false;

    async function completeOAuth(incoming: URL) {
      // Dismiss SFSafariViewController first: the exchange is a network round
      // trip, and leaving Safari covering the app through it looks like a hang.
      await Browser.close().catch(() => {});
      if (cancelled) return;

      if (incoming.searchParams.get("error")) {
        router.replace("/login?error=oauth");
        return;
      }

      const code = incoming.searchParams.get("code");
      if (!code) return;

      const { error } = await getSupabaseBrowserClient().auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        router.replace("/login?error=oauth");
        return;
      }

      const stored = window.sessionStorage.getItem(OAUTH_NEXT_KEY);
      window.sessionStorage.removeItem(OAUTH_NEXT_KEY);
      // /login rather than the destination directly — middleware sends a
      // signed-in visitor on to /today or /onboarding, so onboarding state is
      // decided in exactly one place.
      router.replace(safeNextPath(stored, "/login"));
      router.refresh();
    }

    void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        return;
      }

      if (target.protocol === NATIVE_SCHEME) {
        void completeOAuth(target);
        return;
      }

      if (target.origin !== window.location.origin) return;

      // Supabase puts the token in the hash for some flows and the query for
      // others, so preserve both rather than just the pathname.
      router.replace(`${target.pathname}${target.search}${target.hash}`);
    }).then((handle) => {
      removeListener = () => void handle.remove();
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [router]);

  return null;
}
