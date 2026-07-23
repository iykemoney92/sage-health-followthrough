import Link from "next/link";
import { ArrowRight, Eye, Mail, UserRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your Sage account"
      subtitle="Start with what you’re dealing with today. Sage will help turn it into a plan you can follow."
    >
      <form className="auth-form">
        <div className="auth-field">
          <label htmlFor="name">Your name</label>
          <div className="auth-input-wrap">
            <input id="name" name="name" type="text" placeholder="What should Sage call you?" autoComplete="name" />
            <span className="auth-input-icon"><UserRound /></span>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrap">
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            <span className="auth-input-icon"><Mail /></span>
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="password">Create a password</label>
          <div className="auth-input-wrap">
            <input id="password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" />
            <span className="auth-input-icon"><Eye /></span>
          </div>
        </div>

        <label className="auth-checkline">
          <input type="checkbox" />
          <span>I agree to Sage’s <Link href="#">Terms</Link> and acknowledge the <Link href="#">Privacy Policy</Link>.</span>
        </label>

        <button className="auth-primary" type="button">Create account <ArrowRight /></button>

        <div className="auth-divider">or</div>
        <button className="auth-secondary" type="button">Continue with Google</button>
        <p className="auth-note">Sage supports health and wellbeing follow-through. It does not diagnose conditions or replace professional care.</p>
      </form>

      <p className="auth-switch">Already have an account? <Link href="/auth/sign-in">Sign in</Link></p>
    </AuthShell>
  );
}
