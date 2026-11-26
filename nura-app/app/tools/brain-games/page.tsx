import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { getGuide } from "@/lib/guides";
import { BRAIN_GAMES_TOOL, toolSignupHref } from "@/lib/tools";
import { GuideChrome, GuideDisclaimer } from "../../guides/guide-chrome";
import { BrainGames } from "./brain-games";
import "../tools-large.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";
const path = `/tools/${BRAIN_GAMES_TOOL.slug}`;
const url = `${appUrl}${path}`;

// The layout adds " · Nura".
const title = "Free brain games for older adults: daily puzzles";
const description =
  "Free brain games for older adults: memory match, a daily word puzzle and number games. Large text, no timer unless you want one, no sign-up.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { url: path, title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const NHS_SOURCE = {
  label: "NHS: Alzheimer's disease, prevention",
  url: "https://www.nhs.uk/conditions/alzheimers-disease/prevention/",
};
const CHECKED = "checked 26 November 2026";

const FAQS = [
  {
    q: "Are these brain games free?",
    a: "Yes. There's no sign-up, no charge and nothing to download. They work in any modern web browser on a phone, tablet or computer.",
  },
  {
    q: "Is there a time limit?",
    a: "No. None of the games is timed. If you like to see how long you take, tick \"Show a timer\"; it only counts up and never ends a game.",
  },
  {
    q: "How does the daily word puzzle work?",
    a: "You get seven letters each day. Make words of three letters or more, each using the centre letter, with each letter used once per word. One word uses all seven. Everyone gets the same puzzle on the same day, and a new one starts at midnight.",
  },
  {
    q: "Do brain games prevent dementia?",
    a: "These games are for enjoyment, and we make no health claims for them. The NHS says there's no certain way to prevent Alzheimer's disease, though there's some evidence that rates of dementia are lower in people who stay mentally and socially active. If you're worried about memory, speak to a GP.",
  },
  {
    q: "Where is my streak saved?",
    a: "In this browser's local storage, on this device only. Nothing is sent to us. Clearing your browser data, or using a private window, resets it.",
  },
];

const RELATED = [
  "daily-routine-for-elderly-parents",
  "how-to-help-a-lonely-elderly-parent",
  "ai-companion-for-older-adults-living-alone",
  "how-to-check-on-an-elderly-parent-who-lives-alone",
]
  .map((slug) => getGuide(slug))
  .filter((g) => g !== null);

