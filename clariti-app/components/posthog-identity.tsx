"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { identifyPostHog, resetPostHog, wasIdentified } from "@/lib/posthog";

/**
 * Ties PostHog events to the signed-in Clariti user (the Supabase auth user id,
 * the same id the clariti_* tables use as owner_id; never the email) and lets go
 * of them on sign-out, including a session that ended in another tab or after
 * account deletion.
 */
export function PostHogIdentity() {
  useEffect(() => {
    const { data: listener } = getSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      const id = session?.user?.id;
      if (id) identifyPostHog(id);
      else if (event === "SIGNED_OUT" || wasIdentified()) resetPostHog();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return null;
}
