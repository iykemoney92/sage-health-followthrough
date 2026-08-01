"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AuthAlert } from "@/components/auth-alert";
import { NuraLogo } from "@/components/nura-logo";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import "../../auth.css";

type ConfirmStatus = "checking" | "success" | "error";

/** Prevents Strict Mode double-mount from consuming one-time tokens twice. */
let confirmEstablishPromise: Promise<{ ok: boolean; message: string }> | null = null;

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
    error: query.get("error") || hash.get("error"),
    errorDescription: query.get("error_description") || hash.get("error_description"),
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
    return "This confirmation link can’t be finished in this browser. Request a fresh email, then open it here.";
  }
  if (lower.includes("expired") || lower.includes("invalid")) {
    return "This confirmation link is invalid or has expired. Request a new one from the check-email screen, or try signing in.";
  }
  if (description) return description.replace(/\+/g, " ");
  return "We couldn’t confirm your email with this link. Try signing in, or create your account again.";
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConfirmStatus>("checking");
  const [message, setMessage] = useState("Confirming your email…");
  const [continueHref, setContinueHref] = useState("/onboarding");
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function establishOnce() {
      if (!confirmEstablishPromise) {
        confirmEstablishPromise = (async () => {
          try {
            const params = readAuthParams();
            const confirmedFlag = new URL(window.location.href).searchParams.get("confirmed");

            if (params.error) {
              clearAuthParamsFromUrl();
              return { ok: false, message: friendlyConfirmError(params.errorDescription) };
            }

            if (confirmedFlag === "1") {
              clearAuthParamsFromUrl();
              const existingAfter = await supabase.auth.getSession();
              if (existingAfter.data.session) {
                return { ok: true, message: "Your email is confirmed. You’re ready to continue." };
              }
            }

            const existing = await supabase.auth.getSession();
            if (existing.data.session && !params.accessToken && !params.code && !params.tokenHash) {
              clearAuthParamsFromUrl();
              return { ok: true, message: "Your email is confirmed. You’re ready to continue." };
            }

            if (params.accessToken && params.refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: params.accessToken,
                refresh_token: params.refreshToken,
              });
              clearAuthParamsFromUrl();
              if (error) {
                const retry = await supabase.auth.getSession();
                if (retry.data.session) {
                  return { ok: true, message: "Your email is confirmed. You’re ready to continue." };
                }
                return { ok: false, message: friendlyConfirmError(error.message) };
              }
              return {
                ok: true,
                message:
                  params.type === "signup" || params.type === "email" || params.type === "magiclink"
                    ? "Your email is confirmed. You’re ready to continue in Nura."
                    : "You’re verified. Continue to Nura.",
              };
            }

            // token_hash is the cross-browser-safe path (no PKCE verifier needed).
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
              if (error) return { ok: false, message: friendlyConfirmError(error.message) };
              return { ok: true, message: "Your email is confirmed. You’re ready to continue in Nura." };
            }

            // Legacy PKCE `?code=` — hand off to cookie-aware server callback.
            if (params.code) {
              window.location.replace(
                `/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent("/auth/confirm")}`,
              );
              // Page is navigating away; don't paint an error state.
              await new Promise<never>(() => {});
            }

            // No tokens — maybe they refreshed after a successful confirm.
            const late = await supabase.auth.getSession();
            if (late.data.session) {
              return { ok: true, message: "Your email is confirmed. You’re ready to continue." };
            }

            return {
              ok: false,
              message: "This page didn’t receive a confirmation link. Open the link from your email, or sign in.",
            };
          } catch {
            return {
              ok: false,
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
      setStatus(result.ok ? "success" : "error");
      setMessage(result.message);

      if (result.ok) {
        const { data } = await supabase.auth.getUser();
        const completed = data.user?.user_metadata?.onboarding_complete === true;
        setContinueHref(completed ? "/today" : "/onboarding");
        setRedirectIn(3);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "success" || redirectIn === null) return;

    if (redirectIn <= 0) {
      router.push(continueHref);
      router.refresh();
      return;
    }

    const id = window.setTimeout(() => setRedirectIn((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [status, redirectIn, continueHref, router]);

  return (
    <main className="auth-v2">
      <section className="auth-panel">
        <NuraLogo tagline={false} />
        <div className="auth-card">
          <span className="auth-kicker">Email confirmation</span>
          <h1>
            {status === "checking"
              ? "Confirming your email…"
              : status === "success"
                ? "You’re confirmed."
                : "Confirmation didn’t finish."}
          </h1>
          <p>
            {status === "checking"
              ? "Hang on a moment while we verify your address."
              : status === "success"
                ? redirectIn !== null && redirectIn > 0
                  ? `Your email is verified. Taking you to Nura in ${redirectIn}…`
                  : "Your email is verified. Taking you to Nura…"
                : "We couldn’t complete email confirmation with that link."}
          </p>

          {status === "checking" ? (
            <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0, marginTop: 12 }}>
              Checking your confirmation link…
            </p>
          ) : (
            <AuthAlert
              tone={status === "success" ? "success" : "error"}
              title={status === "success" ? "Email confirmed" : "Couldn’t confirm email"}
              message={message}
            />
          )}

          {status === "success" && (
            <button
              type="button"
              className="primary-cta auth-submit"
              onClick={() => {
                setRedirectIn(null);
                router.push(continueHref);
                router.refresh();
              }}
            >
              {redirectIn !== null && redirectIn > 0 ? (
                <>Continue in {redirectIn}s <ArrowRight size={18} /></>
              ) : (
                <>Continue <ArrowRight size={18} /></>
              )}
            </button>
          )}

          {status === "error" && (
            <>
              <Link href="/login" className="primary-cta auth-submit" style={{ textAlign: "center" }}>
                Back to sign in
              </Link>
              <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0 }}>
                <Link href="/auth/check-email">Resend confirmation email</Link>
              </p>
            </>
          )}

          <p className="auth-switch">
            {status === "success" ? (
              <Link href="/login">Sign in instead</Link>
            ) : status === "error" ? (
              <Link href="/signup">Create an account</Link>
            ) : (
              <Link href="/login">Back to sign in</Link>
            )}
          </p>
        </div>
        <div className="auth-trust">
          <LockKeyhole size={16} /> Your health context stays private and under your control.
        </div>
      </section>
      <aside className="auth-visual" aria-hidden="true">
        <div>
          <span className="eyebrow-pill">Health follow-through</span>
          <h2>One more step, then you’re in.</h2>
          <p>Once your email is confirmed, Nura can keep your Care plans ready for the next check-in.</p>
        </div>
      </aside>
    </main>
  );
}
