import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";
import { getGuide } from "@/lib/content/guides";
import { RADILY_PHRASES_URL } from "@/lib/content/guide-links";
import { getTopic, type TopicGuide } from "@/lib/content/topics";
import { GuideCta, GuideFoot } from "../guide-parts";

// One question, answered: the second-wave layout for lib/content/topics.ts.
// Order follows the Radily phrase pages — the direct answer first, then why it
// confuses people, how to read it, and the misreadings — so the snippet a search
// engine lifts is the first paragraph and the page still earns the click.

export function TopicArticle({ topic, appUrl }: { topic: TopicGuide; appUrl: string }) {
  const url = `${appUrl}/guides/${topic.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: topic.h1,
      description: topic.metaDescription,
      url,
      mainEntityOfPage: url,
      publisher: { "@id": "https://zapxlabs.com/#organization", "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
      about: { "@id": `${appUrl}/#app` },
      citation: topic.sources.map((source) => source.url),
    },
    {
      // Built from the FAQ list rendered below, word for word.
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: topic.faqs.map((faq) => ({
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
        { "@type": "ListItem", position: 3, name: topic.metaTitle, item: url },
      ],
    },
  ];
  const related = topic.related.map((slug) => getTopic(slug) ?? getGuide(slug)).filter((g) => g !== undefined);

  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="guide-page">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/guides">Guides</Link> <span aria-hidden="true">/</span> <span>{topic.kicker.toLowerCase()}</span>
        </nav>
        <p className="clariti-kicker">{topic.kicker}</p>
        <h1>{topic.h1}</h1>
        <p className="guide-answer">{topic.answer}</p>

        <h2>Why it’s confusing</h2>
        {topic.why.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}

        <h2>How to read it</h2>
        {topic.reading.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}

        {topic.example && (
          <figure className="guide-example">
            <figcaption>{topic.example.caption}</figcaption>
            <table>
              <thead>
                <tr>
                  <th scope="col">On the document</th>
                  <th scope="col">Shows</th>
                  <th scope="col">In plain language</th>
                </tr>
              </thead>
              <tbody>
                {topic.example.rows.map((row, index) => (
                  <tr key={`${row.label}-${index}`}>
                    <th scope="row">{row.label}</th>
                    <td className="guide-example-value">{row.value}</td>
                    <td>{row.reading}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="guide-example-takeaway">{topic.example.takeaway}</p>
          </figure>
        )}

        <h2>What it does not mean</h2>
        <ul className="guide-checks">
          {topic.notMean.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Where you’ll see it</h2>
        <ul className="guide-checks">
          {topic.whereSeen.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Questions worth asking</h2>
        {topic.questions.map((group) => (
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
          <p>{topic.clariti}</p>
        </aside>

        <GuideCta prompt={topic.ctaPrompt} />

        <h2>Common questions</h2>
        <dl className="guide-faq">
          {topic.faqs.map((faq) => (
            <div key={faq.question}>
              <dt>{faq.question}</dt>
              <dd>{faq.answer}</dd>
            </div>
          ))}
        </dl>

        <h2>Sources</h2>
        <ul className="guide-related">
          {topic.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener" target="_blank">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        {(topic.category === "labs" || topic.category === "hospital") && (
          <p className="guide-aside">
            Reading a scan report rather than a blood test or letter? Radily’s{" "}
            <a href={RADILY_PHRASES_URL}>radiology report phrase guides</a> explain the wording radiologists use.
          </p>
        )}

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

        <GuideFoot invented={Boolean(topic.example)} />
      </article>
    </ClaritiShell>
  );
}
