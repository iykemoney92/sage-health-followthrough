"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { AuthAlert, friendlyAuthError } from "@/components/auth-alert";
import { NuraLogo } from "@/components/nura-logo";
import { track } from "@/lib/analytics";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import "../auth.css";

const RECOVERY_STORAGE_KEY = "nura-recovery-session";
const RECOVERY_OK_KEY = "nura-recovery-ok";

/** Prevents React Strict Mode double-mount from consuming the refresh token twice. */
let recoveryEstablishPromise: Promise<boolean> | null = null;

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
    window.history.replaceState({}, "", "/update-password");
  }
}

function markRecoveryOk() {
  try {
    sessionStorage.setItem(RECOVERY_OK_KEY, "1");
  } catch {
    // ignore
  }
}

function hasRecoveryOk() {
  try {
    return sessionStorage.getItem(RECOVERY_OK_KEY) === "1";
  } catch {
    return false;
  }
}

function stashRecoveryTokens(accessToken: string, refreshToken: string) {
  try {
    sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
    );
  } catch {
    // ignore storage failures
  }
}

function readStashedRecoveryTokens() {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearStashedRecoveryTokens() {
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function clearRecoveryOk() {
  try {
    sessionStorage.removeItem(RECOVERY_OK_KEY);
  } catch {
    // ignore
  }
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;
    let settled = false;

    function finish(ok: boolean) {
      if (!active || settled) return;
      settled = true;
      setLinkInvalid(!ok);
      setReady(true);
    }

    async function establishSessionOnce() {
      if (!recoveryEstablishPromise) {
        recoveryEstablishPromise = (async () => {
          try {
            const params = readAuthParams();
            if (params.error) {
              clearAuthParamsFromUrl();
              return false;
            }

            if (params.accessToken && params.refreshToken) {
              stashRecoveryTokens(params.accessToken, params.refreshToken);
              clearAuthParamsFromUrl();
            }

            const stashed = readStashedRecoveryTokens();
            const hasInbound =
              Boolean(stashed) ||
              Boolean(params.code) ||
              Boolean(params.tokenHash) ||
              params.type === "recovery";

            if (stashed?.access_token && stashed.refresh_token) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: stashed.access_token,
                refresh_token: stashed.refresh_token,
              });
              if (!sessionError) {
                clearStashedRecoveryTokens();
                markRecoveryOk();
                return true;
              }
              const retry = await supabase.auth.getSession();
              if (retry.data.session) {
                clearStashedRecoveryTokens();
                markRecoveryOk();
                return true;
              }
            }

            if (params.tokenHash && (params.type === "recovery" || params.type === "email")) {
              const { error: otpError } = await supabase.auth.verifyOtp({
                token_hash: params.tokenHash,
                type: params.type === "email" ? "email" : "recovery",
              });
              clearAuthParamsFromUrl();
              if (!otpError) {
                markRecoveryOk();
                return true;
              }
              return false;
            }

            if (params.code) {
              const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
              clearAuthParamsFromUrl();
              if (!exchangeError) {
                markRecoveryOk();
                return true;
              }
              const retry = await supabase.auth.getSession();
              if (retry.data.session && (hasInbound || hasRecoveryOk())) {
                markRecoveryOk();
                return true;
              }
              return false;
            }

            // After URL cleanup / Strict Mode remount: only trust an explicit recovery mark.
            if (hasRecoveryOk()) {
              const existing = await supabase.auth.getSession();
              return Boolean(existing.data.session);
            }

            return false;
          } catch {
            return false;
          } finally {
            window.setTimeout(() => {
              recoveryEstablishPromise = null;
            }, 0);
          }
        })();
      }
      return recoveryEstablishPromise;
    }

    async function prepare() {
      try {
        finish(await establishSessionOnce());
      } catch {
        finish(false);
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || settled || !session) return;
      if (event === "PASSWORD_RECOVERY") {
        markRecoveryOk();
        clearAuthParamsFromUrl();
        clearStashedRecoveryTokens();
        finish(true);
        return;
      }
      // Only accept other auth events if this tab already marked a recovery flow.
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && hasRecoveryOk()) {
        clearAuthParamsFromUrl();
        clearStashedRecoveryTokens();
        finish(true);
      }
    });

    void prepare();
    const timeout = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        finish(Boolean(data.session) && hasRecoveryOk());
      });
    }, 8000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError({ title: "Password too short", message: "Use at least 8 characters, then try again." });
      return;
    }
    if (password !== confirmPassword) {
      setError({ title: "Passwords don’t match", message: "Re-enter the same password in both fields." });
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      track("password_update_fail");
      setError(friendlyAuthError(updateError));
      return;
    }
    track("password_update_success");
    clearStashedRecoveryTokens();
    clearRecoveryOk();
    setNotice("Password updated. Taking you to Nura…");
    window.setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      const complete = data.user?.user_metadata?.onboarding_complete === true;
      router.push(complete ? "/today" : "/onboarding");
      router.refresh();
    }, 900);
  }

  return (
    <main className="auth-v2">
      <section className="auth-panel">
        <NuraLogo tagline={false} />
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-kicker">New password</span>
          <h1>Choose a new password.</h1>
          <p>Pick something memorable, then you’ll be back in your Care plans.</p>

          {!ready ? (
            <p className="auth-switch" style={{ borderTop: 0, paddingTop: 0, marginTop: 12 }}>
              Checking your reset link…
            </p>
          ) : linkInvalid ? (
            <AuthAlert
              tone="error"
              title="Reset link unavailable"
              message="This link is invalid or has expired. Request a new one from the forgot password page."
            />
          ) : (
            <>
              <label className={error ? "is-invalid" : undefined}>
                New password
                <span className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
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
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={Boolean(error)}
                />
              </label>
            </>
          )}

          {error && (
            <AuthAlert tone="error" title={error.title} message={error.message} onDismiss={() => setError(null)} />
          )}
          {notice && <AuthAlert tone="success" title="Saved" message={notice} />}

          {ready && !linkInvalid && (
            <button type="submit" className="primary-cta auth-submit" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </button>
          )}

          <p className="auth-switch">
            <Link href={linkInvalid ? "/forgot-password" : "/login"}>
              <ArrowLeft size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              {linkInvalid ? "Request a new link" : "Back to sign in"}
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
          <h2>Get back to the next step.</h2>
          <p>Once your password is updated, Nura picks up your Care plans where you left off.</p>
        </div>
      </aside>
    </main>
  );
}
