import type { PostHog } from "posthog-js";
import { ANALYTICS_CONSENT_EVENT, getPostHogConsent } from "@/lib/analytics-consent";

/**
 * PostHog product analytics: page views, clicks, errors and session
 * recordings, so we can see where people get stuck. One EU project ("Zapx
 * Products") is shared by every Zapx product, told apart by the `product`
 * property.
 *
 * Consent: it follows the cookie notice (getPostHogConsent). Nothing loads
 * until the visitor presses Accept on a notice that names PostHog, and
 * "Essential only" stops it. The iOS shell has no notice: PostHog is on there
 * unless the privacy page's Product analytics switch turns it off (see
 * analytics-consent.ts).
 *
 * Health information: typed text is masked in recordings, and every signed-in
 * page (plans, check-ins, messages, documents, medications) sits inside a
 * `.ph-mask.ph-sensitive` container, so recordings show no text there and
 * clicks carry no element text. Images, audio and video in those containers
 * are blocked. Links that are secrets (consent, circle and email tokens,
 * sign-in codes) are scrubbed from every URL before it leaves the browser.
 *
 * Only on the production site (usenura.app), so previews and local dev send
 * nothing. NEXT_PUBLIC_POSTHOG_KEY=off disables it.
 */

/** The project token is public: it can only send events, like a Stripe publishable key. */
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "phc_ALci32bGNJvd8BfF7V3RVvW3QxXHF8JeXbwpDgEp28xB";

export const POSTHOG_PRODUCT = "nura";

const IDENTIFIED_KEY = "nura_ph_identified";

/** Paths whose next segment is a secret link token. */
const TOKEN_PATHS = /\/(agree|join|circle\/emails)\/[^/?#]+/g;
/** Query parameters that carry sign-in codes or tokens. */
const SECRET_PARAMS = ["code", "token", "token_hash", "access_token", "refresh_token", "invite", "t"];

function postHogEnabled() {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production" || POSTHOG_KEY === "off") return false;
  return /(^|\.)usenura\.app$/.test(window.location.hostname);
}

/** Strips link tokens, sign-in codes and the hash from a URL or path. */
export function scrubUrl(value: string): string {
  if (!value) return value;
  let out = value.replace(TOKEN_PATHS, (_match, base: string) => `/${base}/:token`);
  const hash = out.indexOf("#");
  if (hash !== -1) out = out.slice(0, hash);
  const q = out.indexOf("?");
  if (q === -1) return out;
  const params = new URLSearchParams(out.slice(q + 1));
  let changed = false;
  for (const key of SECRET_PARAMS) {
    if (params.has(key)) {
      params.set(key, "redacted");
      changed = true;
    }
  }
  if (!changed) return out;
  const query = params.toString();
  return query ? `${out.slice(0, q)}?${query}` : out.slice(0, q);
}

function platform() {
  const bridge = (window as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  if (typeof bridge?.isNativePlatform === "function" && bridge.isNativePlatform()) {
    return bridge.getPlatform?.() === "ios" ? "ios_app" : "android_app";
  }
  return "web";
}

let client: Promise<PostHog | null> | null = null;
let pendingId: string | null = null;

/** Loads PostHog once, if consent allows. Safe to call again, e.g. after Accept. */
export function startPostHog(): Promise<PostHog | null> | null {
  if (!postHogEnabled()) return null;
  if (getPostHogConsent() !== "granted") return null;
  if (client) {
    // Accepted after an earlier "Essential only" in this page's life.
    void client.then((ph) => {
      if (ph?.has_opted_out_capturing()) ph.opt_in_capturing();
    });
    return client;
  }
  client = import("posthog-js")
    .then(({ default: ph }) => {
      ph.init(POSTHOG_KEY, {
        api_host: "https://eu.i.posthog.com",
        ui_host: "https://eu.posthog.com",
        defaults: "2025-05-24",
        person_profiles: "identified_only",
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: ".ph-mask",
          blockSelector: ".ph-mask img, .ph-mask audio, .ph-mask video, .ph-mask canvas",
          // Page addresses in recordings, plus any captured request: no tokens,
          // and never request or response bodies or headers.
          maskCapturedNetworkRequestFn: (request) => {
            const masked = { ...request, name: scrubUrl(request.name) };
            delete masked.requestBody;
            delete masked.responseBody;
            delete masked.requestHeaders;
            delete masked.responseHeaders;
            return masked;
          },
        },
        before_send: (event) => {
          if (!event) return event;
          for (const props of [event.properties, event.$set, event.$set_once]) {
            if (!props) continue;
            for (const [key, value] of Object.entries(props)) {
              if (typeof value === "string" && /url|pathname|referrer/i.test(key)) props[key] = scrubUrl(value);
            }
          }
          return event;
        },
      });
      ph.register({ product: POSTHOG_PRODUCT, platform: platform() });
      if (pendingId) ph.identify(pendingId);
      return ph;
    })
    .catch(() => null);
  return client;
}

/** Follows the cookie notice for the rest of this page's life. */
export function watchPostHogConsent() {
  if (typeof window === "undefined") return;
  window.addEventListener(ANALYTICS_CONSENT_EVENT, () => {
    if (getPostHogConsent() === "granted") startPostHog();
    else void client?.then((ph) => ph?.opt_out_capturing());
  });
}

/** Forwards an existing Nura event (same name and properties). No-op without consent. */
export function capturePostHog(event: string, properties?: Record<string, unknown>) {
  if (getPostHogConsent() !== "granted") return;
  void client?.then((ph) => ph?.capture(event, properties));
}

/** Ties this browser's events to the Nura user (Supabase auth user id; never the email). */
export function identifyPostHog(id: string) {
  pendingId = id;
  try {
    localStorage.setItem(IDENTIFIED_KEY, "1");
  } catch {
    // Storage unavailable.
  }
  void client?.then((ph) => {
    if (ph && ph.get_distinct_id() !== id) ph.identify(id);
  });
}

/** Signed out: later events in this browser are no longer that person's. */
export function resetPostHog() {
  pendingId = null;
  try {
    localStorage.removeItem(IDENTIFIED_KEY);
  } catch {
    // Storage unavailable.
  }
  void client?.then((ph) => ph?.reset());
}

/** True when this browser was tied to a user, so a missing session means a reset is due. */
export function wasIdentified() {
  try {
    return localStorage.getItem(IDENTIFIED_KEY) === "1";
  } catch {
    return false;
  }
}
