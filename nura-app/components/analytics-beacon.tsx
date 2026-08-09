"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsParams } from "@/lib/analytics";

/** Fires a GA event once on mount (views, return landings, etc.). */
export function AnalyticsBeacon({
  event,
  params,
}: {
  event: string;
  params?: AnalyticsParams;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, params);
  }, [event, params]);

  return null;
}
