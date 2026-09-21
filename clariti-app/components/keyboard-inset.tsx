"use client";

import { useEffect } from "react";
import { isNativeShell } from "@/lib/analytics-consent";

/**
 * Tells CSS when the keyboard is up, because nothing else can see it.
 *
 * The shell sets `contentInset: "never"` and lets CSS own the safe areas
 * (clariti-mobile/capacitor.config.ts explains why), so iOS does not shrink the
 * WebView when the keyboard appears. It scrolls the whole scroll view up to
 * reveal the focused input instead, and the bottom nav — `position: fixed;
 * bottom: 0` — goes up with it, ending up floating across the middle of the
 * page with content visible underneath. The layout viewport never changed, so
 * no media query and no `env()` value can tell; only `visualViewport` moved.
 *
 * Native only. Mobile browsers handle this themselves, and the web app has no
 * reason to take on the risk of a class that hides its own navigation.
 */
export function KeyboardInset() {
  useEffect(() => {
    if (!isNativeShell()) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const sync = () => {
      // What the keyboard actually covers: the height the visual viewport lost,
      // less however far it has already been scrolled off the layout viewport.
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--kb-inset", `${Math.round(covered)}px`);
      // A threshold rather than `> 0`: rotation and the rubber-band settle both
      // report a few pixels of drift, and navigation that flickers away on a
      // rounding error is worse than navigation that ignores one.
      root.classList.toggle("kb-open", covered > 80);
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);

    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      root.classList.remove("kb-open");
      root.style.removeProperty("--kb-inset");
    };
  }, []);

  return null;
}
