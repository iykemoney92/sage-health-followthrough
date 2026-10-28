/**
 * Google Ads conversion tag, so the Demand Gen campaign can be judged (and
 * bid) by web sign-ups instead of taps.
 *
 * It runs under the same three limits as the Quora and Meta Pixels
 * (lib/quora-pixel.ts, lib/meta-pixel.ts), and shares their consent answer:
 *
 * - Public pages only. The tag is never loaded on, and never sends anything
 *   from, a signed-in page such as /today or /plans.
 * - Web only. Inside the iOS or Android shell nothing loads at all.
 * - Opt-in everywhere. Nothing is requested from Google Ads until the visitor
 *   presses Accept on the cookie notice.
 *
 * Loading the tag on a public page stores the ad click id (gclid) so a later
 * sign-up can be credited to the ad. The only event sent is the "Nura sign-up"
 * conversion when the web sign-up form succeeds.
 */

import { adMeasurementApplies, getAdConsent, isPublicPath } from "@/lib/quora-pixel";

export const GOOGLE_ADS_ID = "AW-17800155232";
const SIGNUP_SEND_TO = "AW-17800155232/xBYPCNmBra0dEOCg46dC";

export type GoogleAdsEvent = "Visit" | "SignUp";

let loaded = false;
let pending: GoogleAdsEvent[] = [];

/** gtag's own loader; it shares window.gtag and dataLayer with Google Analytics. */
function load() {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // gtag queues the arguments object itself; keep that shape.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
  }
  window.gtag("config", GOOGLE_ADS_ID, { send_page_view: false });
  const js = document.createElement("script");
  js.async = true;
  js.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  (document.head || document.documentElement).appendChild(js);
}

/**
 * Loads the tag and sends the event, if this page and this visitor's choice
 * allow it. Before a choice is made, events wait in memory and go out only if
 * Accept is pressed on this page; "Essential only" drops them.
 */
export function googleAdsTrack(event: GoogleAdsEvent) {
  if (!adMeasurementApplies()) return;
  if (!isPublicPath(window.location.pathname)) return;
  const consent = getAdConsent();
  if (consent === "denied") return;
  if (consent === null) {
    if (pending.length < 20) pending.push(event);
    return;
  }
  load();
  if (event === "SignUp") window.gtag!("event", "conversion", { send_to: SIGNUP_SEND_TO });
}

/** Replays what waited for Accept. Called when the choice changes. */
export function flushGoogleAds() {
  if (getAdConsent() !== "granted") {
    pending = [];
    return;
  }
  const replay = pending;
  pending = [];
  for (const event of replay) googleAdsTrack(event);
}
