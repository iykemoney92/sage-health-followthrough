"use client";

import { useEffect } from "react";
import { adMeasurementApplies, isPublicPath } from "@/lib/quora-pixel";

/**
 * Vercel Web Analytics, so ad clicks can be checked against real visits.
 * It sets no cookies and stores nothing on the device, so it doesn't wait for
 * the cookie notice. Same limits as the ad tags otherwise:
 *
 * - Web only. Inside the iOS or Android shell nothing loads.
 * - Public pages only. Views of signed-in pages such as /today are dropped
 *   before they leave the browser.
 */
const PUBLIC_PREFIXES = ["/guides", "/tools", "/login", "/join", "/r/"];

function countable(url: string) {
  const path = new URL(url, window.location.origin).pathname;
  return isPublicPath(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

type VaEvent = { url: string };
type Va = ((...params: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    va?: Va;
    vaq?: unknown[];
  }
}

let loaded = false;

export function WebAnalytics() {
  useEffect(() => {
    if (loaded || !adMeasurementApplies()) return;
    loaded = true;
    window.va =
      window.va ||
      function va(...params: unknown[]) {
        (window.vaq = window.vaq || []).push(params);
      };
    window.va("beforeSend", (event: VaEvent) => (countable(event.url) ? event : null));
    const js = document.createElement("script");
    js.defer = true;
    js.src = "/_vercel/insights/script.js";
    (document.head || document.documentElement).appendChild(js);
  }, []);

  return null;
}
