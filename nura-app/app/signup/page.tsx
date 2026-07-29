"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { getAvatarUrl } from "@/lib/avatar";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!agreed) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const avatarUrl = getAvatarUrl(name || email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name, avatar_url: avatarUrl, onboarding_complete: false },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setNotice("Account created. Check your email to confirm it, then sign in.");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <NuraLogo />
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-kicker">GET STARTED</span>
          <h1>Create your Nura</h1>
          <p>Start with what&apos;s happening today. You can organise the rest as you go.</p>
          <label>
            Your name
            <input placeholder="Ike Okonkwo" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <span className="password-field">
              <input type={showPassword ? "text" : "password"} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          <label>
            Confirm password
            <span className="password-field">
              <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              <button type="button" onClick={() => setShowConfirmPassword((show) => !show)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                {showConfirmPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
          <label className="check consent">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> I agree to the Terms and Privacy Policy
          </label>
          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-success"><CheckCircle2 /> {notice}</p>}
          <button type="submit" className="primary-cta auth-submit" disabled={loading}>
            {loading ? "Creating account…" : <>Create account <ArrowRight /></>}
          </button>
          <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        </form>
      </section>
      <aside className="auth-visual signup-visual">
        <div>
          <span className="eyebrow-pill">Built around your real life</span>
          <h2>One place for the things you&apos;re trying to remember, manage and follow up.</h2>
          <ul>
            <li><CheckCircle2 /> Keep health topics together in Threads</li>
            <li><CheckCircle2 /> Upload notes and care instructions</li>
            <li><CheckCircle2 /> Get proactive check-ins when useful</li>
            <li><CheckCircle2 /> Prepare clear summaries before appointments</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