export default function BrainGamesPage() {
  const signupHref = toolSignupHref(BRAIN_GAMES_TOOL);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        url,
        name: "Brain games for older adults",
        description,
        applicationCategory: "GameApplication",
        operatingSystem: "Any (runs in a web browser)",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
        publisher: { "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
        isPartOf: { "@id": "https://usenura.app/#website" },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "Free tools", item: `${appUrl}/tools` },
          { "@type": "ListItem", position: 3, name: "Brain games", item: url },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="tool" signupHref={signupHref}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main tool-main tool-large">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <Link href="/tools">Free tools</Link>
          <span aria-hidden="true">/</span>
          <span>Brain games</span>
        </nav>

        <span className="guide-kicker">Free games</span>
        <h1>Free brain games for older adults</h1>
        <p className="guide-lead">
          Three gentle games to enjoy with a cup of tea: a memory match with everyday pictures, a new word puzzle every
          day, and number games at three levels. Large text, big buttons, no timer unless you want one, and no sign-up.
        </p>

        <div className="tool-app">
          <BrainGames />
        </div>

        <article>
          <section className="guide-section">
            <h2>How to play</h2>
            <ol className="guide-steps">
              <li>
                <h3>Memory match</h3>
                <p>
                  Tap a card to turn it over, then tap another to find its pair. If they don&apos;t match, they stay
                  face up until your next tap, so there&apos;s no rush to remember them. Choose 6, 8 or 12 pairs.
                </p>
              </li>
              <li>
                <h3>Daily word puzzle</h3>
                <p>
                  Make words from the seven letters, each including the centre letter. Type them, or tap the letters.
                  Our word list is short and simple, so a real word may be missing; that doesn&apos;t mean it&apos;s
                  wrong.
                </p>
              </li>
              <li>
                <h3>Number games</h3>
                <p>
                  Ten questions a round, with four answers to choose from. Level 1 is adding and taking away up to 20,
                  level 2 has bigger sums and times tables, and level 3 asks what comes next in a sequence.
                </p>
              </li>
              <li>
                <h3>Keep a streak, if you like</h3>
                <p>
                  Play any game on a day and it counts towards your streak. It&apos;s kept in this browser only, and
                  missing a day simply starts a new one.
                </p>
              </li>
            </ol>
          </section>

          <section className="guide-section">
            <h2>Made to be easy to use</h2>
            <ul className="tool-tips">
              <li>Large text and buttons, with strong contrast.</li>
              <li>Works with a mouse, a keyboard (Tab, Enter and the arrow keys) or a touch screen.</li>
              <li>No sound, no flashing and no countdowns; movement is switched off if your device asks for less.</li>
              <li>No adverts, no account and no downloads.</li>
            </ul>
          </section>

          <section className="guide-section">
            <h2>About keeping your mind active</h2>
            <p>
              We made these games to be enjoyable, and we don&apos;t claim they improve memory or prevent any
              condition. The NHS says &quot;there&apos;s no certain way to prevent&quot; Alzheimer&apos;s disease, and
              that &quot;there&apos;s some evidence to suggest that rates of dementia are lower in people who remain
              mentally and socially active&quot;. Its examples include reading, learning a language, playing music,
              volunteering, group sports and keeping up a social life, so a puzzle shared with someone is a nice
              way to play. If you&apos;re worried about your memory, or someone else&apos;s, talk to a GP.
            </p>
          </section>

          <section className="guide-nura" aria-labelledby="tool-nura-heading">
            <h2 id="tool-nura-heading">A companion that checks in each day</h2>
            <p>
              A daily puzzle is a good habit; so is a daily hello. Nura is an AI wellbeing companion that checks in by
              message, WhatsApp or a short phone call at times you choose, and remembers what you said mattered, from
              sleep and routines to the people you look out for. If you have an older parent who lives alone, Nura can
              give them a short call now and then, with their agreement, on their ordinary phone, and send you a
              summary of each call.
            </p>
            <div className="guide-nura-actions">
              <TrackedLink
                href={signupHref}
                className="guide-button"
                event="tool_cta_click"
                eventParams={{ tool: BRAIN_GAMES_TOOL.slug, cta: "get_started", placement: "tool_body" }}
              >
                Try Nura <ArrowRight size={16} aria-hidden="true" />
              </TrackedLink>
              <StoreBadges placement="tool_body" compact utmContent={`tool-${BRAIN_GAMES_TOOL.slug}`} />
            </div>
          </section>

          <section className="guide-section guide-faq">
            <h2>Common questions</h2>
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </section>

          <section className="guide-section guide-sources">
            <h2>Sources</h2>
            <ul>
              <li>
                <a href={NHS_SOURCE.url} target="_blank" rel="noopener noreferrer">
                  {NHS_SOURCE.label}
                </a>{" "}
                ({CHECKED})
              </li>
            </ul>
          </section>

          <GuideDisclaimer />
        </article>

        <section className="guide-section" aria-labelledby="tool-related-heading">
          <h2 id="tool-related-heading">Related guides</h2>
          <ul className="guide-related">
            {RELATED.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/guides/${guide.slug}`}>
                  <b>{guide.question}</b>
                  <small>{guide.description}</small>
                </Link>
              </li>
            ))}
          </ul>
          <p className="guide-all">
            <Link href="/tools">All free tools →</Link>
          </p>
        </section>
      </main>
    </GuideChrome>
  );
}
