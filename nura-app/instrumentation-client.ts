import { startPostHog, watchPostHogConsent } from "@/lib/posthog";

// PostHog loads before the app is interactive when the cookie notice already
// says Accept (lib/posthog.ts), and starts later if the visitor accepts.
try {
  startPostHog();
  watchPostHogConsent();
} catch {
  // Measurement must never break the page.
}
