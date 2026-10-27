import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { getGuide } from "@/lib/guides";
import { SRC } from "@/lib/guides/sources";
import { MEDICINE_SCHEDULE_TOOL, toolSignupHref } from "@/lib/tools";
import { GuideChrome, GuideDisclaimer } from "../../guides/guide-chrome";
import { ScheduleMaker } from "./schedule-maker";
import "./schedule.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";
const path = `/tools/${MEDICINE_SCHEDULE_TOOL.slug}`;
const url = `${appUrl}${path}`;

const title = "Free printable medicine schedule maker";
const description =
  "Make a free printable weekly medicine chart: add each medicine, dose and time, then print tick boxes on A4 or US Letter. Nothing is uploaded.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { url: path, title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

/** Sources for the general tips on this page, each opened and read on the date shown. */
const SOURCES = [SRC.medicinesForCarers, SRC.whatToAsk, SRC.repeatPrescription, SRC.pharmacies, SRC.medicinesAZ];
const CHECKED = "checked 27 Oct 2026";

const FAQS = [
  {
    q: "Is the medicine schedule maker free?",
    a: "Yes. There is no sign-up and no charge, and it works in any modern browser on a phone, tablet or computer.",
  },
  {
    q: "Is what I type uploaded anywhere?",
    a: "No. The chart is built in your browser. If you leave \"Keep a copy in this browser\" ticked, it is saved in this browser's local storage on this device only, so it's there next time; untick it or press Clear everything to remove it.",
  },
  {
    q: "How do I save the chart as a PDF?",
    a: "Press Print or save as PDF, then choose \"Save as PDF\" (or \"Microsoft Print to PDF\") as the printer in the print window. On an iPhone, use the share button in the print preview to save it to Files.",
  },
  {
    q: "Will it tell me when to take my medicines?",
    a: "No. It only lays out what you enter. When and how to take a medicine comes from your prescriber, your pharmacist and the leaflet in the box, and the chart should copy what they say.",
  },
  {
    q: "Can I make a chart for someone I care for?",
    a: "Yes. Put their name in \"Who is the chart for?\" and it becomes the heading, such as \"Mum's medicines\". The NHS reminds carers that the person decides how much of their medicines information is shared, so make it with them.",
  },
  {
    q: "Why is my chart split over two pages?",
    a: "Long lists don't fit on one sheet. Try Landscape, fewer blank rows, or turn off headers and footers and set the scale to fit in your browser's print settings. The column headings repeat on each page.",
  },
];

const RELATED = [
  "how-to-remember-to-take-medication",
  "how-to-keep-a-list-of-your-medications",
  "missed-a-dose-of-medication-what-to-do",
  "medication-reminder-for-elderly-parent",
]
  .map((slug) => getGuide(slug))
  .filter((g) => g !== null);

