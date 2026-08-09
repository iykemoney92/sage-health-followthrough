"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { AuthAlert, friendlyAuthError } from "@/components/auth-alert";
import { NuraLogo } from "@/components/nura-logo";
import { track } from "@/lib/analytics";
import { normalizeEmail } from "@/lib/auth/helpers";
import "../auth.css";

const EMAIL_KEY = "nura-login-email";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Saved email only exists in localStorage — hydrate after mount.
    const saved = window.localStorage.getItem(EMAIL_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setEmail(saved);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setDevResetUrl(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        track("password_reset_fail");
        setError(
          friendlyAuthError(
            data?.error || "Password reset couldn’t be sent right now. Try again in a minute.",
          ),
        );
        return;
      }
      track("password_reset_request");
      setNotice(data.message || "If an account exists for that email, you’ll get a reset link shortly.");
      if (typeof data.devResetUrl === "string" && data.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-v2">
      <section className="auth-panel">
        <NuraLogo tagline={false} />
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-kicker">Reset password</span>
          <h1>Get back into Nura.</h1>
          <p>Enter the email on your account and we’ll send a reset link if it exists.</p>
          <label className={error ? "is-invalid" : undefined}>
            Email
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="email"
              required
              aria-invalid={Boolean(error)}
            />
          </label>
          {error && (
            <AuthAlert
              tone="error"
              title={error.title}
              message={error.message}
              onDismiss={() => setError(null)}
            />
          )}
          {notice && (
            <AuthAlert
              tone="success"
              title={devResetUrl ? "Dev reset ready" : "Check your email"}
              message={notice}
              onDismiss={() => {
                setNotice(null);
                setDevResetUrl(null);
              }}
            />
          )}
          {devResetUrl && (
            <a className="primary-cta auth-submit" href={devResetUrl} style={{ textAlign: "center" }}>
              Open reset link
            </a>
          )}
          <button type="submit" className="primary-cta auth-submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <p className="auth-switch">
            <Link href="/login">
              <ArrowLeft size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              Back to sign in
            </Link>
          </p>
        </form>
        <div className="auth-trust">
          <LockKeyhole size={16} /> Your health context stays private and under your control.
        </div>
      </section>
      <aside className="auth-visual" aria-hidden="true">
        <div>
          <span className="eyebrow-pill">Health follow-through</span>
          <h2>We’ll help you get back to your Care plans.</h2>
          <p>Resetting your password doesn’t change what Nura remembers — only how you sign back in.</p>
        </div>
      </aside>
    </main>
  );
}
