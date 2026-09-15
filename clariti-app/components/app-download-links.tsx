"use client";

import { useSyncExternalStore } from "react";
import { isNativeShell } from "@/lib/analytics-consent";

/**
 * Apple's glyph, drawn here rather than imported from auth-providers.
 *
 * That module pulls in the Supabase browser client and the Capacitor browser
 * plugin the moment it loads, which is a great deal of sign-in machinery to put
 * on the landing page for one 17px path.
 */
function AppleMark() {
  return (
    <svg viewBox="0 0 16 20" width="17" height="17" aria-hidden focusable="false" fill="currentColor">
      <path d="M13.29 10.62c.02 2.43 2.13 3.24 2.15 3.25-.02.06-.34 1.16-1.11 2.3-.67.99-1.36 1.97-2.46 1.99-1.07.02-1.42-.63-2.65-.63-1.23 0-1.62.61-2.64.65-1.06.04-1.87-1.07-2.54-2.05-1.38-2-2.44-5.66-1.02-8.13.7-1.23 1.96-2 3.33-2.02 1.04-.02 2.02.7 2.65.7.64 0 1.83-.86 3.08-.74.53.02 2 .21 2.95 1.6-.08.05-1.76 1.03-1.74 3.08M11.3 3.38c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.36 1.21-.51.6-.96 1.56-.84 2.48.9.07 1.82-.46 2.37-1.13" />
    </svg>
  );
}

/**
 * Google Play's mark. As with the Google sign-in button, the four colours are
 * the mark — their brand terms do not permit a recoloured or monochrome copy —
 * so the segments are inlined at full fidelity rather than tinted.
 */
function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden focusable="false">
      <path fill="#00A0FF" d="M3.3 1.63a1.7 1.7 0 0 0-.4 1.19v18.36c0 .5.14.9.4 1.17l.07.06 10.32-10.3v-.24L3.37 1.57Z" />
      <path fill="#FFCE00" d="m17.13 15.53-3.44-3.42v-.24l3.44-3.44.08.05 4.07 2.31c1.16.66 1.16 1.74 0 2.4l-4.07 2.31Z" />
      <path fill="#FF3A44" d="m17.21 15.48-3.52-3.52L3.3 22.35c.38.4 1.01.45 1.72.05l12.19-6.92" />
      <path fill="#00C853" d="M17.21 8.48 5.02 1.56C4.31 1.16 3.68 1.21 3.3 1.61l10.39 10.35 3.52-3.48Z" />
    </svg>
  );
}

/**
 * Where each store sends people.
 *
 * Written as literal `process.env.NEXT_PUBLIC_*` property accesses on purpose:
 * Next inlines these at build time by matching the source text, so reading them
 * through a variable, through bracket notation, or through a helper that takes
 * the name as an argument yields `undefined` in the browser bundle.
 *
 * Blank is the normal state for a store the app cannot be downloaded from yet,
 * and each link is gated on its own value rather than on the pair. iOS is
 * exactly that case today: version 1.0 is approved but on sale in no territory,
 * so its listing URL still returns a "not available" page. A button onto that
 * page is worse than no button, which is the same rule the provider sign-in
 * buttons follow.
 */
const STORES = [
  {
    id: "ios",
    href: process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim() ?? "",
    name: "App Store",
    accessibleName: "Download Clariti on the App Store",
    Mark: AppleMark,
  },
  {
    id: "android",
    href: process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL?.trim() ?? "",
    name: "Google Play",
    accessibleName: "Download Clariti on Google Play",
    Mark: PlayMark,
  },
].filter((store) => store.href);

/**
 * Quiet links to whichever app stores Clariti is actually downloadable from.
 *
 * Nothing renders inside the iOS/Android shell: someone reading this in the
 * installed app has already done the thing it asks for.
 */
export function AppDownloadLinks({
  className,
  label = "Clariti is also an app on your phone.",
}: {
  className?: string;
  label?: string;
}) {
  // Capacitor is only knowable in the browser, so the shell check cannot run
  // during the server render. useSyncExternalStore rather than an effect, for
  // the reason UpgradeCta uses one: the server snapshot renders nothing and the
  // client's first pass renders the truth, so there is no hydration mismatch and
  // no flash of a download prompt inside the app before it corrects itself. The
  // value never changes afterwards, so there is nothing to subscribe to.
  const surface = useSyncExternalStore(
    () => () => {},
    () => (isNativeShell() ? ("native" as const) : ("web" as const)),
    () => "unknown" as const,
  );

  // No store configured: render nothing at all, not a heading with an empty row
  // beneath it.
  if (STORES.length === 0) return null;
  if (surface !== "web") return null;

  return (
    <div className={className ? `clariti-app-links ${className}` : "clariti-app-links"}>
      <p className="clariti-app-links-label">{label}</p>
      <div className="clariti-app-links-row">
        {STORES.map(({ id, href, name, accessibleName, Mark }) => (
          <a
            key={id}
            className={`clariti-app-link clariti-app-link-${id}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={accessibleName}
          >
            <Mark />
            <span>{name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
