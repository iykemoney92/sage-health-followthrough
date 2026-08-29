"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { CreditCard, Sparkles } from "lucide-react";
import { isNativeShell } from "@/lib/billing/native-purchases";
import { NativeUpgrade } from "@/components/native-upgrade";

/**
 * The one place Clariti decides how Plus is sold on the current surface.
 *
 * On the web this is the RevenueCat Web Purchase Link. Inside the iOS/Android
 * shell it must be StoreKit/Play Billing instead — Guideline 3.1.1 forbids
 * sending someone out to a web checkout for digital content — so `NativeUpgrade`
 * takes over there. It calls back through `onUnavailable` if native purchasing
 * turns out not to be configured, and rather than falling back to the web link
 * (which would be the violation) the shell shows a plain "unavailable" message.
 *
 * Both billing surfaces render this, so neither can drift out of compliance
 * independently.
 */
export function UpgradeCta({
  userId,
  authenticated,
  hasPlus,
  label,
  className,
}: {
  userId: string | null;
  authenticated: boolean;
  hasPlus: boolean;
  label: string;
  className?: string;
}) {
  // Capacitor's platform is only knowable in the browser. useSyncExternalStore
  // rather than an effect so the server renders nothing and the client renders
  // the right control on its first pass — an effect would flash the web checkout
  // link into the app before correcting itself, and the value never changes
  // afterwards, so there is nothing to subscribe to.
  const platform = useSyncExternalStore(
    () => () => {},
    () => (isNativeShell() ? ("native" as const) : ("web" as const)),
    () => "unknown" as const,
  );
  const [nativeUnavailable, setNativeUnavailable] = useState(false);
  const onUnavailable = useCallback(() => setNativeUnavailable(true), []);

  const surface = platform === "native" && nativeUnavailable ? "native-unavailable" : platform;

  if (surface === "unknown") return null;

  if (!authenticated || !userId) {
    return (
      <Link href="/?auth=1&mode=signin" className={className ?? "billing-primary-cta"}>
        Sign in to start Plus
      </Link>
    );
  }

  if (surface === "native") {
    return <NativeUpgrade userId={userId} hasPlus={hasPlus} onUnavailable={onUnavailable} />;
  }

  if (surface === "native-unavailable") {
    return (
      <p className="billing-notice" role="status">
        Subscriptions are temporarily unavailable in the app. Please try again shortly.
      </p>
    );
  }

  if (hasPlus) {
    return (
      <a href="/api/billing/portal" className={className ?? "billing-secondary-cta"}>
        <CreditCard /> Manage subscription
      </a>
    );
  }

  return (
    <a href="/api/billing/checkout" className={className ?? "billing-primary-cta"}>
      <Sparkles /> {label}
    </a>
  );
}
