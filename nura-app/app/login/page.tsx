"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { AuthAlert, friendlyAuthError } from "@/components/auth-alert";
import { NuraLogo } from "@/components/nura-logo";
import { AUTH_COPY, normalizeEmail } from "@/lib/auth/helpers";
import { safeNextPath } from "@/lib/auth/safe-path";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import "../auth.css";

const EMAIL_KEY = "nura-login-email";

function readLoginAuthParams() {
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
    confirmed: query.get("confirmed"),
    next: safeNextPath(query.get("next"), ""),
  };
}

function postAuthPath(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
  next?: string,
) {
  if (next && user?.user_metadata?.onboarding_complete === true) return next;
  return user?.user_metadata?.onboarding_complete === true ? "/today" : "/onboarding";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Saved email only exists in localStorage — hydrate after mount.
    const saved = window.localStorage.getItem(EMAIL_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setEmail(saved);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function handleInboundAuth() {
      const params = readLoginAuthParams();

      if (params.confirmed === "1") {
        window.history.replaceState({}, "", "/login");
        if (active) setNotice(AUTH_COPY.emailConfirmed);
        return;
      }

      const looksLikeConfirm =
        Boolean(params.error) ||
        Boolean(params.accessToken && params.refreshToken) ||
        Boolean(params.code) ||
        Boolean(params.tokenHash) ||
        params.type === "signup" ||
        params.type === "email" ||
        params.type === "magiclink";

      if (!looksLikeConfirm) return;

      if (params.error) {
        window.history.replaceState({}, "", "/login");
        if (active) {
          setError({
            title: "Confirmation didn’t finish",
            message: (params.errorDescription || "This confirmation link is invalid or has expired.").replace(
              /\+/g,
              " ",
            ),
          });
        }
        return;
      }

      try {
        let authError: { message?: string } | null = null;

        if (params.accessToken && params.refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          authError = result.error;
        } else if (params.tokenHash && (params.type === "signup" || params.type === "email" || params.type === "magiclink")) {
          const otpType =
            params.type === "magiclink" ? "magiclink" : params.type === "email" ? "email" : "signup";
          const result = await supabase.auth.verifyOtp({
            token_hash: params.tokenHash,
            type: otpType,
          });
          authError = result.error;
        } else if (params.code) {
          const result = await supabase.auth.exchangeCodeForSession(params.code);
          authError = result.error;
        }

        window.history.replaceState({}, "", "/login");
        if (!active) return;

        if (authError) {
          setError({
            title: "Confirmation didn’t finish",
            message: authError.message || "We couldn’t verify that link. Try signing in, or request a new email.",
          });
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setNotice({
            title: AUTH_COPY.emailConfirmed.title,
            message: "Your address is verified. Taking you into Nura…",
          });
          window.setTimeout(() => {
            router.push(postAuthPath(data.session?.user));
            router.refresh();
          }, 900);
        } else {
          setNotice(AUTH_COPY.emailConfirmed);
        }
      } catch {
        window.history.replaceState({}, "", "/login");
        if (active) {
          setError({
            title: "Confirmation didn’t finish",
            message: "We couldn’t verify that link. Try signing in, or request a new confirmation email.",
          });
        }
      }
    }

    void handleInboundAuth();
    return () => {
      active = false;
    };
  }, [router]);

  function clearFeedback() {
    if (error) setError(null);
    if (notice) setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const normalized = normalizeEmail(email);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(friendlyAuthError(signInError));
      return;
    }

    if (rememberEmail) {
      window.localStorage.setItem(EMAIL_KEY, normalized);
    } else {
      window.localStorage.removeItem(EMAIL_KEY);
    }

    router.push(postAuthPath(data.user, safeNextPath(new URLSearchParams(window.location.search).get("next"), "")));
    router.refresh();
  }

  return (
    <main className="auth-v2">
      <section className="auth-panel">
        <NuraLogo tagline={false} />
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-kicker">Welcome back</span>
          <h1>Continue your follow-through.</h1>
          <p>Pick up your Care plans and check-ins — so health advice doesn’t disappear after the visit.</p>
          <label className={error ? "is-invalid" : undefined}>
            Email
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFeedback();
              }}
              autoComplete="email"
              required
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className={error ? "is-invalid" : undefined}>
            Password
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFeedback();
                }}
                required
                autoComplete="current-password"
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
          <div className="auth-row">
            <label className="check">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(event) => setRememberEmail(event.target.checked)}
              />
              Remember my email
            </label>
            <Link href="/forgot-password">Forgot password?</Link>
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
          {error?.title === "Confirm your email" && (
            <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
              <Link href={`/auth/check-email?email=${encodeURIComponent(normalizeEmail(email))}`}>
                Resend confirmation email
              </Link>
            </p>
          )}
          <button type="submit" className="primary-cta auth-submit" disabled={loading}>
            {loading ? "Signing in…" : <>Sign in <ArrowRight size={18} /></>}
          </button>
          <p className="auth-switch">
            <span>New to Nura?</span>
            <Link href="/signup">Create an account</Link>
          </p>
        </form>
        <div className="auth-trust">
          <LockKeyhole size={16} /> Your health context stays private and under your control.
        </div>
      </section>
      <aside className="auth-visual" aria-hidden="true">
        <div>
          <span className="eyebrow-pill">Health follow-through</span>
          <h2>Come back to the next step, not a blank slate.</h2>
          <p>Nura keeps the context you choose, holds it in a Care plan, and checks back in when life gets busy.</p>
        </div>
      </aside>
    </main>
  );
}
