import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES, GUIDE_CATEGORIES } from "@/lib/guides";
import { GuideChrome, GuideDisclaimer } from "./guide-chrome";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

const title = "Guides: following through after the appointment";
const description =
  "Practical guides on remembering medicines, preparing for appointments, tracking symptoms, recovering at home and checking on someone you care for.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides" },
  openGraph: { url: "/guides", title, description, type: "website" },
};

export default function GuidesIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${appUrl}/guides#page`,
        url: `${appUrl}/guides`,
        name: title,
        description,
        isPartOf: { "@id": "https://usenura.app/#website" },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: GUIDES.map((guide, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${appUrl}/guides/${guide.slug}`,
            name: guide.question,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${appUrl}/guides` },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="guides_index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <span>Guides</span>
        </nav>
        <span className="guide-kicker">Guides</span>
        <h1>Following through after the appointment</h1>
        <p className="guide-lead">
          Most care happens between visits, and it&apos;s carried by you and the people around you. These guides cover
          the practical part: remembering medicines, getting the most from appointments, keeping track of symptoms,
          recovering at home, and checking on someone you care for.
        </p>

        {GUIDE_CATEGORIES.map((category) => {
          const guides = GUIDES.filter((guide) => guide.category === category.id);
          if (guides.length === 0) return null;
          return (
            <section key={category.id} className="guide-index-group" aria-labelledby={`cat-${category.id}`}>
              <h2 id={`cat-${category.id}`}>{category.label}</h2>
              <ul className="guide-index-list">
                {guides.map((guide) => (
                  <li key={guide.slug}>
                    <Link href={`/guides/${guide.slug}`}>
                      <b>{guide.question}</b>
                      <small>{guide.description}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <GuideDisclaimer />
      </main>
    </GuideChrome>
  );
}
