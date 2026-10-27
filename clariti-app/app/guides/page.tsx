import type { Metadata } from "next";
import Link from "next/link";
import { ClaritiShell } from "@/components/clariti-shell";
import { RADILY_PHRASES_URL } from "@/lib/content/guide-links";
import { GUIDES } from "@/lib/content/guides";
import { TOPICS, TOPIC_CATEGORIES } from "@/lib/content/topics";
import { TOOLS } from "@/lib/content/tools";
import "./guides.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

export const metadata: Metadata = {
  title: "Guides to medical bills, EOBs, lab results and discharge summaries",
  description:
    "Plain-language guides to the health paperwork people find hardest to read: EOBs, medical bills and codes, blood test results and hospital letters.",
  alternates: { canonical: "/guides" },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Clariti guides",
    url: `${appUrl}/guides`,
    hasPart: [...GUIDES, ...TOPICS].map((guide) => ({ "@type": "Article", headline: guide.metaTitle, url: `${appUrl}/guides/${guide.slug}` })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Clariti", item: `${appUrl}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${appUrl}/guides` },
    ],
  },
];

export default function GuidesIndex() {
  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="guide-page">
        <p className="clariti-kicker">GUIDES</p>
        <h1>Read your health paperwork with confidence</h1>
        <p className="guide-lead">
          Walkthroughs of whole documents, and answers to the questions people ask with one in their hand.
        </p>

        <section className="guide-index-section" aria-labelledby="guides-tools">
          <h2 id="guides-tools">Free tools</h2>
          <p>Work it out yourself, in your browser, without signing up.</p>
          <ul className="guide-index">
            {TOOLS.map((tool) => (
              <li key={tool.slug}>
                <Link href={`/tools/${tool.slug}`}>
                  <span className="clariti-kicker">FREE TOOL</span>
                  <b>{tool.name}</b>
                  <small>{tool.blurb}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="guide-index-section" aria-labelledby="guides-walkthroughs">
          <h2 id="guides-walkthroughs">Document walkthroughs</h2>
          <p>Each one explains a kind of document line by line, with an invented example and the questions worth asking.</p>
          <GuideList guides={GUIDES} />
        </section>

        {TOPIC_CATEGORIES.map((category) => (
          <section key={category.id} className="guide-index-section" aria-labelledby={`guides-${category.id}`}>
            <h2 id={`guides-${category.id}`}>{category.heading}</h2>
            <p>{category.blurb}</p>
            <GuideList guides={TOPICS.filter((topic) => topic.category === category.id)} />
          </section>
        ))}

        <p className="guide-index-more">
          Looking for the wording on an X-ray, CT, MRI or ultrasound report? Radily’s{" "}
          <a href={RADILY_PHRASES_URL}>radiology report phrase guides</a> cover it. Everything here is general
          information, not medical or financial advice.
        </p>
      </section>
    </ClaritiShell>
  );
}

function GuideList({ guides }: { guides: { slug: string; kicker: string; metaTitle: string; metaDescription: string }[] }) {
  return (
    <ul className="guide-index">
      {guides.map((guide) => (
        <li key={guide.slug}>
          <Link href={`/guides/${guide.slug}`}>
            <span className="clariti-kicker">{guide.kicker}</span>
            <b>{guide.metaTitle}</b>
            <small>{guide.metaDescription}</small>
          </Link>
        </li>
      ))}
    </ul>
  );
}
