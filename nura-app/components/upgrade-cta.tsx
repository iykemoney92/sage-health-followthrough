"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { Settings } from "lucide-react";
import { NativeUpgrade } from "@/components/native-upgrade";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

/** The platform never changes for the life of the document, so nothing to subscribe to. */
const noopSubscribe = () => () => {};
const clientPlatform = () => (Capacitor.isNativePlatform() ? "native" : "web");
const serverPlatform = () => "unknown" as const;

/**
 * Chooses how someone upgrades, based on where the app is running.
 *
 * The web checkout link is never rendered inside the native app — not as a
 * fallback, not for a moment during hydration. Apple's Guideline 3.1.1 forbids
 * steering people to an external purchase flow for digital content, and a link
 * that is briefly present is still a link a reviewer can find and a user can
 * tap. useSyncExternalStore is what makes that guarantee cheap: the server
 * snapshot is "unknown", so the markup shipped to the WebView contains an inert
 * placeholder instead of a purchase link, and React swaps in the real control
 * once the client can say which platform this is.
 *
 * When the native store can't offer the product — misconfigured key, offering
 * not approved yet, store unreachable — the honest outcome is to say so. Quietly
 * reverting to web checkout would reintroduce exactly the violation this exists
 * to prevent.
 */
export function UpgradeCta({
  userId,
  renewing,
  children,
}: {
  /**
   * Omit on surfaces that don't already have it — the paywall inside onboarding
   * is a client component with no session in scope, and resolving it here beats
   * threading a prop through that whole tree.
   */
  userId?: string | null;
  renewing: boolean;
  /** The web checkout control, rendered only on the web. */
  children: React.ReactNode;
}) {
  const platform = useSyncExternalStore(noopSubscribe, clientPlatform, serverPlatform);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId ?? null);
  const [unavailable, setUnavailable] = useState(false);

  const needsUserLookup = platform === "native" && !userId && !resolvedUserId;

  useEffect(() => {
    if (!needsUserLookup) return;

    let active = true;
    void getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!active) return;
        if (data.user?.id) setResolvedUserId(data.user.id);
        // No session on a paywall means something is already wrong upstream;
        // showing a purchase button that can't be attributed to an account
        // would only produce an orphaned transaction.
        else setUnavailable(true);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });

    return () => {
      active = false;
    };
  }, [needsUserLookup]);

  const markUnavailable = useCallback(() => setUnavailable(true), []);

  if (platform === "web") return <>{children}</>;

  if (platform === "native") {
    if (unavailable) {
      return (
        <p className="billing-notice" role="status">
          Subscriptions aren’t available in the app right now. Please try again shortly.
        </p>
      );
    }
    if (resolvedUserId) {
      return <NativeUpgrade userId={resolvedUserId} renewing={renewing} onUnavailable={markUnavailable} />;
    }
  }

  return (
    <button type="button" className="primary-cta" disabled aria-hidden>
      Loading…
    </button>
  );
}

/**
 * "Manage or cancel", pointed at whichever system actually owns the billing.
 *
 * A subscription bought through StoreKit can only be changed in the App Store,
 * and Apple treats a link out to a web billing portal as steering just as it
 * does a link out to a web checkout. So on device this opens Apple's own
 * subscription settings; on the web it keeps the existing customer portal.
 */
export function ManageSubscriptionCta({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const platform = useSyncExternalStore(noopSubscribe, clientPlatform, serverPlatform);

  if (platform === "web") return <>{children}</>;

  if (platform === "native") {
    return (
      // iOS resolves this to the Subscriptions screen in Settings.
      <a className={className ?? "secondary-cta"} href="https://apps.apple.com/account/subscriptions">
        <Settings /> Manage or cancel
      </a>
    );
  }

  return (
    <button type="button" className={className ?? "secondary-cta"} disabled aria-hidden>
      Loading…
    </button>
  );
}