export default function MedicineSchedulePage() {
  const signupHref = toolSignupHref(MEDICINE_SCHEDULE_TOOL);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        url,
        name: "Medicine schedule maker",
        description,
        applicationCategory: "UtilitiesApplication",
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
          { "@type": "ListItem", position: 2, name: "Medicine schedule maker", item: url },
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
      <main className="guide-main tool-main">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <span>Medicine schedule maker</span>
        </nav>

        <span className="guide-kicker">Free tool</span>
        <h1>Printable medicine schedule maker</h1>
        <p className="guide-lead">
          Add each medicine, the dose and when it&apos;s taken, and get a weekly chart with a tick box for every dose.
          Print it for the fridge or save it as a PDF. Free, with no sign-up, and nothing you type is uploaded.
        </p>
        <p className="tool-safety">
          This is a personal reminder chart, not medical advice; follow your prescriber or pharmacist.
        </p>

        <div className="tool-app ph-mask ph-sensitive">
          <ScheduleMaker />
        </div>

        <section className="guide-nura" aria-labelledby="tool-nura-heading">
          <h2 id="tool-nura-heading">Want a reminder that checks back?</h2>
          <p>
            A paper chart works when you look at it. Nura is for the days you don&apos;t: tell it something like
            &quot;remind me every morning to take my tablets&quot; and it sets up a repeating check-in, daily, on
            weekdays or weekly, by phone call, WhatsApp or in the app. It asks whether you&apos;ve taken it rather than
            just announcing the time, notes a missed dose, and points you to the leaflet or your pharmacist instead of
            telling you what to do. You can also keep your medicines list under Health information in the app.
          </p>
          <div className="guide-nura-actions">
            <TrackedLink
              href={signupHref}
              className="guide-button"
              event="tool_cta_click"
              eventParams={{ tool: MEDICINE_SCHEDULE_TOOL.slug, cta: "get_started", placement: "tool_body" }}
            >
              Try Nura <ArrowRight size={16} aria-hidden="true" />
            </TrackedLink>
            <StoreBadges placement="tool_body" compact utmContent={`tool-${MEDICINE_SCHEDULE_TOOL.slug}`} />
          </div>
        </section>

        <article>
          <section className="guide-section">
            <h2>How to use it</h2>
            <ol className="guide-steps">
              <li>
                <h3>Copy each medicine from the label</h3>
                <p>
                  Type the name and dose exactly as the pharmacy label or prescription says, not from memory. Include
                  inhalers, creams, drops and anything bought over the counter if you want to tick those off too.
                </p>
              </li>
              <li>
                <h3>Pick when it&apos;s taken</h3>
                <p>
                  Tick morning, midday, evening or bedtime, or add set times such as 08:00 and 20:00. A medicine taken
                  twice a day gets a row for each time, so every dose has its own box.
                </p>
              </li>
              <li>
                <h3>Choose the days</h3>
                <p>
                  Every day is the default. For a medicine taken on some days only, untick the others: those squares
                  are shaded on the chart so there&apos;s nothing to tick by mistake.
                </p>
              </li>
              <li>
                <h3>Add a short note</h3>
                <p>
                  Use it for instructions from the label, such as &quot;with food&quot; or &quot;30 minutes before
                  breakfast&quot;. The NHS notes that taking a medicine at the wrong time, or without food when it
                  should be taken with it, can stop it working properly or cause side effects.
                </p>
              </li>
              <li>
                <h3>Print or save it</h3>
                <p>
                  Choose A4 or US Letter and landscape or portrait, add a few blank rows for anything new, then press
                  Print or save as PDF. Add a start date if you want each column dated; leave it empty to reuse the
                  chart every week.
                </p>
              </li>
            </ol>
          </section>

          <section className="guide-section">
            <h2>How the chart is laid out</h2>
            <p>
              Rows run through the day: set times are placed in clock order, and morning, midday, evening and bedtime
              sit where you would expect them among those times. Medicines taken at the same time are grouped under one
              heading, in the order you added them, so the morning round reads as one block. Each row shows the
              medicine, the dose and your note, then one square per day. The chart never adds a time, a dose or an
              instruction you didn&apos;t type, and it has no drug information, so it can&apos;t check doses or
              whether medicines mix. That is a question for a pharmacist.
            </p>
          </section>

          <section className="guide-section">
            <h2>Tips for keeping a medicine chart useful</h2>
            <ul className="tool-tips">
              <li>
                <b>Keep it up to date.</b> When a dose changes or a medicine stops, update the chart the same day. The
                NHS suggests bringing a list of all your medicines, including vitamins and supplements, to
                appointments; printing this chart before one does that job.
              </li>
              <li>
                <b>Keep medicines in one place.</b> The NHS recommends one place in the home, preferably a locked
                cupboard or drawer if children live in or visit the house. Put the chart next to it.
              </li>
              <li>
                <b>Ask about other reminders.</b> For a complicated routine, a pharmacist may provide a compartment
                (dosette) box. The NHS notes these are not always free and do not suit every medicine.
              </li>
              <li>
                <b>Ask for a review.</b> If you take several medicines, your GP surgery may offer a free structured
                medication review with a pharmacist.
              </li>
              <li>
                <b>Don&apos;t run out.</b> The NHS says to request a repeat prescription up to 5 working days before you
                need it.
              </li>
              <li>
                <b>If a box is missed,</b> check the leaflet or ask a pharmacist. The NHS warns that taking a double
                dose later to make up for a missed one is dangerous. Each medicine&apos;s page in the NHS medicines A to
                Z covers what to do if you forget a dose.
              </li>
            </ul>
          </section>

          <section className="guide-section">
            <h2>What happens to what you type</h2>
            <p>
              Nothing leaves your device. The chart is made by this page in your browser; there is no account and no
              server step. If &quot;Keep a copy in this browser&quot; is ticked, the chart is stored in this
              browser&apos;s local storage so it&apos;s there when you come back, and only on this device. On a shared
              or public computer, untick it, or press Clear everything when you&apos;re done. If your browser blocks
              storage (some private windows do), the tool still works; it just won&apos;t remember the chart.
            </p>
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
              {SOURCES.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>{" "}
                  ({CHECKED})
                </li>
              ))}
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
            <Link href="/guides">All guides →</Link>
          </p>
        </section>
      </main>
    </GuideChrome>
  );
}
