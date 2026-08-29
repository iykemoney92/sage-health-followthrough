"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, RotateCcw, Settings2 } from "lucide-react";
import {
  configureNativePurchases,
  getNativeManagementUrl,
  getPlusOffers,
  isNativePurchaseAvailable,
  purchasePlus,
  readablePeriod,
  restorePlus,
  type PlusOffer,
} from "@/lib/billing/native-purchases";

/**
 * The upgrade control inside the iOS/Android app.
 *
 * Apple's Guideline 3.1.1 requires digital subscriptions sold in the app to go
 * through In-App Purchase, so the web checkout link must not be reachable from a
 * native build. This renders in its place and reports, via `onUnavailable`, when
 * native purchasing isn't configured — the caller then falls back to the web
 * flow, which is correct on the web and never happens on device.
 */
export function NativeUpgrade({
  userId,
  hasPlus,
  onUnavailable,
}: {
  userId: string;
  hasPlus: boolean;
  onUnavailable: () => void;
}) {
  const router = useRouter();
  const [offers, setOffers] = useState<PlusOffer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [manageUrl, setManageUrl] = useState<string | null>(null);
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
        const [plus, management] = await Promise.all([getPlusOffers(), getNativeManagementUrl()]);
        if (!active) return;

        setManageUrl(management);
        // No packages usually means the products aren't approved yet or the
        // store isn't reachable. Falling back beats showing a buy button that
        // cannot work.
        if (!plus.length) {
          onUnavailable();
          return;
        }
        setOffers(plus);
        // Annual first if it exists — it is the better deal, and preselecting it
        // matches the order the paywall lists them in.
        setSelected(plus.find((offer) => offer.period === "P1Y")?.identifier ?? plus[0].identifier);
      } catch {
        if (active) onUnavailable();
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, onUnavailable]);

  const buy = useCallback(async () => {
    const offer = offers.find((entry) => entry.identifier === selected);
    if (!offer) return;

    setMessage(null);
    setBusy("purchase");
    const result = await purchasePlus(offer.package);
    setBusy(null);

    if (result.status === "cancelled") return;
    if (result.status === "error") {
      setMessage({ tone: "error", text: result.message });
      return;
    }

    setMessage({ tone: "info", text: "You’re on Clariti Plus. Thanks for supporting the work." });
    // The webhook writes the entitlement server-side; refresh rather than
    // optimistically unlocking, so the UI reflects what the server actually has.
    router.refresh();
  }, [offers, router, selected]);

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

  if (hasPlus) {
    return (
      <div className="native-billing-actions">
        {manageUrl && (
          <a className="billing-secondary-cta" href={manageUrl} target="_blank" rel="noreferrer">
            <Settings2 /> Manage subscription
          </a>
        )}
        <button type="button" className="billing-secondary-cta" onClick={() => void restore()} disabled={busy !== null}>
          <RotateCcw /> {busy === "restore" ? "Restoring…" : "Restore purchases"}
        </button>
        {message && <BillingNotice tone={message.tone} text={message.text} />}
      </div>
    );
  }

  if (!offers.length) return null;

  return (
    <div className="native-billing-actions">
      <fieldset className="native-plan-choice">
        <legend className="native-plan-legend">Choose a plan</legend>
        {offers.map((offer) => {
          const period = readablePeriod(offer.period);
          return (
            <label key={offer.identifier} className="native-plan-option">
              <input
                type="radio"
                name="clariti-plus-plan"
                value={offer.identifier}
                checked={selected === offer.identifier}
                onChange={() => setSelected(offer.identifier)}
                disabled={busy !== null}
              />
              <span className="native-plan-label">
                {/* The store's own localised string, verbatim: it is the only
                    price that is correct in every storefront. */}
                <strong>{offer.priceString}</strong>
                {period && <span>per {period}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      <button type="button" className="billing-primary-cta" onClick={() => void buy()} disabled={busy !== null || !selected}>
        <CreditCard /> {busy === "purchase" ? "Opening the App Store…" : "Subscribe to Clariti Plus"}
      </button>

      <button type="button" className="billing-secondary-cta" onClick={() => void restore()} disabled={busy !== null}>
        <RotateCcw /> {busy === "restore" ? "Restoring…" : "Restore purchases"}
      </button>

      {message && <BillingNotice tone={message.tone} text={message.text} />}
    </div>
  );
}

function BillingNotice({ tone, text }: { tone: "error" | "info"; text: string }) {
  return (
    <p className={tone === "error" ? "billing-notice billing-notice-error" : "billing-notice"} role="status">
      {text}
    </p>
  );
}
