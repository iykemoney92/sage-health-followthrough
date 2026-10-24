/**
 * Meta Pixel, so Instagram and Facebook ads can be judged (and optimised) by
 * what they bring to the website, not just by taps.
 *
 * It runs under the same three limits as the Quora Pixel (lib/quora-pixel.ts),
 * and shares its consent answer:
 *
 * - Public pages only. The pixel is never loaded on, and never sends anything
 *   from, a signed-in page such as /today or /plans.
 * - Web only. Inside the iOS or Android shell nothing loads at all.
 * - Opt-in everywhere. Nothing is requested from Meta until the visitor presses
 *   Accept on the cookie notice, wherever they are.
 *
 * Two of fbevents.js's own habits are switched off so that it only ever sends
 * what metaTrack() asks for:
 * - Automatic PageView on pushState / popstate (fbq.disablePushState), which
 *   would otherwise follow the visitor into the signed-in app.
 * - Automatic events and page metadata ("autoConfig"), which read button text
 *   and page content.
 *
 * Events: PageView for each public page, GetStarted (custom) for an App Store,
 * Google Play or "Get started" click, and CompleteRegistration when the web
 * sign-up form succeeds. The dataset is categorised "Health & wellness" in
 * Events Manager.
 */

import { adMeasurementApplies, getAdConsent, isPublicPath } from "@/lib/quora-pixel";

export const META_PIXEL_ID = "1083920901181583";
const META_SDK_URL = "https://connect.facebook.net/en_US/fbevents.js";

export type MetaEvent = "PageView" | "GetStarted" | "CompleteRegistration";

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: FbqFn;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

const CUSTOM_EVENTS: MetaEvent[] = ["GetStarted"];

let loaded = false;
let pending: MetaEvent[] = [];

/** Meta's own loader: fbq() queues calls until fbevents.js arrives. */
function load() {
  if (loaded) return;
  loaded = true;
  if (!window.fbq) {
    const n: FbqFn = function fbq() {
      // Meta's snippet queues the arguments object itself; keep that shape.
      // eslint-disable-next-line prefer-rest-params, prefer-spread
      if (n.callMethod) n.callMethod.apply(n, arguments as unknown as unknown[]);
      // eslint-disable-next-line prefer-rest-params
      else n.queue!.push(arguments);
    };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
  }
  window.fbq.disablePushState = true;
  window.fbq("set", "autoConfig", false, META_PIXEL_ID);
  window.fbq("init", META_PIXEL_ID);
  const js = document.createElement("script");
  js.async = true;
  js.src = META_SDK_URL;
  (document.head || document.documentElement).appendChild(js);
}

/**
 * Sends one event, if this page and this visitor's choice allow it. Before a
 * choice is made, events wait in memory and go out only if Accept is pressed
 * on this page; "Essential only" drops them.
 */
export function metaTrack(event: MetaEvent) {
  if (!adMeasurementApplies()) return;
  if (!isPublicPath(window.location.pathname)) return;
  const consent = getAdConsent();
  if (consent === "denied") return;
  if (consent === null) {
    if (pending.length < 20) pending.push(event);
    return;
  }
  load();
  window.fbq!(CUSTOM_EVENTS.includes(event) ? "trackCustom" : "track", event);
}

/** Replays what waited for Accept. Called when the choice changes. */
export function flushMeta() {
  if (getAdConsent() !== "granted") {
    pending = [];
    return;
  }
  const replay = pending;
  pending = [];
  for (const event of replay) metaTrack(event);
}
