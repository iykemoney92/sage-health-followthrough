"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("nura-login-email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (rememberEmail) {
      window.localStorage.setItem("nura-login-email", email);
    } else {
      window.localStorage.removeItem("nura-login-email");
    }
    const completedOnboarding = data.user?.user_metadata?.onboarding_complete === true;
    router.push(completedOnboarding ? "/today" : "/onboarding");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <NuraLogo />
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-kicker">WELCOME BACK</span>
          <h1>Continue with Nura</h1>
          <p>Pick up where you left off with your health Threads and follow-ups.</p>
          <label>
            Email
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <span className="password-field">
              <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          <div className="auth-row">
            <label className="check">
              <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} /> Remember my email
            </label>
            <a href="#">Forgot password?</a>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary-cta auth-submit" disabled={loading}>
            {loading ? "Signing in…" : <>Sign in <ArrowRight /></>}
          </button>
          <p className="auth-switch">New to Nura? <Link href="/signup">Create an account</Link></p>
        </form>
        <div className="auth-trust">
          <LockKeyhole /> Your health context stays private and under your control.
        </div>
      </section>
      <aside className="auth-visual">
        <div>
          <span className="eyebrow-pill">A calmer way to keep up with your health</span>
          <h2>Come back to the things that matter, without starting over.</h2>
          <p>Nura remembers the context you choose, keeps your Threads organised and brings the right things back at the right time.</p>
        </div>
      </aside>
    </main>
  );
}
