"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, RotateCcw } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  configureNativePurchases,
  getPlusOffer,
  isNativePurchaseAvailable,
  purchasePlus,
  restorePlus,
  type PlusOffer,
} from "@/lib/billing/native-purchases";

/**
 * The upgrade control inside the iOS/Android app.
 *
 * Apple's Guideline 3.1.1 requires digital subscriptions sold in the app to go
 * through In-App Purchase, so the web checkout link must not be reachable from
 * a native build. This renders in its place and reports, via `onUnavailable`,
 * when native purchasing isn't configured — the caller then falls back to the
 * web flow, which is correct on the web and never happens on device.
 */
export function NativeUpgrade({
  userId,
  onUnavailable,
  renewing,
}: {
  userId: string;
  onUnavailable: () => void;
  renewing: boolean;
}) {
  const router = useRouter();
  const [offer, setOffer] = useState<PlusOffer | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (!isNativePurchaseAvailable()) {
      onUnavailable();
      return;
    }

    let active = true;
    void (async () => {
      try {
        await configureNativePurchases(userId);
        const plus = await getPlusOffer();
        if (!active) return;
        // No offering usually means the product isn't approved or the store
        // isn't reachable. Falling back beats showing a button that can't work.
        if (!plus) onUnavailable();
        else setOffer(plus);
      } catch {
        if (active) onUnavailable();
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, onUnavailable]);

  const buy = useCallback(async () => {
    if (!offer) return;
    setMessage(null);
    setBusy("purchase");
    track("checkout_start", { source: "billing", cta: renewing ? "renew_plus" : "upgrade_to_plus", store: "apple" });

    const result = await purchasePlus(offer.package);
    setBusy(null);

    if (result.status === "cancelled") return;
    if (result.status === "error") {
      track("checkout_fail", { reason: "store_error" });
      setMessage({ tone: "error", text: result.message });
      return;
    }

    track("checkout_success", { store: "apple" });
    setMessage({ tone: "info", text: "You’re on Plus. Thanks for supporting Nura." });
    // The webhook writes the entitlement server-side; refresh rather than
    // optimistically unlocking, so the UI reflects what the server actually has.
    router.refresh();
  }, [offer, renewing, router]);

  const restore = useCallback(async () => {
    setMessage(null);
    setBusy("restore");
    const result = await restorePlus();
    setBusy(null);

    if (result.status === "error") {
      setMessage({ tone: "error", text: result.message });
      return;
    }
    if (result.restored) {
      setMessage({ tone: "info", text: "Your subscription is restored." });
      router.refresh();
      return;
    }
    setMessage({ tone: "info", text: "No previous purchase found on this Apple Account." });
  }, [router]);

  if (!offer) return null;

  return (
    <>
      <button type="button" className="primary-cta" onClick={() => void buy()} disabled={busy !== null}>
        <CreditCard />{" "}
        {busy === "purchase"
          ? "Opening the App Store…"
          : `${renewing ? "Renew" : "Upgrade to"} Plus — ${offer.priceString}`}
      </button>
      <button type="button" className="secondary-cta" onClick={() => void restore()} disabled={busy !== null}>
        <RotateCcw /> {busy === "restore" ? "Restoring…" : "Restore purchases"}
      </button>
      {message && (
        <p className={message.tone === "error" ? "billing-notice billing-notice-error" : "billing-notice"} role="status">
          {message.text}
        </p>
      )}
    </>
  );
}
