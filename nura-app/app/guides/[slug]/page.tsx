import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { GUIDES, GUIDE_CATEGORIES, GUIDE_SIGNUP_HREF, getGuide, relatedGuides } from "@/lib/guides";
import { toolForGuide } from "@/lib/tools";
import { GuideChrome, GuideDisclaimer } from "../guide-chrome";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

/**
 * One page per question people search that Nura genuinely helps with (lib/guides).
 * Statically generated; the content only changes when the data files do.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: { url: path, title: guide.question, description: guide.description, type: "article" },
    twitter: { card: "summary_large_image", title: guide.question, description: guide.description },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const url = `${appUrl}/guides/${guide.slug}`;
  const related = relatedGuides(guide);
  const tool = toolForGuide(guide.slug);
  const categoryLabel = GUIDE_CATEGORIES.find((c) => c.id === guide.category)?.label ?? "Guides";

  // FAQPage built only from what the page shows: the question and its answer, the "why",
  // the steps, and the page's own FAQs. No ratings, no reviews, nothing that isn't visible.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        mainEntity: [
          { "@type": "Question", name: guide.question, acceptedAnswer: { "@type": "Answer", text: guide.answer } },
          {
            "@type": "Question",
            name: "Why is this harder than it sounds?",
            acceptedAnswer: { "@type": "Answer", text: guide.why },
          },
          {
            "@type": "Question",
            name: "What should you do?",
            acceptedAnswer: {
              "@type": "Answer",
              text: guide.steps.map((step) => `${step.title}: ${step.body}`).join(" "),
            },
          },
          ...guide.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${appUrl}/guides` },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="guide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <Link href="/guides">Guides</Link>
          <span aria-hidden="true">/</span>
          <span>{guide.title}</span>
        </nav>

        <article>
          <span className="guide-kicker">{categoryLabel}</span>
          <h1>{guide.question}</h1>

          {/* The direct answer, first and alone: it is what someone searching wants, and the passage
              a search engine or AI assistant will quote. */}
          <p className="guide-answer">{guide.answer}</p>

          {tool && (
            <aside className="guide-tool" aria-label={tool.name}>
              <div>
                <b>{tool.name}</b>
                <p>{tool.blurb}</p>
              </div>
              <Link href={`/tools/${tool.slug}`} className="guide-tool-link">
                Make a chart <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </aside>
          )}

          <section className="guide-section">
            <h2>Why is this harder than it sounds?</h2>
            <p>{guide.why}</p>
          </section>

          <section className="guide-section">
            <h2>What should you do?</h2>
            <ol className="guide-steps">
              {guide.steps.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="guide-section">
            <h2>What tends not to work</h2>
            <ul className="guide-avoid">
              {guide.avoid.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">✕</span>
                  <p>{item}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="guide-section guide-faq">
            <h2>Common questions</h2>
            {guide.faqs.map((faq) => (
              <div key={faq.q}>
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </section>

          <section className="guide-nura" aria-labelledby="guide-nura-heading">
            <h2 id="guide-nura-heading">Where Nura fits</h2>
            <p>{guide.nura}</p>
            <div className="guide-nura-actions">
              <TrackedLink
                href={GUIDE_SIGNUP_HREF}
                className="guide-button"
                event="guide_cta_click"
                eventParams={{ cta: "get_started", placement: "guide_body", guide: guide.slug }}
              >
                Get started with Nura <ArrowRight size={16} />
              </TrackedLink>
              <StoreBadges placement="guide_body" compact utmContent="guide" />
            </div>
          </section>

          <section className="guide-section guide-sources">
            <h2>Sources</h2>
            <ul>
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <GuideDisclaimer />
        </article>

        {related.length > 0 && (
          <section className="guide-section" aria-labelledby="guide-related-heading">
            <h2 id="guide-related-heading">Related guides</h2>
            <ul className="guide-related">
              {related.map((other) => (
                <li key={other.slug}>
                  <Link href={`/guides/${other.slug}`}>
                    <b>{other.question}</b>
                    <small>{other.description}</small>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="guide-all">
              <Link href="/guides">All guides →</Link>
            </p>
          </section>
        )}
      </main>
    </GuideChrome>
  );
}
