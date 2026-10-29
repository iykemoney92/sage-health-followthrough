/**
 * Pinterest tag, so Pinterest ads can be judged (and bid) by what they bring
 * to the website, not just by Pin clicks.
 *
 * It runs under the same three limits as the Quora and Meta Pixels
 * (lib/quora-pixel.ts, lib/meta-pixel.ts), and shares their consent answer:
 *
 * - Public pages only. The tag is never loaded on, and never sends anything
 *   from, a signed-in page such as /today or /plans.
 * - Web only. Inside the iOS or Android shell nothing loads at all.
 * - Opt-in everywhere. Nothing is requested from Pinterest until the visitor
 *   presses Accept on the cookie notice, wherever they are.
 *
 * Only what pinterestTrack() asks for is sent: pagevisit for each public page,
 * lead for an App Store, Google Play or "Get started" click, and signup when
 * the web sign-up form succeeds. No enhanced match (no email is ever passed).
 */

import { adMeasurementApplies, getAdConsent, isPublicPath } from "@/lib/quora-pixel";

export const PINTEREST_TAG_ID = "2613226217949";
const PINTEREST_SDK_URL = "https://s.pinimg.com/ct/core.js";

export type PinterestEvent = "pagevisit" | "lead" | "signup";

type PintrkFn = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  version?: string;
};

declare global {
  interface Window {
    pintrk?: PintrkFn;
  }
}

let loaded = false;
let pending: PinterestEvent[] = [];

/** Pinterest's own loader: pintrk() queues calls until core.js arrives. */
function load() {
  if (loaded) return;
  loaded = true;
  if (!window.pintrk) {
    const n: PintrkFn = function pintrk() {
      // Pinterest's snippet queues the arguments as an array; keep that shape.
      // eslint-disable-next-line prefer-rest-params
      n.queue!.push(Array.prototype.slice.call(arguments));
    };
    n.queue = [];
    n.version = "3.0";
    window.pintrk = n;
  }
  window.pintrk("load", PINTEREST_TAG_ID);
  const js = document.createElement("script");
  js.async = true;
  js.src = PINTEREST_SDK_URL;
  (document.head || document.documentElement).appendChild(js);
}

/**
 * Sends one event, if this page and this visitor's choice allow it. Before a
 * choice is made, events wait in memory and go out only if Accept is pressed
 * on this page; "Essential only" drops them.
 */
export function pinterestTrack(event: PinterestEvent) {
  if (!adMeasurementApplies()) return;
  if (!isPublicPath(window.location.pathname)) return;
  const consent = getAdConsent();
  if (consent === "denied") return;
  if (consent === null) {
    if (pending.length < 20) pending.push(event);
    return;
  }
  load();
  window.pintrk!("track", event);
}

/** Replays what waited for Accept. Called when the choice changes. */
export function flushPinterest() {
  if (getAdConsent() !== "granted") {
    pending = [];
    return;
  }
  const replay = pending;
  pending = [];
  for (const event of replay) pinterestTrack(event);
}
