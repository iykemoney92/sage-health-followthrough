import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";
import { GUIDES, getGuide } from "@/lib/content/guides";
import { TOPICS, getTopic } from "@/lib/content/topics";
import { GuideCta, GuideFoot, ToolPromo } from "../guide-parts";
import { TopicArticle } from "./topic-article";
import "../guides.css";

// Not in PROTECTED_PREFIXES in proxy.ts, like /example: these answer before sign-in.
export const dynamicParams = false;

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...GUIDES, ...TOPICS].map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const guide = getGuide(slug) ?? getTopic(slug);
  if (!guide) return {};
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: `/guides/${guide.slug}` },
    // Setting openGraph here replaces the root one, file-based share image included,
    // so the image is named again rather than inherited.
    openGraph: {
      type: "article",
      siteName: "Clariti",
      title: guide.metaTitle,
      description: guide.metaDescription,
      url: `/guides/${guide.slug}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Clariti — understand your health documents" }],
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const slug = (await params).slug;
  const topic = getTopic(slug);
  if (topic) return <TopicArticle topic={topic} appUrl={appUrl} />;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const url = `${appUrl}/guides/${guide.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.h1,
      description: guide.metaDescription,
      url,
      mainEntityOfPage: url,
      publisher: { "@id": "https://zapxlabs.com/#organization", "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
      about: { "@id": `${appUrl}/#app` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Clariti", item: `${appUrl}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${appUrl}/guides` },
        { "@type": "ListItem", position: 3, name: guide.metaTitle, item: url },
      ],
    },
  ];
  const related = guide.related.map((other) => getGuide(other) ?? getTopic(other)).filter((g) => g !== undefined);

  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="guide-page">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/guides">Guides</Link> <span aria-hidden="true">/</span> <span>{guide.kicker.toLowerCase()}</span>
        </nav>
        <p className="clariti-kicker">{guide.kicker}</p>
        <h1>{guide.h1}</h1>
        {guide.intro.map((paragraph) => (
          <p className="guide-lead" key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <ToolPromo slug={guide.slug} />

        <h2>{guide.partsHeading}</h2>
        <dl className="guide-parts">
          {guide.parts.map((part) => (
            <div key={part.term}>
              <dt>{part.term}</dt>
              <dd>{part.meaning}</dd>
            </div>
          ))}
        </dl>

        <h2>{guide.example.heading}</h2>
        <figure className="guide-example">
          <figcaption>{guide.example.caption}</figcaption>
          <table>
            <thead>
              <tr>
                <th scope="col">On the document</th>
                <th scope="col">Shows</th>
                <th scope="col">In plain language</th>
              </tr>
            </thead>
            <tbody>
              {guide.example.rows.map((row, index) => (
                <tr key={`${row.label}-${index}`}>
                  <th scope="row">{row.label}</th>
                  <td className="guide-example-value">{row.value}</td>
                  <td>{row.reading}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="guide-example-takeaway">{guide.example.takeaway}</p>
        </figure>

        <h2>What to check</h2>
        <ul className="guide-checks">
          {guide.checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>

        <h2>Questions worth asking</h2>
        {guide.questions.map((group) => (
          <section key={group.who} className="guide-questions">
            <h3>{group.who}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <aside className="guide-help" role="note">
          <ShieldCheck aria-hidden="true" />
          <p>{guide.getHelp}</p>
        </aside>

        <GuideCta prompt={guide.ctaPrompt} />

        <h2>Common questions</h2>
        <dl className="guide-faq">
          {guide.faqs.map((faq) => (
            <div key={faq.question}>
              <dt>{faq.question}</dt>
              <dd>{faq.answer}</dd>
            </div>
          ))}
        </dl>

        {related.length > 0 && (
          <>
            <h2>Related guides</h2>
            <ul className="guide-related">
              {related.map((other) => (
                <li key={other.slug}>
                  <Link href={`/guides/${other.slug}`}>{other.metaTitle}</Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <GuideFoot invented />
      </article>
    </ClaritiShell>
  );
}
