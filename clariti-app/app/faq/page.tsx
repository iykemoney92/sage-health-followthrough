import type { Metadata } from "next";
import Link from "next/link";
import { ClaritiShell } from "@/components/clariti-shell";
import { ALL_FAQS, FAQ_GROUPS } from "@/lib/content/faq";
import { SHOT_BILL_NEXT_STEPS } from "@/lib/content/guide-shots";
import { GuideCta, GuideFoot } from "../guides/guide-parts";
import "../guides/guides.css";

// Public, like /guides and /example: not in PROTECTED_PREFIXES in proxy.ts.
export const dynamic = "force-static";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

export const metadata: Metadata = {
  title: "FAQ: price, privacy and how Clariti works",
  description:
    "Answers about Clariti: what documents it explains, what’s free, Clariti Plus and cancelling, privacy and AI, and the iPhone, Android and web apps.",
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    siteName: "Clariti",
    title: "FAQ: price, privacy and how Clariti works",
    description: "What Clariti explains, what’s free, how Plus and cancelling work, and what happens to your documents.",
    url: "/faq",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Clariti — understand your health documents" }],
  },
};

export default function FaqPage() {
  const url = `${appUrl}/faq`;
  const jsonLd = [
    {
      // Word for word the questions and answers rendered below.
      "@context": "https://schema.org",
      "@type": "FAQPage",
      url,
      mainEntity: ALL_FAQS.map((faq) => ({
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
        { "@type": "ListItem", position: 2, name: "FAQ", item: url },
      ],
    },
  ];

  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="guide-page">
        <p className="clariti-kicker">FREQUENTLY ASKED QUESTIONS</p>
        <h1>Clariti questions, answered</h1>
        <p className="guide-lead">
          Clariti explains medical bills, insurance EOBs, lab results and other health paperwork in plain language. Here is
          what it does and doesn’t do, what’s free, how Clariti Plus works, and what happens to your documents.
        </p>
        <nav aria-label="FAQ sections">
          <ul className="guide-related">
            {FAQ_GROUPS.map((group) => (
              <li key={group.id}>
                <a href={`#${group.id}`}>{group.heading}</a>
              </li>
            ))}
          </ul>
        </nav>

        {FAQ_GROUPS.map((group, index) => (
          <section key={group.id} id={group.id} aria-labelledby={`faq-${group.id}`}>
            <h2 id={`faq-${group.id}`}>{group.heading}</h2>
            <dl className="guide-faq">
              {group.items.map((faq) => (
                <div key={faq.question}>
                  <dt>{faq.question}</dt>
                  <dd>
                    {faq.answer}
                    {faq.link && (
                      <>
                        {" "}
                        <Link href={faq.link.href}>{faq.link.label} →</Link>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {index === 1 && (
              <GuideCta
                prompt="Got a bill, EOB or result you can’t follow? Attach it or take a photo, and Clariti will explain it in plain language."
                teaser={SHOT_BILL_NEXT_STEPS}
              />
            )}
          </section>
        ))}

        <h2>More help</h2>
        <ul className="guide-related">
          <li>
            <Link href="/guides">Guides to bills, EOBs, billing codes and lab results</Link>
          </li>
          <li>
            <Link href="/tools/eob-decoder">Free EOB decoder</Link>
          </li>
          <li>
            <Link href="/example">An example analysis</Link>
          </li>
          <li>
            <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms</Link>
          </li>
        </ul>

        <GuideFoot invented={false} />
      </article>
    </ClaritiShell>
  );
}
