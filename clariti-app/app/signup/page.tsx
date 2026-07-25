"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";

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
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!agreed) {
      setError("Please agree to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password, name }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Could not create account.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Supabase is not configured yet. Add the Supabase env vars to enable auth.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="clariti-auth-page">
      <section className="clariti-auth-panel">
        <Link href="/" className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></Link>
        <form className="clariti-auth-card" onSubmit={handleSubmit}>
          <span className="clariti-kicker">GET STARTED</span>
          <h1>Create your Clariti</h1>
          <p>Save document analyses, source-grounded explainers, calls and follow-ups.</p>
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
          <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" minLength={6} required autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
          <label>Confirm password<span className="password-field"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" minLength={6} required autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPassword((show) => !show)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>{showConfirmPassword ? <EyeOff /> : <Eye />}</button></span></label>
          <label className="auth-check"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I understand Clariti explains documents and does not diagnose or make final coverage decisions.</label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Creating account..." : <>Create account <ArrowRight /></>}</button>
          <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        </form>
      </section>
      <aside className="clariti-auth-visual"><div><span>Built for the real journey</span><h2>From upload to explanation, call context and follow-up.</h2><ul><li><CheckCircle2 /> Radiology report explanation</li><li><CheckCircle2 /> Medical bill breakdown</li><li><CheckCircle2 /> Insurance EOB decoding</li></ul></div></aside>
    </main>
  );
}
