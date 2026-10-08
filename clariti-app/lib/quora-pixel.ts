/**
 * Quora Pixel, so Quora ads can be judged by what they bring to the website.
 *
 * Three limits keep it away from anyone's health information:
 *
 * - Public pages only (PUBLIC_PATHS). The pixel is never loaded on, and never
 *   sends anything from, a page that shows documents or analyses, such as
 *   /workspace, /documents or /history. It sees page addresses only, never a
 *   document or anything Clariti wrote about one.
 * - Web only. Inside the iOS or Android shell nothing loads at all: the shells
 *   load this same site, and the App Store forbids tracking without ATT.
 * - Opt-in everywhere. Clariti is a health product, so nothing is requested from
 *   Quora until the visitor presses Accept on the cookie notice, wherever they
 *   are. That choice is stored under its own key, because an Accept given to the
 *   older "never for ads" notice must not count as a yes to this.
 *
 * Events: ViewContent for each public page, Generic for an App Store or Google
 * Play click (a store click is the app's conversion), and CompleteRegistration
 * when a web sign-up succeeds.
 */

export const QUORA_PIXEL_ID = "c71a7f641b4e4c73bfc1a52510bf5874";
const QUORA_SDK_URL = "https://a.quora.com/qevents.js";

export const AD_CONSENT_KEY = "clariti_ad_measurement_consent";
export const AD_CONSENT_EVENT = "clariti-ad-measurement-consent";

/** Pages the pixel may run on. Everything else is the signed-in product. */
const PUBLIC_PATHS = ["/", "/example", "/signup", "/privacy", "/terms"];

export type QuoraEvent = "ViewContent" | "Generic" | "CompleteRegistration";
export type AdConsent = "granted" | "denied";

type QuoraFn = ((...args: unknown[]) => void) & {
  qp?: (...args: unknown[]) => void;
  queue?: unknown[];
  disablePushState?: boolean;
};

declare global {
  interface Window {
    qp?: QuoraFn;
  }
}

let loaded = false;
let pending: QuoraEvent[] = [];

function isNativeShell() {
  if (typeof window === "undefined") return false;
  const bridge = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof bridge?.isNativePlatform === "function" && bridge.isNativePlatform();
}

function isPublicPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_PATHS.includes(path);
}

/** Whether this visitor can ever be asked: web, not the app shells. */
export function adMeasurementApplies() {
  return typeof window !== "undefined" && !isNativeShell();
}

export function getAdConsent(): AdConsent | null {
  if (!adMeasurementApplies()) return "denied";
  try {
    const value = localStorage.getItem(AD_CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
  } catch {
    // Private browsing or storage disabled.
  }
  return null;
}

export function setAdConsent(value: AdConsent | null) {
  try {
    if (value === null) localStorage.removeItem(AD_CONSENT_KEY);
    else localStorage.setItem(AD_CONSENT_KEY, value);
  } catch {
    // Private browsing or storage disabled — the choice won't persist.
  }
  if (value !== "granted") pending = [];
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AD_CONSENT_EVENT));
}

/** Quora's own loader: qp() queues calls until qevents.js arrives. */
function load() {
  if (loaded) return;
  loaded = true;
  if (!window.qp) {
    const n: QuoraFn = function qp() {
      // Quora's snippet queues the arguments object itself; keep that shape.
      // eslint-disable-next-line prefer-rest-params, prefer-spread
      if (n.qp) n.qp.apply(n, arguments as unknown as unknown[]);
      // eslint-disable-next-line prefer-rest-params
      else n.queue!.push(arguments);
    };
    n.queue = [];
    window.qp = n;
  }
  // Once loaded, qevents.js would follow the visitor into the signed-in app,
  // which is a client-side navigation away. Two of its habits are switched off
  // here so that it never reports a signed-in page's address:
  // - It sends ViewContent on every pushState, replaceState and popstate unless
  //   qp.disablePushState is true. Only quoraTrack() sends events now.
  // - It sends a "DwellTime" ping when the tab is hidden or blurred, using the
  //   address in `ia_document.shareURL` when that global exists (it was made
  //   for Facebook Instant Articles) and location.href otherwise. Off the
  //   public pages, this getter makes that address the bare site root.
  window.qp.disablePushState = true;
  try {
    Object.defineProperty(window, "ia_document", {
      configurable: true,
      get: () => (isPublicPath(window.location.pathname) ? undefined : { shareURL: `${window.location.origin}/` }),
    });
  } catch {
    // Already defined by something else; leave it.
  }
  window.qp("init", QUORA_PIXEL_ID);
  const js = document.createElement("script");
  js.async = true;
  js.src = QUORA_SDK_URL;
  (document.head || document.documentElement).appendChild(js);
}

/**
 * Sends one event, if this page and this visitor's choice allow it. Before a
 * choice is made, events wait in memory and go out only if Accept is pressed
 * on this page; "Essential only" drops them.
 */
export function quoraTrack(event: QuoraEvent) {
  if (!adMeasurementApplies()) return;
  if (!isPublicPath(window.location.pathname)) return;
  const consent = getAdConsent();
  if (consent === "denied") return;
  if (consent === null) {
    if (pending.length < 20) pending.push(event);
    return;
  }
  load();
  window.qp!("track", event);
}

/** Replays what waited for Accept. Called when the choice changes. */
export function flushQuora() {
  if (getAdConsent() !== "granted") {
    pending = [];
    return;
  }
  const replay = pending;
  pending = [];
  for (const event of replay) quoraTrack(event);
}

/** App Store and Google Play links: the site's conversions for the app. */
export function isConversionLink(href: string) {
  try {
    const url = new URL(href, window.location.href);
    return url.hostname === "apps.apple.com" || url.hostname === "play.google.com";
  } catch {
    return false;
  }
}
