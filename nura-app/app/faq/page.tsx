import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { FAQ_COUNT, FAQ_GROUPS } from "@/lib/faq";
import { GUIDE_UTM } from "@/lib/guides";
import { GuideChrome } from "../guides/guide-chrome";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

const title = "Nura FAQ: check-ins, care plans, pricing, privacy";
const description =
  "Answers about Nura, the AI health and wellbeing companion: how check-ins work, checking in on a parent, Care plans, Apple Health, privacy, pricing and the free trial.";
const signupHref = `/signup?${GUIDE_UTM.replace("utm_content=guide", "utm_content=faq")}`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/faq" },
  openGraph: { url: "/faq", title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function FaqPage() {
  const url = `${appUrl}/faq`;
  // Built from the same list the page renders, so the structured data matches the visible text.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        name: title,
        mainEntity: FAQ_GROUPS.flatMap((group) =>
          group.items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        ),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "FAQ", item: url },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="faq" signupHref={signupHref} active="faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <span>FAQ</span>
        </nav>
        <span className="guide-kicker">Questions and answers</span>
        <h1>Nura FAQ</h1>
        <p className="guide-lead">
          {FAQ_COUNT} answers about Nura, the AI health and wellbeing companion that checks in on you: how check-ins
          work, checking in on someone you care for, Care plans, your data, and what it costs. For everyday topics like
          sleep, routines and caring for a parent, see the <Link href="/guides">guides</Link>, or watch Nura in a{" "}
          <Link href="/videos">short video</Link>.
        </p>

        <nav className="faq-toc" aria-label="FAQ sections">
          {FAQ_GROUPS.map((group) => (
            <a key={group.id} href={`#${group.id}`}>
              {group.heading}
            </a>
          ))}
        </nav>

        {FAQ_GROUPS.map((group) => (
          <section key={group.id} id={group.id} className="guide-section guide-faq" aria-labelledby={`${group.id}-h`}>
            <h2 id={`${group.id}-h`}>{group.heading}</h2>
            {group.items.map((item) => (
              <div key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </section>
        ))}

        <section className="guide-nura" aria-labelledby="faq-start-heading">
          <h2 id="faq-start-heading">Try Nura</h2>
          <p>
            Tell Nura what&apos;s going on in plain words. It keeps a simple Care plan and checks in at the times that
            suit you. Nura Plus is US$9.99 a month after a 14-day free trial, and you can cancel any time.
          </p>
          <div className="guide-nura-actions">
            <TrackedLink
              href={signupHref}
              className="guide-button"
              event="guide_cta_click"
              eventParams={{ cta: "get_started", placement: "faq_body", guide: "faq" }}
            >
              Get started with Nura <ArrowRight size={16} />
            </TrackedLink>
            <StoreBadges placement="faq_body" compact utmContent="faq" />
          </div>
        </section>
      </main>
    </GuideChrome>
  );
}
