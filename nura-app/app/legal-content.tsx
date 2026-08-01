import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { NURA_PRODUCT } from "@/lib/product/nura-story";
import "./legal.css";

type LegalSection = {
  title: string;
  body: string;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  active: "privacy" | "terms" | "data-use";
};

const navItems = [
  { href: "/privacy", id: "privacy" as const, label: "Privacy" },
  { href: "/terms", id: "terms" as const, label: "Terms" },
  { href: "/data-use", id: "data-use" as const, label: "Data use" },
];

export function LegalPage({ eyebrow, title, intro, sections, active }: LegalPageProps) {
  return (
    <main className="legal-v2">
      <header className="legal-nav">
        <NuraLogo href="/" tagline={false} />
        <nav aria-label="Legal">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={item.id === active ? "is-active" : undefined}
              aria-current={item.id === active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="legal-back">
          <ArrowLeft size={16} /> Back to Nura
        </Link>
      </header>

      <section className="legal-hero">
        <span className="legal-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <small>Last updated July 29, 2026</small>
      </section>

      <section className="legal-body">
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <footer className="legal-footer">
        <div>
          <NuraLogo compact href="/" />
          <p>{NURA_PRODUCT.footerLine}</p>
        </div>
        <nav aria-label="Legal links">
          {navItems.map((item) => (
            <Link key={item.id} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <span>© 2026 Zapx Solutions Limited. Nura is a product of Zapx Solutions Limited.</span>
      </footer>
    </main>
  );
}
