"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { AuthAlert, friendlyAuthError } from "@/components/auth-alert";
import { NuraLogo } from "@/components/nura-logo";
import { AUTH_COPY, normalizeEmail } from "@/lib/auth/helpers";
import "../auth.css";

const PENDING_EMAIL_KEY = "nura-pending-confirm-email";
const RESEND_AT_PREFIX = "nura-confirm-resend-at:";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function clearError() {
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError({
        title: "Almost there",
        message: "Please agree to the Terms and Privacy Policy to continue.",
      });
      return;
    }
    if (password.length < 8) {
      setError({
        title: "Password too short",
        message: "Use at least 8 characters, then try again.",
      });
      return;
    }
    if (password !== confirmPassword) {
      setError({
        title: "Passwords don’t match",
        message: "Re-enter the same password in both fields.",
      });
      return;
    }

    setLoading(true);
    const normalized = normalizeEmail(email);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          password,
          name: name.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok || !data?.ok) {
        if (data?.code === "email_exists" || res.status === 409) {
          setError(AUTH_COPY.duplicateAccount);
          return;
        }
        setError(friendlyAuthError(data?.error || "Couldn’t create your account. Try again."));
        return;
      }

      if (data.needsConfirmation) {
        window.sessionStorage.setItem(PENDING_EMAIL_KEY, normalized);
        window.sessionStorage.setItem(`${RESEND_AT_PREFIX}${normalized}`, String(Date.now() + 60_000));
        if (typeof data.devConfirmUrl === "string" && data.devConfirmUrl) {
          window.sessionStorage.setItem("nura-dev-confirm-url", data.devConfirmUrl);
        }
        router.push(`/auth/check-email?email=${encodeURIComponent(normalized)}`);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(friendlyAuthError(err));
    }
  }

  return (
    <main className="auth-v2">
      <section className="auth-panel">
        <NuraLogo tagline={false} />
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-kicker">Get started</span>
          <h1>Create your Nura.</h1>
          <p>Start with what’s happening today. You can organise the rest as you go.</p>
          <label>
            Your name
            <input
              placeholder="Ike Okonkwo"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError();
              }}
              required
              autoComplete="name"
            />
          </label>
          <label className={error ? "is-invalid" : undefined}>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              required
              autoComplete="email"
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className={error ? "is-invalid" : undefined}>
            Password
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                required
                minLength={8}
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((show) => !show)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          <label className={error ? "is-invalid" : undefined}>
            Confirm password
            <span className="password-field">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError();
                }}
                required
                minLength={8}
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((show) => !show)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          <label className="check consent">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>
            </span>
          </label>
          {error && (
            <AuthAlert
              tone="error"
              title={error.title}
              message={error.message}
              onDismiss={() => setError(null)}
            />
          )}
          {error?.title === AUTH_COPY.duplicateAccount.title && (
            <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
              <Link href="/login">Sign in</Link>
              <span aria-hidden> · </span>
              <Link href="/forgot-password">Reset password</Link>
            </p>
          )}
          <button type="submit" className="primary-cta auth-submit" disabled={loading}>
            {loading ? "Creating account…" : <>Create account <ArrowRight size={18} /></>}
          </button>
          <p className="auth-switch">
            <span>Already have an account?</span>
            <Link href="/login">Sign in</Link>
          </p>
        </form>
        <div className="auth-trust">
          <LockKeyhole size={16} /> Your health context stays private and under your control.
        </div>
      </section>
      <aside className="auth-visual signup-visual" aria-hidden="true">
        <div>
          <span className="eyebrow-pill">Built around your real life</span>
          <h2>One place for the things you’re trying to remember, manage and follow up.</h2>
          <ul>
            <li>
              <CheckCircle2 size={16} /> Keep health topics together in Care plans
            </li>
            <li>
              <CheckCircle2 size={16} /> Upload notes and care instructions
            </li>
            <li>
              <CheckCircle2 size={16} /> Get proactive check-ins when useful
            </li>
            <li>
              <CheckCircle2 size={16} /> Prepare clear summaries before appointments
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
