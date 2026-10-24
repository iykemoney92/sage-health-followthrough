"use client";

import { useEffect, useState } from "react";
import { Browser } from "@capacitor/browser";
import { track } from "@/lib/analytics";
import { isNativeShell, signInWithProvider, type OAuthProvider } from "@/lib/auth/oauth";

/**
 * Google's mark. Their brand terms require the four-colour "G" rather than a
 * recoloured or monochrome copy, so it's inlined at full fidelity.
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

const PROVIDERS: Array<{ id: OAuthProvider; label: string; mark: () => React.ReactElement }> = [
  { id: "apple", label: "Apple", mark: AppleMark },
  { id: "google", label: "Google", mark: GoogleMark },
];

/**
 * Google and Apple sign-in, above the email form on /login and /signup.
 *
 * One component for both pages: to Supabase these are the same call, and a
 * provider account that doesn't exist yet is created on first use, so there's no
 * meaningful sign-in/sign-up distinction to encode here.
 *
 * Sign in with Apple isn't optional decoration — App Store Guideline 4.8 requires
 * it wherever a third-party login (Google, here) is offered.
 */
export function AuthProviders({ next, label = "or continue with" }: { next?: string | null; label?: string }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Closing the sign-in sheet without finishing (Done / Cancel in Safari, back
  // from the Chrome tab) must give the buttons back. Without this they stayed on
  // "Opening…" and greyed out until the app was restarted.
  useEffect(() => {
    const release = () => setPending(null);
    // Web: coming back from the provider with the browser's Back button restores
    // this page from the back-forward cache, state and all.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) release();
    };
    window.addEventListener("pageshow", onPageShow);

    let removeBrowserListener: (() => void) | undefined;
    let cancelled = false;
    if (isNativeShell()) {
      void Browser.addListener("browserFinished", release)
        .then((handle) => {
          if (cancelled) void handle.remove();
          else removeBrowserListener = () => void handle.remove();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      removeBrowserListener?.();
    };
  }, []);

  async function start(provider: OAuthProvider) {
    setError(null);
    setPending(provider);
    track("oauth_start", { provider });

    // Treated as a failure if it throws as well as if it returns an error: the
    // buttons stay disabled while a sign-in is pending, so anything escaping
    // this call would leave both of them stuck on "Opening…" with nothing on
    // screen, which is what App Review saw as an unresponsive button.
    const failed = await signInWithProvider(provider, next)
      .then(({ error: providerError }) => Boolean(providerError))
      .catch(() => true);

    if (failed) {
      track("oauth_fail", { provider });
      setError("We couldn’t reach that sign-in provider. Try again, or use your email below.");
      setPending(null);
      return;
    }
    // On success the page is either navigating away (web) or waiting on Safari
    // (native), so `pending` stays set until the sheet closes (see the effect
    // above) — re-enabling the buttons sooner would invite a second tap mid-handoff.
  }

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
            <span>{pending === id ? "Opening…" : `Continue with ${name}`}</span>
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
