"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

type ConfirmStatus = "checking" | "success" | "signin" | "error";

/** Prevents Strict Mode double-mount from consuming one-time tokens twice. */
let confirmEstablishPromise: Promise<{ ok: boolean; signedIn: boolean; message: string }> | null = null;

function readAuthParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;

  return {
    code: query.get("code"),
    tokenHash: query.get("token_hash") || hash.get("token_hash"),
    type: (query.get("type") || hash.get("type") || "").toLowerCase(),
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    confirmedFlag: query.get("confirmed") === "1",
    error: query.get("error") || hash.get("error"),
    errorDescription: query.get("error_description") || hash.get("error_description"),
    next: query.get("next") || "/",
  };
}

function clearAuthParamsFromUrl() {
  if (window.location.hash || window.location.search) {
    window.history.replaceState({}, "", "/auth/confirm");
  }
}

function friendlyConfirmError(description: string | null) {
  const lower = (description || "").toLowerCase();
  if (lower.includes("code verifier") || lower.includes("pkce")) {
    return "This confirmation link can’t finish sign-in in this browser. Your email should still be confirmed — sign in with your password.";
  }
  if (lower.includes("expired") || lower.includes("invalid") || lower.includes("otp")) {
    return "This confirmation link is invalid or has expired. Sign up again, or try signing in if you already confirmed.";
  }
  if (description) return description.replace(/\+/g, " ");
  return "We couldn’t confirm your email with this link. Try signing in, or create your account again.";
}

