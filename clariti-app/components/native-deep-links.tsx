"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { OAUTH_NEXT_KEY } from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/safe-path";

/** Must match CFBundleURLTypes in clariti-mobile's Info.plist and Supabase's allow list. */
const NATIVE_SCHEME = "app.useclariti.mobile:";

/**
 * Routes Universal Links into the WebView instead of letting them bounce to
 * Safari, and finishes provider sign-in when Safari hands the app back.
 *
 * Without this, tapping the email confirmation link opens Safari, Supabase sets
 * the session in Safari's cookie jar, and the app — which has a completely
 * separate jar — stays signed out no matter how long you wait. iOS hands the URL
 * to the app through `continue userActivity` (forwarded to Capacitor in
 * AppDelegate.swift), which surfaces here as `appUrlOpen`.
 *
 * Two shapes arrive on that one event and they are handled very differently:
 *
 *  - An https:// Universal Link on our own origin is *navigated to*. Only
 *    same-origin URLs are followed: `appUrlOpen` fires for every registered
 *    domain, and pointing the WebView at an attacker-supplied origin would hand
 *    them the session cookies this WebView holds.
 *  - Our custom scheme is the OAuth return leg. It is never navigated to — any
 *    app on the device can open a custom-scheme URL, so nothing in it is trusted
 *    as a destination. Only the `code` is read, and it is worthless without the
 *    PKCE verifier cookie that lives in this WebView.
 */
export function NativeDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    let cancelled = false;

    async function completeOAuth(incoming: URL) {
      // Dismiss SFSafariViewController first: the exchange is a network round
      // trip, and leaving Safari over the app through it reads as a hang.
      await Browser.close().catch(() => {});
      if (cancelled) return;

      // Reopening the sign-in modal is the only feedback left to give — the
      // component that started the flow is long gone by the time Safari returns.
      const backToSignIn = "/?auth=1&mode=signin";

      if (incoming.searchParams.get("error")) {
        router.replace(backToSignIn);
        return;
      }

      const code = incoming.searchParams.get("code");
      if (!code) return;

      const { error } = await getSupabaseBrowserClient().auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        router.replace(backToSignIn);
        return;
      }

      const stored = window.sessionStorage.getItem(OAUTH_NEXT_KEY);
      window.sessionStorage.removeItem(OAUTH_NEXT_KEY);
      router.replace(safeNextPath(stored, "/"));
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
      // others, so carry both rather than just the pathname.
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
