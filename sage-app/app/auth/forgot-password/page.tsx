import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you use for Sage and we’ll send you a secure reset link."
      backHref="/auth/sign-in"
    >
      <form className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrap">
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            <span className="auth-input-icon"><Mail /></span>
          </div>
        </div>

        <Link className="auth-primary" href="/auth/check-email">Send reset link <ArrowRight /></Link>
      </form>

      <p className="auth-switch">Remembered it? <Link href="/auth/sign-in">Back to sign in</Link></p>
    </AuthShell>
  );
}
