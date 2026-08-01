"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
import { AuthAlert, friendlyAuthError } from "@/components/auth-alert";
import { NuraLogo } from "@/components/nura-logo";
import { AUTH_COPY, normalizeEmail } from "@/lib/auth/helpers";
import "../../auth.css";

const PENDING_EMAIL_KEY = "nura-pending-confirm-email";
const RESEND_AT_KEY = "nura-confirm-resend-at";
const COOLDOWN_SECONDS = 60;

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = normalizeEmail(searchParams.get("email") || "");

  const [email, setEmail] = useState(queryEmail);
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [devConfirmUrl, setDevConfirmUrl] = useState<string | null>(null);

  useEffect(() => {
    // Pending email + cooldown live in sessionStorage — browser-only after mount.
    const saved = normalizeEmail(window.sessionStorage.getItem(PENDING_EMAIL_KEY) || "");
    const resolved = queryEmail || saved;
    if (!resolved) {
      router.replace("/signup");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage hydration
    setEmail(resolved);
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, resolved);

    const storageKey = `${RESEND_AT_KEY}:${resolved}`;
    const raw = window.sessionStorage.getItem(storageKey);
    const until = raw ? Number(raw) : 0;
    if (Number.isFinite(until) && until > Date.now()) {
      setSecondsLeft(Math.ceil((until - Date.now()) / 1000));
    } else if (!raw) {
      const nextAt = Date.now() + COOLDOWN_SECONDS * 1000;
      window.sessionStorage.setItem(storageKey, String(nextAt));
      setSecondsLeft(COOLDOWN_SECONDS);
    } else {
      setSecondsLeft(0);
    }
    setReady(true);

    const devUrl = window.sessionStorage.getItem("nura-dev-confirm-url");
    if (devUrl) {
      setDevConfirmUrl(devUrl);
      window.sessionStorage.removeItem("nura-dev-confirm-url");
    }
  }, [queryEmail, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const maskedEmail = useMemo(() => {
    if (!email) return "";
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${local.length > 2 ? "•••" : ""}@${domain}`;
  }, [email]);

  function startCooldown() {
    const nextAt = Date.now() + COOLDOWN_SECONDS * 1000;
    window.sessionStorage.setItem(`${RESEND_AT_KEY}:${email}`, String(nextAt));
    setSecondsLeft(COOLDOWN_SECONDS);
  }

  async function handleResend() {
    if (!email || secondsLeft > 0 || loading) return;
    setError(null);
    setNotice(null);
    setDevConfirmUrl(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(
          friendlyAuthError(
            data?.error || "Confirmation email couldn’t be sent right now. Try again in a minute.",
          ),
        );
        return;
      }
      if (data.status === "already_confirmed") {
        setNotice(AUTH_COPY.alreadyConfirmed);
        return;
      }
      setNotice({
        title: "Email sent",
        message: data.message || "We’ve sent another confirmation email.",
      });
      if (typeof data.devConfirmUrl === "string" && data.devConfirmUrl) {
        setDevConfirmUrl(data.devConfirmUrl);
      }
      startCooldown();
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
        <div className="auth-card">
          <span className="auth-kicker">Check your inbox</span>
          <h1>Confirm your email.</h1>
          <p>
            We sent a confirmation link{maskedEmail ? ` to ${maskedEmail}` : ""}. Open it to finish
            creating your Nura account.
          </p>

          <div className="auth-trust" style={{ margin: "8px 0 4px", justifyContent: "flex-start" }}>
            <Mail size={16} />
            <span>Didn’t get it? Check spam, then resend below.</span>
          </div>

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
              title={notice.title}
              message={notice.message}
              onDismiss={() => setNotice(null)}
            />
          )}
          {notice?.title === AUTH_COPY.alreadyConfirmed.title && (
            <Link href="/login" className="primary-cta auth-submit" style={{ textAlign: "center" }}>
              Sign in
            </Link>
          )}
          {devConfirmUrl && (
            <a className="primary-cta auth-submit" href={devConfirmUrl} style={{ textAlign: "center" }}>
              Open confirmation link
            </a>
          )}

          <button
            type="button"
            className="primary-cta auth-submit"
            disabled={!ready || loading || secondsLeft > 0 || !email}
            onClick={() => void handleResend()}
          >
            {loading
              ? "Sending…"
              : secondsLeft > 0
                ? `Resend in ${secondsLeft}s`
                : "Resend confirmation email"}
          </button>

          <p className="auth-switch">
            <Link href="/login">
              <ArrowLeft size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              Back to sign in
            </Link>
          </p>
          <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0 }}>
            <span>Wrong address?</span>
            <Link href="/signup">Create an account again</Link>
          </p>
        </div>
        <div className="auth-trust">
          <LockKeyhole size={16} /> Your health context stays private and under your control.
        </div>
      </section>
      <aside className="auth-visual" aria-hidden="true">
        <div>
          <span className="eyebrow-pill">Almost there</span>
          <h2>One tap in your inbox, then you’re in.</h2>
          <p>Confirming your email keeps your Care plans private and tied to you.</p>
        </div>
      </aside>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-v2">
          <section className="auth-panel">
            <NuraLogo tagline={false} />
            <div className="auth-card">
              <span className="auth-kicker">Check your inbox</span>
              <h1>Confirm your email.</h1>
              <p>Loading…</p>
            </div>
          </section>
        </main>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
