"use client";

import { useEffect } from "react";
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent } from "@/lib/analytics-consent";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { isNativeAnalyticsAvailable, logNativeEvent, syncNativeAnalyticsConsent } from "@/lib/native-analytics";

const SIGN_UP_LOGGED_PREFIX = "nura_native_sign_up_logged:";

// Long enough to cover email confirmation and a consent choice made the next
// morning, short enough that an older account signing in on a fresh install
// isn't counted as a new one.
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sends Firebase's recommended `sign_up` event from the Android shell, once
 * per account, so Google Ads can report which installs became accounts.
 *
 * It runs on every page instead of on /signup because Google and Apple sign-ins
 * finish in the OAuth callback and never pass through the signup form. The
 * session's `created_at` is what marks the account as new. Nothing is sent
 * without analytics consent, and the "logged" mark is only written after a
 * send succeeds, so accepting the cookie notice later still counts the sign-up.
 */
export function NativeSignupConversion() {
  useEffect(() => {
    if (!isNativeAnalyticsAvailable()) return;

    let cancelled = false;

    async function maybeLogSignUp() {
      const consent = getAnalyticsConsent();
      await syncNativeAnalyticsConsent(consent);
      if (consent !== "granted" || cancelled) return;

      const { data } = await getSupabaseBrowserClient().auth.getSession();
      const user = data.session?.user;
      if (!user?.created_at || cancelled) return;
      if (Date.now() - new Date(user.created_at).getTime() > NEW_ACCOUNT_WINDOW_MS) return;

      const key = `${SIGN_UP_LOGGED_PREFIX}${user.id}`;
      try {
        if (localStorage.getItem(key)) return;
      } catch {
        // Storage unavailable: send anyway; a rare duplicate beats a lost sign-up.
      }

      const method = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
      if (await logNativeEvent("sign_up", { method })) {
        try {
          localStorage.setItem(key, new Date().toISOString());
        } catch {
          // Storage unavailable.
        }
      }
    }

    // Mount and the initial SIGNED_IN usually fire together; running the checks
    // one after another lets the second see the first one's "logged" mark.
    let queue = Promise.resolve();
    const run = () => {
      queue = queue.then(maybeLogSignUp).catch(() => undefined);
    };

    run();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, run);
    const { data: listener } = getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") run();
    });

    return () => {
      cancelled = true;
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, run);
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
