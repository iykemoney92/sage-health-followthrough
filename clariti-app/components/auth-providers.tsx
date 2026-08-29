"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { signInWithProvider, type OAuthProvider } from "@/lib/auth/oauth";

/**
 * Google's mark. Their brand terms require the four-colour "G" rather than a
 * recoloured or monochrome copy, so it is inlined at full fidelity.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/** Apple requires their glyph on the button, sized to match the label. */
function AppleMark() {
  return (
    <svg viewBox="0 0 16 20" width="17" height="17" aria-hidden focusable="false" fill="currentColor">
      <path d="M13.29 10.62c.02 2.43 2.13 3.24 2.15 3.25-.02.06-.34 1.16-1.11 2.3-.67.99-1.36 1.97-2.46 1.99-1.07.02-1.42-.63-2.65-.63-1.23 0-1.62.61-2.64.65-1.06.04-1.87-1.07-2.54-2.05-1.38-2-2.44-5.66-1.02-8.13.7-1.23 1.96-2 3.33-2.02 1.04-.02 2.02.7 2.65.7.64 0 1.83-.86 3.08-.74.53.02 2 .21 2.95 1.6-.08.05-1.76 1.03-1.74 3.08M11.3 3.38c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.36 1.21-.51.6-.96 1.56-.84 2.48.9.07 1.82-.46 2.37-1.13" />
    </svg>
  );
}

const ALL_PROVIDERS: Array<{ id: OAuthProvider; label: string; mark: () => React.ReactElement }> = [
  { id: "apple", label: "Apple", mark: AppleMark },
  { id: "google", label: "Google", mark: GoogleMark },
];

/**
 * Which providers are actually wired up in Supabase, as a comma-separated list.
 *
 * A button for a provider Supabase has not been configured with does not fail
 * gracefully — it throws a 400 the moment it is tapped — so this defaults to
 * NONE rather than to both. Turn each one on only once its provider is enabled
 * in the Supabase dashboard, and remember that Guideline 4.8 means "google"
 * cannot be listed without "apple".
 */
const ENABLED_PROVIDERS = new Set(
  (process.env.NEXT_PUBLIC_CLARITI_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const PROVIDERS = ALL_PROVIDERS.filter((provider) => ENABLED_PROVIDERS.has(provider.id));

/**
 * Apple and Google sign-in, above the email fields on every Clariti auth surface.
 *
 * One component for the modal and both auth pages: to Supabase these are the
 * same call, and a provider account that does not exist yet is created on first
 * use, so there is no sign-in/sign-up distinction worth encoding here.
 *
 * Sign in with Apple is not optional decoration — App Store Guideline 4.8
 * requires it wherever a third-party login (Google, here) is offered, so the two
 * buttons ship together or not at all.
 */
export function AuthProviders({
  next,
  label = "or use your email",
}: {
  next?: string | null;
  label?: string;
}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read at click time rather than render time: the modal is mounted on `/`,
  // which is exactly where proxy.ts sends someone it bounced off a protected
  // route, carrying the route they wanted as ?next=. Nothing threads that
  // through the modal's props, and reading it here keeps all three mount points
  // — the modal, /login and /signup — behaving the same.
  const destination = () =>
    next ?? (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next"));

  async function start(provider: OAuthProvider) {
    setError(null);
    setPending(provider);
    track("oauth_start", { provider });

    const { error: providerError } = await signInWithProvider(provider, destination());

    if (providerError) {
      track("oauth_fail", { provider });
      setError("That sign-in didn’t open. Try again, or use your email and password below.");
      setPending(null);
      return;
    }
    // On success the page is either navigating away (web) or waiting on Safari
    // (native), so `pending` deliberately stays set — re-enabling the buttons
    // would only invite a second tap mid-handoff.
  }

  // Nothing configured yet: render neither the buttons nor the "or use your
  // email" divider, so the email form reads as the whole sign-in, not as the
  // remainder of something that failed to load.
  if (PROVIDERS.length === 0) return null;

  return (
    <div className="auth-providers">
      <div className="auth-provider-row">
        {PROVIDERS.map(({ id, label: name, mark: Mark }) => (
          <button
            key={id}
            type="button"
            className={`auth-provider auth-provider-${id}`}
            onClick={() => void start(id)}
            disabled={pending !== null}
            aria-busy={pending === id}
          >
            <Mark />
            <span>{pending === id ? "Connecting…" : `Continue with ${name}`}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="auth-provider-error" role="alert">
          {error}
        </p>
      )}
      <div className="auth-provider-divider">
        <span>{label}</span>
      </div>
    </div>
  );
}
