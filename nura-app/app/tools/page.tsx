import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";
import { GuideChrome, GuideDisclaimer } from "../guides/guide-chrome";
import "./tools-large.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";
const path = "/tools";
const HUB_SIGNUP_HREF = "/signup?utm_source=site&utm_medium=web&utm_campaign=nura_nov26&utm_content=tools-hub";

const title = "Free tools: scam checker, brain games, medicine chart";
const description =
  "Free tools from Nura that run in your browser with no sign-up: a scam message checker, brain games for older adults and a printable medicine schedule.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { url: path, title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ToolsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${appUrl}${path}#page`,
        url: `${appUrl}${path}`,
        name: "Free tools from Nura",
        description,
        isPartOf: { "@id": "https://usenura.app/#website" },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: TOOLS.map((tool, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: tool.name,
            url: `${appUrl}/tools/${tool.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "Free tools", item: `${appUrl}${path}` },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="tool" signupHref={HUB_SIGNUP_HREF}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main tool-main tool-large">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <span>Free tools</span>
        </nav>

        <span className="guide-kicker">Free tools</span>
        <h1>Free tools from Nura</h1>
        <p className="guide-lead">
          Small, useful tools that run in your browser. They&apos;re free, there&apos;s no sign-up, and what you type
          stays on your device.
        </p>

        <section className="guide-section" aria-label="Tools">
          <ul className="guide-related">
            {TOOLS.map((tool) => (
              <li key={tool.slug}>
                <Link href={`/tools/${tool.slug}`}>
                  <b>{tool.name}</b>
                  <small>{tool.blurb}</small>
                </Link>
              </li>
            ))}
          </ul>
          <p className="guide-all">
            <Link href="/guides">Read our guides →</Link>
          </p>
        </section>

        <GuideDisclaimer />
      </main>
    </GuideChrome>
  );
}
