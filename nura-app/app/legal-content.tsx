import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";

type LegalSection = {
  title: string;
  body: string;
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="legal-page">
      <header className="legal-nav">
        <NuraLogo href="/" />
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-use">Data use</Link>
        </nav>
        <Link href="/" className="secondary-cta"><ArrowLeft /> Back</Link>
      </header>
      <section className="legal-hero">
        <span className="legal-icon"><LockKeyhole /></span>
        <span className="auth-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <small>Hackathon demo policy. Last updated July 25, 2026.</small>
      </section>
      <section className="legal-body">
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
