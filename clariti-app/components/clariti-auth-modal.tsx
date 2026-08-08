"use client";

import { ArrowRight, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";

type AuthMode = "signin" | "signup";

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
        return;
      }

      await onAuthenticated();
    } catch {
      setError("Supabase is not configured yet.");
    } finally {
      setLoading(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div className="clariti-modal-backdrop" onMouseDown={onClose}>
        <div className="clariti-modal entry-auth-modal" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close auth"><X /></button>
          <span className="modal-icon"><ShieldCheck /></span>
          <p className="canvas-kicker">CHECK YOUR EMAIL</p>
          <h2>Confirm your account</h2>
          <p>We sent a confirmation link to <strong>{email}</strong>. Open it to verify your email — Clariti will bring you back here automatically.</p>
          <button type="button" className="auth-submit" onClick={() => { setPendingConfirmation(false); setMode("signin"); }}>
            Back to sign in <ArrowRight />
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
            : (copy ?? "Clariti needs an account before it stores health documents, analysis artifacts, calls and follow-ups.")}
        </p>
        {mode === "signup" && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required /></label>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "Create a password" : "Password"} minLength={6} required autoComplete={mode === "signup" ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
        {mode === "signup" && <label>Confirm password<span className="password-field"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" minLength={6} required autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPassword((show) => !show)} aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}>{showConfirmPassword ? <EyeOff /> : <Eye />}</button></span></label>}
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Please wait..." : <>{mode === "signin" ? "Sign in" : "Create account"} <ArrowRight /></>}</button>
        <button type="button" className="auth-mode-switch" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
