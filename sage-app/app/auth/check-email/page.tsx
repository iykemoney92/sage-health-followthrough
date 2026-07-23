import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { PrototypeAction } from "@/components/prototype-action";

export default function CheckEmailPage() {
  return (
    <AuthShell
      title="Check your email"
      subtitle="We’ve sent you a link to verify your email and finish setting up your Sage account."
      backHref="/auth/sign-in"
    >
      <div className="auth-state-icon"><MailCheck /></div>
      <p className="auth-state-copy">Open the message from Sage and select the verification link. You can safely close this page afterwards.</p>
      <Link className="auth-primary" href="/auth/sign-in">Back to sign in <ArrowRight /></Link>
      <div className="auth-switch">Didn’t receive it? <PrototypeAction className="auth-inline-action" label="Resend email" title="Verification email resent" description="The frontend prototype shows the resend state. Email delivery will be connected during authentication integration."/></div>
    </AuthShell>
  );
}
