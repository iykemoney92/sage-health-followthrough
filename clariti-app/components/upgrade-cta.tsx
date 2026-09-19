"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { CreditCard, Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";
import { isNativeShell } from "@/lib/billing/native-purchases";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { NativeUpgrade } from "@/components/native-upgrade";

export type BillingSurface = "web" | "ios" | "android";

/**
 * Which store is selling Plus on this device — the label every funnel event
 * carries.
 *
 * It lives next to the decision it describes so a reported surface can never
 * disagree with the checkout the person was actually shown. Safe to call while
 * rendering on the server: there is no bridge to read there and `getPlatform()`
 * answers "web".
 */
export function billingSurface(): BillingSurface {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

/**
 * The one place Clariti decides how Plus is sold on the current surface.
 *
 * On the web this is the RevenueCat Web Purchase Link. Inside the iOS/Android
 * shell it must be StoreKit/Play Billing instead — Guideline 3.1.1 forbids
 * sending someone out to a web checkout for digital content — so `NativeUpgrade`
 * takes over there and stays in charge even when the store has nothing to sell:
 * falling back to the web link would be the violation, and dropping the control
 * altogether would take Restore purchases with it.
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
  onPurchased,
  webCheckoutAvailable = true,
}: {
  userId: string | null;
  authenticated: boolean;
  hasPlus: boolean;
  label: string;
  className?: string;
  /** Re-read entitlement after a store purchase — see NativeUpgrade. */
  onPurchased?: () => void | Promise<void>;
  /** False when /api/billing/checkout has nowhere to send a web buyer. */
  webCheckoutAvailable?: boolean;
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

  if (platform === "unknown") return null;

  if (!authenticated || !userId) {
    return (
      <Link href="/?auth=1&mode=signin" className={className ?? "billing-primary-cta"}>
        Sign in to start Plus
      </Link>
    );
  }

  if (platform === "native") {
    return <NativeUpgrade userId={userId} hasPlus={hasPlus} onPurchased={onPurchased} />;
  }

  if (hasPlus) {
    return (
      <a href="/api/billing/portal" className={className ?? "billing-secondary-cta"}>
        <CreditCard /> Manage subscription
      </a>
    );
  }

  // No configured web checkout means /api/billing/checkout has nowhere to send
  // this person, and a button that lands on a "Page not found" is worse than an
  // honest sentence.
  if (!webCheckoutAvailable) {
    return (
      <>
        {/* A buyer with nowhere to check out is a broken funnel, not an absent
            one, and without this it reads in GA4 exactly like nobody wanting to
            buy: a paywall view that never becomes a checkout_start. */}
        <AnalyticsBeacon event="checkout_unavailable" params={{ surface: "web" }} />
        <p className="billing-notice" role="status">
          Clariti Plus cannot be purchased on the web right now. You can subscribe in the Clariti app on iPhone.
        </p>
      </>
    );
  }

  return (
    <a
      href="/api/billing/checkout"
      className={className ?? "billing-primary-cta"}
      onClick={() => track("checkout_start", { surface: "web" })}
    >
      <Sparkles /> {label}
    </a>
  );
}
