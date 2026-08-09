"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/** Fires checkout_fail once when landing with a failed checkout query. */
export function CheckoutFailTracker({ reason }: { reason: string | null }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !reason) return;
    fired.current = true;
    track("checkout_fail", { reason });
  }, [reason]);

  return null;
}
