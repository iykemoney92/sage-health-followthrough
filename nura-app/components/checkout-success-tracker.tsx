"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trackPurchase } from "@/lib/analytics";

/**
 * Fires once when returned from checkout with ?checkout=success, then strips
 * the query so refresh doesn't double-count.
 */
export function CheckoutSuccessTracker({
  checkout,
  status,
  provider,
  transactionId,
}: {
  checkout?: string | null;
  status?: string | null;
  provider?: string | null;
  transactionId?: string | null;
}) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (checkout !== "success") return;
    fired.current = true;

    trackPurchase({
      transaction_id: transactionId || undefined,
      status: status || "active",
      provider: provider || "revenuecat",
      source: "billing_return",
      value: status === "trialing" ? 0 : 9.99,
    });

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("status");
    url.searchParams.delete("provider");
    url.searchParams.delete("transaction_id");
    router.replace(`${url.pathname}${url.search}${url.hash}`);
  }, [checkout, provider, router, status, transactionId]);

  return null;
}
