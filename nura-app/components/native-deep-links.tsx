"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Routes Universal Links into the WebView instead of letting them bounce to Safari.
 *
 * Without this, tapping the email-confirmation link opens Safari, Supabase sets the
 * session in Safari's cookie jar, and the app — which has a completely separate jar —
 * sits on /auth/check-email forever. iOS hands the URL to the app via
 * `continue userActivity` (already forwarded to Capacitor in AppDelegate.swift), which
 * surfaces here as `appUrlOpen`.
 *
 * Only same-origin URLs are followed: `appUrlOpen` also fires for custom schemes and
 * any other registered domain, and navigating the WebView to an attacker-supplied
 * origin would hand them the app's session cookies.
 */
export function NativeDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        return;
      }
      if (target.origin !== window.location.origin) return;

      // Supabase puts the token in the hash for some flows and the query for
      // others, so preserve both rather than just the pathname.
      router.replace(`${target.pathname}${target.search}${target.hash}`);
    }).then((handle) => {
      removeListener = () => void handle.remove();
    });

    return () => removeListener?.();
  }, [router]);

  return null;
}
