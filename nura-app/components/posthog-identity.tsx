"use client";

import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { ANALYTICS_CONSENT_EVENT, getPostHogConsent } from "@/lib/analytics-consent";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { identifyPostHog, resetPostHog, wasIdentified } from "@/lib/posthog";

/**
 * Ties PostHog events to the signed-in Nura user (the Supabase auth user id,
 * the same id the nura_* tables use as owner_id; never the email) and lets go
 * of them on sign-out, including a session that ended in another tab or after
 * account deletion.
 *
 * It also copies the person's analytics choice onto their account
 * (`analytics_opt_out` in auth metadata), because the server sends Nura's AI
 * requests and replies to PostHog for quality checks (lib/ai/trace.ts) and can't
 * read this browser's storage. Turning analytics off (or "Essential only") stops
 * those too; turning it on again starts them. A choice made before signing in
 * counts once they sign in only if it was "off"; an untouched default changes nothing.
 */
export function PostHogIdentity() {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let user: User | null = null;

    const recordChoice = (onlyIfOff: boolean) => {
      if (!user) return;
      const consent = getPostHogConsent();
      if (consent === null || (onlyIfOff && consent !== "denied")) return;
      const optedOut = consent === "denied";
      if ((user.user_metadata?.analytics_opt_out === true) === optedOut) return;
      void supabase.auth.updateUser({ data: { analytics_opt_out: optedOut } }).catch(() => null);
    };
    const onChoice = () => recordChoice(false);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      user = session?.user ?? null;
      const id = user?.id;
      if (id) identifyPostHog(id);
      else if (event === "SIGNED_OUT" || wasIdentified()) resetPostHog();
      // Outside the callback: Supabase auth calls made inside it can deadlock.
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") setTimeout(() => recordChoice(true), 0);
    });
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onChoice);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChoice);
    };
  }, []);

  return null;
}
