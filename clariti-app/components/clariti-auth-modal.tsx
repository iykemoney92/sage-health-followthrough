"use client";

import { ArrowRight, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthProviders } from "@/components/auth-providers";
import { track } from "@/lib/analytics";

type AuthMode = "signin" | "signup";

/**
 * Which of the modal's three screens is showing.
 *
 * The reset screen lives here rather than on /login because proxy.ts sends
 * /login and /signup to /?auth=1 — this modal is the only sign-in surface a
 * visitor can actually reach, so a "Forgot password" link anywhere else is a
 * link nobody sees.
 */
type AuthView = "credentials" | "reset";

export function ClaritiAuthModal({
  modeDefault = "signin",
  kicker = "SAVE YOUR DOCUMENT",
  title,
  copy,
  emailConfirmedNotice = false,
  onClose,
  onAuthenticated,
}: {
  modeDefault?: AuthMode;
  kicker?: string;
  title?: string;
  copy?: string;
  emailConfirmedNotice?: boolean;
  onClose: () => void;
  onAuthenticated: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>(modeDefault);
  // Read straight off the URL rather than through useSearchParams: the modal
  // renders in two different trees and neither should have to grow a Suspense
  // boundary for it. Safe during render because both call sites only mount the
  // modal once client state says so — the server never renders this.
  const [view, setView] = useState<AuthView>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reset") === "1"
      ? "reset"
      : "credentials",
  );
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, email, password, name }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Could not authenticate.");
        return;
      }

      if (result.requiresEmailConfirmation) {
        setPendingConfirmation(true);
        track("sign_up_pending_confirmation");
        return;
      }

      track(mode === "signup" ? "sign_up" : "sign_in");
      await onAuthenticated();
    } catch {
      setError("Sign-in is unavailable right now. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Could not send a reset link.");
        return;
      }

      // The route answers the same way for an address it has never seen, so this
      // notice has to be worded to be true either way.
      setResetNotice(result.message ?? "If that email has a Clariti account, we’ve sent a link to set a new password.");
    } catch {
      setError("Password reset is unavailable right now. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  if (view === "reset") {
    return (
      <div className="clariti-modal-backdrop" onMouseDown={onClose}>
        <form className="clariti-modal entry-auth-modal" onSubmit={(event) => void submitReset(event)} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close auth"><X /></button>
          <span className="modal-icon"><ShieldCheck /></span>
          <p className="canvas-kicker">RESET PASSWORD</p>
          <h2>Reset your password</h2>
          <p>{resetNotice ?? "Enter the email on your Clariti account and we’ll send a link to set a new password."}</p>
          {!resetNotice && (
            <>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Sending…" : <>Send reset link <ArrowRight /></>}</button>
            </>
          )}
          <button
            type="button"
            className="auth-mode-switch"
            onClick={() => {
              setView("credentials");
              setResetNotice(null);
              setError(null);
            }}
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  if (pendingConfirmation) {
    return (
      <div className="clariti-modal-backdrop" onMouseDown={onClose}>
        <div className="clariti-modal entry-auth-modal" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close auth"><X /></button>
          <span className="modal-icon"><ShieldCheck /></span>
          <p className="canvas-kicker">CHECK YOUR EMAIL</p>
          <h2>Confirm your account</h2>
          <p>We sent a confirmation link to <strong>{email}</strong>. Open it to verify your email — Clariti will bring you back here automatically.</p>
          {resendNotice && <p>{resendNotice}</p>}
          <button type="button" className="auth-submit" onClick={() => { setPendingConfirmation(false); setMode("signin"); }}>
            Back to sign in <ArrowRight />
          </button>
          <button
            type="button"
            className="auth-mode-switch"
            disabled={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                setError(null);
                try {
                  const response = await fetch("/api/auth/resend-confirmation", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  const result = await response.json().catch(() => null);
                  if (!response.ok || !result?.ok) {
                    setError(result?.error ?? "Could not resend confirmation email.");
                    setPendingConfirmation(false);
                    return;
                  }
                  // The route answers the same way for an address that needs
                  // nothing, so echo its wording rather than claiming a send.
                  setResendNotice(result.message ?? "If that account needs confirmation, we sent a new email.");
                } catch {
                  setError("Could not resend confirmation email.");
                  setPendingConfirmation(false);
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            {loading ? "Sending…" : "Resend confirmation email"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="clariti-modal-backdrop" onMouseDown={onClose}>
      <form className="clariti-modal entry-auth-modal" onSubmit={(event) => void submitAuth(event)} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close auth"><X /></button>
        <span className="modal-icon"><ShieldCheck /></span>
        <p className="canvas-kicker">{emailConfirmedNotice ? "EMAIL CONFIRMED" : kicker}</p>
        <h2>{title ?? (mode === "signin" ? "Sign in to analyze" : "Create your Clariti")}</h2>
        <p>
          {emailConfirmedNotice
            ? "Your email is verified. Sign in with your password to continue."
            : (copy ?? "Clariti needs an account before it stores health documents, analysis artifacts, explainers and email check-ins.")}
        </p>
        <AuthProviders />
        {mode === "signup" && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required /></label>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "Create a password" : "Password"} minLength={6} required autoComplete={mode === "signup" ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
        {mode === "signup" && <label>Confirm password<span className="password-field"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" minLength={6} required autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPassword((show) => !show)} aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}>{showConfirmPassword ? <EyeOff /> : <Eye />}</button></span></label>}
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Please wait..." : <>{mode === "signin" ? "Sign in" : "Create account"} <ArrowRight /></>}</button>
        <button type="button" className="auth-mode-switch" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
        {mode === "signin" && (
          <button type="button" className="auth-mode-switch" onClick={() => { setView("reset"); setError(null); }}>
            Forgot your password?
          </button>
        )}
      </form>
    </div>
  );
}
