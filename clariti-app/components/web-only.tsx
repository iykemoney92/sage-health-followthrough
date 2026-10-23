"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isNativeShell } from "@/lib/analytics-consent";

/**
 * Renders its children everywhere except inside the native shells. The server
 * snapshot keeps them in the HTML, which is the point for content written for
 * search engines and first-time web visitors; the app already knows what
 * Clariti is and has no use for an explainer under its composer.
 */
export function WebOnly({ children }: { children: ReactNode }) {
  const native = useSyncExternalStore(
    () => () => {},
    () => isNativeShell(),
    () => false,
  );
  return native ? null : children;
}
