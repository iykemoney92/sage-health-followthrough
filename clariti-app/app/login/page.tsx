"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "signin", email, password }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Could not sign in.");
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next ?? "/");
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
          <span className="clariti-kicker">WELCOME BACK</span>
          <h1>Sign in to Clariti</h1>
          <p>Continue with your saved documents, analyses, calls and follow-ups.</p>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
          <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight /></>}</button>
          <p className="auth-switch">New to Clariti? <Link href="/signup">Create an account</Link></p>
        </form>
        <div className="auth-trust"><LockKeyhole /> Your documents stay private and under your control.</div>
      </section>
      <aside className="clariti-auth-visual"><div><span>Document clarity</span><h2>Understand the document, then act on the next step.</h2><p>Clariti keeps each analysis, source anchor, call context and follow-up together.</p></div></aside>
    </main>
  );
}
