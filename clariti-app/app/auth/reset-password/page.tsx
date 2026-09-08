"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { consumeRecoveryHandoff } from "@/lib/auth/recovery-handoff";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

type ScreenState = "checking" | "ready" | "expired" | "done";

/**
 * Where a recovery link finishes, and the only place a password can be changed.
 *
 * /auth/confirm verifies the recovery token and lands here with a live session.
 * That session is the whole authorisation for the change: Supabase will not let
 * updateUser touch a password without one, so a link that has expired or been
 * used already arrives here signed out and is turned away rather than shown a
 * form that could never submit.
 *
 * Settings links a signed-in visitor here too, and there the session is much
 * weaker evidence — it persists in the native WebView, so a borrowed unlocked
 * phone carries one, and a password change evicts the real owner immediately.
 * That entry therefore asks for the current password and verifies it before
 * anything is written. Only an arrival marked by /auth/confirm skips that, and
 * only because the one-time link already proved the same thing. Turning on
 * Supabase's "Secure password change" project setting enforces the same rule
 * inside GoTrue, and is worth doing regardless of this screen.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>("checking");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [needsCurrentPassword, setNeedsCurrentPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The marker is consumed once and remembered on the instance, so Strict Mode's
  // second pass does not read an empty slot and turn a recovery visitor into a
  // re-authentication they cannot complete.
  const arrivedFromRecovery = useRef<boolean | null>(null);

  useEffect(() => {
    let active = true;

    if (arrivedFromRecovery.current === null) {
      arrivedFromRecovery.current = consumeRecoveryHandoff();
    }
    const recovery = arrivedFromRecovery.current;

    void (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!active) return;
      const session = data.session;
      if (!session) {
        setState("expired");
        return;
      }
      setAccountEmail(session.user.email ?? null);
      // Without an address there is nothing to re-authenticate against, so a
      // recovery-less visitor is sent back to the link instead of being shown a
      // form that would change the password on a session alone.
      if (!recovery && !session.user.email) {
        setState("expired");
        return;
      }
      setNeedsCurrentPassword(!recovery);
      setState("ready");
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      if (needsCurrentPassword) {
        if (!accountEmail) {
          setError("Clariti could not read the account on this session. Sign in again, then try once more.");
          return;
        }
        const check = await supabase.auth.signInWithPassword({ email: accountEmail, password: currentPassword });
        if (check.error) {
          setError("That current password is not right.");
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setState("done");
    } catch {
      setError("Your password couldn’t be changed right now. Try again shortly.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (state !== "done") return;
    const id = window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2000);
    return () => window.clearTimeout(id);
  }, [state, router]);

  return (
    <main className="clariti-auth-page">
      <section className="clariti-auth-panel">
        <Link href="/" className="clariti-brand">
          <span className="clariti-mark">C</span>
          <strong>Clariti</strong>
        </Link>

        {state === "checking" && (
          <div className="clariti-auth-card">
            <span className="clariti-kicker">NEW PASSWORD</span>
            <h1>Checking your link…</h1>
            <p className="auth-switch" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 className="entry-spinner" size={16} /> One moment.
            </p>
          </div>
        )}

        {state === "expired" && (
          <div className="clariti-auth-card">
            <span className="clariti-kicker">NEW PASSWORD</span>
            <h1>This link has expired.</h1>
            <p>Reset links work once and expire after about an hour. Ask for a new one and open it from the same device.</p>
            <Link
              href="/?auth=1&mode=signin&reset=1"
              className="auth-submit"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
            >
              Send a new link <ArrowRight />
            </Link>
            <p className="auth-switch">
              <Link href="/?auth=1&mode=signin">Back to sign in</Link>
            </p>
          </div>
        )}

        {state === "done" && (
          <div className="clariti-auth-card">
            <span className="clariti-kicker">NEW PASSWORD</span>
            <h1>Your password is set.</h1>
            <p>You’re signed in. Clariti will take you back to your documents in a moment.</p>
            <button
              type="button"
              className="auth-submit"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              Continue to Clariti <ArrowRight />
            </button>
          </div>
        )}

        {state === "ready" && (
          <form className="clariti-auth-card" onSubmit={(event) => void handleSubmit(event)}>
            <span className="clariti-kicker">NEW PASSWORD</span>
            <h1>{needsCurrentPassword ? "Change your password" : "Set a new password"}</h1>
            <p>
              {needsCurrentPassword
                ? "Confirm the password you use now, then choose a new one. It takes effect as soon as you save it."
                : "Choose a password you don’t use anywhere else. It takes effect as soon as you save it."}
            </p>
            {needsCurrentPassword && (
              <label>
                Current password
                <span className="password-field">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Current password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((show) => !show)}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </label>
            )}
            <label>
              New password
              <span className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </label>
            <label>
              Confirm new password
              <span className="password-field">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((show) => !show)}
                  aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={saving}>
              {saving ? "Saving..." : <>Save password <ArrowRight /></>}
            </button>
          </form>
        )}

        <div className="auth-trust">
          <LockKeyhole /> Your health documents stay private and under your control.
        </div>
      </section>
      <aside className="clariti-auth-visual" aria-hidden="true">
        <div>
          <span>Account security</span>
          <h2>A new password, then straight back to your documents.</h2>
          <ul>
            <li><CheckCircle2 /> Your saved analyses stay where they were</li>
            <li><CheckCircle2 /> The old password stops working immediately</li>
            <li><CheckCircle2 /> Reset links expire after about an hour</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
