import Link from "next/link";
import { ArrowLeft, Leaf, LockKeyhole, ShieldCheck } from "lucide-react";

export function SageMark() {
  return (
    <span className="auth-logo-mark" aria-hidden="true">
      <Leaf />
    </span>
  );
}

export function AuthShell({
  children,
  title,
  subtitle,
  backHref = "/",
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  backHref?: string;
}) {
  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-leaf auth-leaf-one" />
        <div className="auth-leaf auth-leaf-two" />
        <div className="auth-leaf auth-leaf-three" />
      </div>

      <header className="auth-header">
        <Link className="auth-brand" href="/">
          <SageMark />
          <span>Sage</span>
        </Link>
        <Link className="auth-back-link" href={backHref}>
          <ArrowLeft />
          Back
        </Link>
      </header>

      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-card-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>

        <aside className="auth-trust-card">
          <div className="auth-trust-icon">
            <ShieldCheck />
          </div>
          <div>
            <strong>Your health context stays yours.</strong>
            <p>Sage is designed to support follow-through, not replace professional care or make diagnoses.</p>
          </div>
        </aside>
      </section>

      <footer className="auth-footer">
        <span><LockKeyhole /> Private by design</span>
        <nav>
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
          <Link href="#">Support</Link>
        </nav>
      </footer>
    </main>
  );
}