function safeNext(raw: string | null | undefined) {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return "/";
  return trimmed;
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConfirmStatus>("checking");
  const [message, setMessage] = useState("Confirming your email…");
  const [continueHref, setContinueHref] = useState("/");
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function establishOnce() {
      if (!confirmEstablishPromise) {
        confirmEstablishPromise = (async () => {
          try {
            const params = readAuthParams();
            const supabase = getSupabaseBrowserClient();

            if (params.error && !params.confirmedFlag) {
              clearAuthParamsFromUrl();
              return { ok: false, signedIn: false, message: friendlyConfirmError(params.errorDescription) };
            }

            if (params.confirmedFlag) {
              clearAuthParamsFromUrl();
              const existing = await supabase.auth.getSession();
              if (existing.data.session) {
                return { ok: true, signedIn: true, message: "Your email is confirmed. You’re signed in." };
              }
              // Exchange may have failed across browsers, but the address is confirmed.
              return {
                ok: true,
                signedIn: false,
                message: params.errorDescription
                  ? friendlyConfirmError(params.errorDescription)
                  : "Your email is confirmed. Sign in with your password to continue.",
              };
            }

            const existing = await supabase.auth.getSession();
            if (existing.data.session && !params.accessToken && !params.code && !params.tokenHash) {
              clearAuthParamsFromUrl();
              return { ok: true, signedIn: true, message: "Your email is confirmed. You’re ready to continue." };
            }

            // Implicit / hash tokens from Supabase verify redirect.
            if (params.accessToken && params.refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: params.accessToken,
                refresh_token: params.refreshToken,
              });
              clearAuthParamsFromUrl();
              if (error) {
                const retry = await supabase.auth.getSession();
                if (retry.data.session) {
                  return { ok: true, signedIn: true, message: "Your email is confirmed. You’re signed in." };
                }
                return { ok: false, signedIn: false, message: friendlyConfirmError(error.message) };
              }
              return { ok: true, signedIn: true, message: "Your email is confirmed. You’re signed in." };
            }

            // token_hash is cross-browser safe (no PKCE verifier).
            if (params.tokenHash) {
              const otpType =
                params.type === "magiclink"
                  ? "magiclink"
                  : params.type === "email"
                    ? "email"
                    : params.type === "recovery"
                      ? "recovery"
                      : "signup";
              const { error } = await supabase.auth.verifyOtp({
                token_hash: params.tokenHash,
                type: otpType,
              });
              clearAuthParamsFromUrl();
              if (error) return { ok: false, signedIn: false, message: friendlyConfirmError(error.message) };
              return { ok: true, signedIn: true, message: "Your email is confirmed. You’re signed in." };
            }

            // PKCE `?code=` — cookie-aware server callback.
            if (params.code) {
              const next = encodeURIComponent(safeNext(params.next) === "/" ? "/auth/confirm" : safeNext(params.next));
              window.location.replace(
                `/auth/callback?code=${encodeURIComponent(params.code)}&next=${next}`,
              );
              await new Promise<never>(() => {});
            }

            const late = await supabase.auth.getSession();
            if (late.data.session) {
              clearAuthParamsFromUrl();
              return { ok: true, signedIn: true, message: "Your email is confirmed. You’re ready to continue." };
            }

            return {
              ok: false,
              signedIn: false,
              message: "This page didn’t receive a confirmation link. Open the link from your email, or sign in.",
            };
          } catch {
            return {
              ok: false,
              signedIn: false,
              message: "Something went wrong while confirming your email. Try the link again, or sign in.",
            };
          } finally {
            window.setTimeout(() => {
              confirmEstablishPromise = null;
            }, 0);
          }
        })();
      }
      return confirmEstablishPromise;
    }

    void (async () => {
      const result = await establishOnce();
      if (!active) return;

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return;
      }

      if (result.signedIn) {
        setStatus("success");
        setMessage(result.message);
        setContinueHref("/");
        setRedirectIn(2);
        return;
      }

      setStatus("signin");
      setMessage(result.message);
      setContinueHref("/?auth=1&mode=signin&confirmed=1");
      setRedirectIn(3);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if ((status !== "success" && status !== "signin") || redirectIn === null) return;

    if (redirectIn <= 0) {
      router.push(continueHref);
      router.refresh();
      return;
    }

    const id = window.setTimeout(() => setRedirectIn((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [status, redirectIn, continueHref, router]);

  const heading =
    status === "checking"
      ? "Confirming your email…"
      : status === "success"
        ? "You’re confirmed."
        : status === "signin"
          ? "Email confirmed."
          : "Confirmation didn’t finish.";

  return (
    <main className="clariti-auth-page">
      <section className="clariti-auth-panel">
        <Link href="/" className="clariti-brand">
          <span className="clariti-mark">C</span>
          <strong>Clariti</strong>
        </Link>
        <div className="clariti-auth-card">
          <span className="clariti-kicker">EMAIL CONFIRMATION</span>
          <h1>{heading}</h1>
          <p>{message}</p>

          {status === "checking" && (
            <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0, marginTop: 4, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 className="entry-spinner" size={16} /> Verifying your confirmation link…
            </p>
          )}

          {(status === "success" || status === "signin") && (
            <button
              type="button"
              className="auth-submit"
              onClick={() => {
                setRedirectIn(null);
                router.push(continueHref);
                router.refresh();
              }}
            >
              {status === "success" ? (
                <>
                  Continue to Clariti
                  {redirectIn !== null && redirectIn > 0 ? ` (${redirectIn})` : ""} <ArrowRight />
                </>
              ) : (
                <>
                  Sign in
                  {redirectIn !== null && redirectIn > 0 ? ` (${redirectIn})` : ""} <ArrowRight />
                </>
              )}
            </button>
          )}

          {status === "error" && (
            <>
              <Link
                href="/?auth=1&mode=signin"
                className="auth-submit"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
              >
                Back to sign in <ArrowRight />
              </Link>
              <p className="auth-switch">
                <Link href="/?auth=1&mode=signup">Create an account</Link>
              </p>
            </>
          )}

          {status !== "error" && status !== "checking" && (
            <p className="auth-switch">
              <Link href="/?auth=1&mode=signin">Sign in instead</Link>
            </p>
          )}
        </div>
        <div className="auth-trust">
          <LockKeyhole /> Your health documents stay private and under your control.
        </div>
      </section>
      <aside className="clariti-auth-visual" aria-hidden="true">
        <div>
          <span>Almost there</span>
          <h2>One click, then Clariti can keep your document journey going.</h2>
          <ul>
            <li><CheckCircle2 /> Plain-language explanations</li>
            <li><CheckCircle2 /> Explainer videos & follow-ups</li>
            <li><CheckCircle2 /> Phone walkthroughs when you need them</li>
          </ul>
          {status === "error" && (
            <p style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={17} /> If the link expired, create the account again or try signing in.
            </p>
          )}
        </div>
      </aside>
    </main>
  );
}
