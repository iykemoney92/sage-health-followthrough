"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

const noopSubscribe = () => () => {};
const clientIsNative = () => Capacitor.isNativePlatform();
// Server snapshot is "not native": the fallback copy is the web copy, and a
// wrong guess here only shows the web sentence for one paint before hydration.
const serverIsNative = () => false;

/** True inside the iOS/Android shell, false on the web and during SSR. */
export function useIsNativeShell() {
  return useSyncExternalStore(noopSubscribe, clientIsNative, serverIsNative);
}

/**
 * Renders different copy depending on where the app is running.
 *
 * The purchase mechanics genuinely differ by surface: on the web a card is
 * entered into Stripe Checkout and managed in Stripe's portal; in the app the
 * purchase is StoreKit and there is no card step at all — Apple bills the
 * account and manages cancellation in Settings. Telling an iOS user to
 * "add a card" is wrong, and App Review reads purchase copy closely, so the
 * two surfaces get their own sentences rather than one that is right for
 * neither.
 */
export function PlatformCopy({ web, native }: { web: React.ReactNode; native: React.ReactNode }) {
  return <>{useIsNativeShell() ? native : web}</>;
}
