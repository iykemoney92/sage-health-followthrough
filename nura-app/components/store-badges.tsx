"use client";

import { track } from "@/lib/analytics";
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from "@/lib/store-links";
import { useIsNativeShell } from "@/components/platform-copy";

/**
 * "Download on the App Store" / "Get it on Google Play" buttons.
 *
 * Rendered on the web only: inside the iOS or Android shell the visitor is
 * already in the app, and a store button there reads as a bug.
 */
export function StoreBadges({ placement, compact = false }: { placement: string; compact?: boolean }) {
  const native = useIsNativeShell();
  if (native) return null;

  return (
    <div className={`store-badges${compact ? " store-badges-compact" : ""}`} aria-label="Get the Nura app">
      <a
        className="store-badge"
        href={IOS_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("store_badge_click", { store: "apple", placement })}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M16.37 12.64c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.58-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.03 2.29-1.27 3.14-2.52.99-1.45 1.4-2.85 1.42-2.92-.03-.02-2.72-1.05-2.74-4.14zM13.8 5.03c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z"
          />
        </svg>
        <span>
          <small>Download on the</small>
          <b>App Store</b>
        </span>
      </a>
      <a
        className="store-badge"
        href={ANDROID_PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("store_badge_click", { store: "google", placement })}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="#34A853" d="M3.6 2.3 13.4 12 3.6 21.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1z" />
          <path fill="#FBBC04" d="m16.9 15.5-3.5-3.5 3.5-3.5 3.9 2.2c1 .6 1 1.9 0 2.5l-3.9 2.3z" />
          <path fill="#4285F4" d="M13.4 12 3.6 2.3c.3-.2.8-.2 1.2 0L16.9 8.5 13.4 12z" />
          <path fill="#EA4335" d="m13.4 12 3.5 3.5L4.8 21.7c-.4.2-.9.2-1.2 0l9.8-9.7z" />
        </svg>
        <span>
          <small>Get it on</small>
          <b>Google Play</b>
        </span>
      </a>
    </div>
  );
}
