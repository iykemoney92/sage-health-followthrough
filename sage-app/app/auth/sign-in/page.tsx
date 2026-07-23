import Link from "next/link";
import { ArrowRight, Eye, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your plans, check-ins and progress with Sage."
    >
      <form className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrap">
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            <span className="auth-input-icon"><Mail /></span>
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label htmlFor="password">Password</label>
            <Link href="/auth/forgot-password">Forgot password?</Link>
          </div>
          <div className="auth-input-wrap">
            <input id="password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" />
            <span className="auth-input-icon"><Eye /></span>
          </div>
        </div>

        <Link className="auth-primary" href="/today">Sign in <ArrowRight /></Link>

        <div className="auth-divider">or</div>
        <Link className="auth-secondary" href="/today">Continue with Google</Link>
      </form>

      <p className="auth-switch">New to Sage? <Link href="/auth/sign-up">Create an account</Link></p>
    </AuthShell>
  );
}
