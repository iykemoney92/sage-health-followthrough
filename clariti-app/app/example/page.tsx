import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, ShieldAlert } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";
import { FlagCard } from "@/components/clariti/flag-card";
import { KeyPointList } from "@/components/clariti/key-point-list";
import { claritiAnalysisSchema, type ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import { flagSeverityToToken, type ClaritiFlagSeverity, type ClaritiSeverityToken } from "@/lib/domain/clariti-severity";
// @ts-expect-error — plain ESM script, deliberately not TypeScript, imported here
// only for its fixture. Its seeding half is behind an import.meta.url guard and
// does not run on import, which lib/domain/clariti-review-fixture.test.ts relies
// on in exactly the same way.
import { ANALYSIS, DOCUMENT_TEXT, DOCUMENT_TITLE } from "../../scripts/seed-review-account.mjs";
import "../example.css";

/**
 * /example — the one screen in Clariti that costs a visitor nothing.
 *
 * Every starter on the landing page asks for an upload first, so the product was
 * asking a frightened stranger to hand over a document carrying their name, their
 * diagnosis and their account number before showing them a single thing it does.
 * This is the thing it does, up front, for free.
 *
 * The analysis below is the App Review fixture — the same one the demo account is
 * seeded with — rendered through the same components the workspace canvas uses, so
 * a visitor is looking at the real screen and not a marketing mock-up of it. Two
 * things about it have to be said out loud rather than implied, and the banner says
 * both: the document is invented, and the explanation was written by hand against
 * the live schema rather than generated while you wait. A health product showing a
 * fabricated report dressed as a live one is its own kind of dishonesty.
 *
 * No database, no session, no network: a signed-out stranger is the entire audience.
 */

// Not added to PROTECTED_PREFIXES in proxy.ts, and never should be. The whole
// point of this page is that it answers before anyone signs in.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "An example analysis",
  description:
    "See what Clariti gives back before you upload anything of your own: a finished analysis of an invented MRI report, rendered exactly as a real one is.",
};

/**
 * Held to the same contract the live analyser produces, at the same moment the page
 * renders. If the schema moves and the fixture does not follow, this page says so
 * instead of drawing half a screen — the same instinct as the degraded-analysis band
 * in the workspace, and the same reason clariti-review-fixture.test.ts exists.
 */
const parsedFixture = claritiAnalysisSchema.safeParse(ANALYSIS);

/** The question the seeded demo session opens with, quoted so the answer has something to be an answer to. */
const ASKED = "Can you explain what this MRI report actually says?";

export default function ExamplePage() {
  if (!parsedFixture.success) return <ExampleUnavailable />;

  const analysis: ClaritiAnalysis = parsedFixture.data;
  const meta = getClaritiKindMeta(analysis.kind);
  const concernMetric = analysis.metrics[1] ?? analysis.metrics[0];
  const heroToken = worstFlagSeverityToken(analysis.flags);

  return (
    <ClaritiShell>
      <section className="example-page">
        {/* Top of the page, before the analysis, and repeated in plain words at the
            bottom. Somebody who lands here mid-scroll from a search result must not
            be able to mistake this for a person's report. */}
        <aside className="example-banner" role="note">
          <span className="example-banner-icon" aria-hidden="true"><ShieldAlert /></span>
          <div className="example-banner-body">
            <p className="example-banner-label">An example — nobody&apos;s real report</p>
            <p>
              The lumbar-spine MRI on this page was invented. There is no patient, no account, and nothing here
              belongs to anyone — it is the same sample Apple&apos;s App Review team is given.
            </p>
            <p>
              The explanation was written out in full rather than generated while you wait, and it is held to the
              same contract a live analysis has to pass: same fields, same source lines, same screen. Your own
              document comes back looking like this.
            </p>
          </div>
        </aside>

        <header className="example-head">
          <p className="clariti-kicker">{meta.eyebrow}</p>
          <h1>{analysis.title}</h1>
          <p className="example-asked">Asked: &ldquo;{ASKED}&rdquo;</p>
        </header>

        {/* The three canvas tabs, stacked. A read-only page has nothing to gain from
            hiding two thirds of the answer behind controls, and a tab strip that did
            not move would be worse than none. Everything inside each block is the
            workspace canvas markup, unchanged. */}
        <section className="example-section" aria-labelledby="example-summary">
          <h2 className="example-section-label" id="example-summary">Summary</h2>
          <div className="canvas-content canvas-family-clinical_report">
            <section className="report-hero radiology-hero">
              <div>
                <span className="result-label">OVERALL TAKEAWAY</span>
                <h3>{analysis.summary}</h3>
                <p>{analysis.plainEnglish}</p>
              </div>
              {/* Derived from the flags, defaulting to neutral — never a green
                  all-clear printed over a report nobody has read. */}
              <span className={`risk-pill sev-${heroToken}`}>{concernMetric?.value ?? "Review"}</span>
            </section>

            <section className="impression-stats">
              <div><strong>{analysis.keyPoints.length}</strong><span>Key points</span></div>
              <div><strong>{analysis.metrics[0]?.value ?? "Report"}</strong><span>{analysis.metrics[0]?.label ?? "Document"}</span></div>
              <div><strong>{concernMetric?.value ?? "Ask"}</strong><span>{concernMetric?.label ?? "Ask your clinician"}</span></div>
            </section>

            <KeyPointList points={analysis.keyPoints} variant="list" />

            {analysis.flags.map((flag) => <FlagCard flag={flag} key={flag.label} />)}
          </div>
        </section>

        <section className="example-section" aria-labelledby="example-detail">
          <h2 className="example-section-label" id="example-detail">{meta.detailTab}</h2>
          <div className="canvas-content">
            <section className="canvas-card">
              <h3>{meta.detailHeading}</h3>
              <KeyPointList points={analysis.keyPoints} variant="row" />
            </section>

            <section className="canvas-card meta-card">
              <h3>Where this came from</h3>
              {analysis.sourceAnchors.map((anchor) => (
                <div className="meta-row" key={anchor}><span>Source</span><b>{anchor}</b></div>
              ))}
              {/* In the workspace this button opens the original file in a sheet. There
                  is no file here, so it jumps to the document printed further down —
                  which is the more useful version anyway: the source is on the page and
                  every quote above can be checked against it. */}
              <a className="meta-link-btn example-meta-link" href="#example-document">
                <FileText />Read the document these came from
              </a>
            </section>
          </div>
        </section>

        <section className="example-section" aria-labelledby="example-actions">
          <h2 className="example-section-label" id="example-actions">Next steps</h2>
          <div className="canvas-content">
            <section className="canvas-card">
              <h3>Suggested next steps</h3>
              <ol className="action-list">
                {analysis.nextActions.map((item, index) => (
                  <li key={item}>
                    <span>{index + 1}</span>
                    <p><b>{item}</b><small>Clariti can turn this into an email check-in or a concise question list.</small></p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="canvas-card">
              <h3>Questions worth asking</h3>
              <ul className="example-questions">
                {analysis.questions.map((question) => <li key={question}>{question}</li>)}
              </ul>
            </section>
          </div>
        </section>

        {/* The boundary, in the analysis's own words and in the same place the canvas
            puts it: last, under everything it qualifies. */}
        <footer className="canvas-footer">{analysis.safetyNote}</footer>

        <section className="canvas-card example-document" id="example-document" aria-labelledby="example-document-title">
          <h3 id="example-document-title">The document Clariti read</h3>
          <p className="example-document-note">
            Invented for this page, start to finish. &ldquo;Alex Sample&rdquo; is not a person and MRN 000-DEMO is not a
            record number. Every quote above is in the text below — that is what the source lines are for.
          </p>
          <pre className="example-document-text">{String(DOCUMENT_TEXT)}</pre>
          <p className="example-document-name">{String(DOCUMENT_TITLE)}</p>
        </section>

        <section className="example-omissions" aria-labelledby="example-omissions-title">
          <h2 id="example-omissions-title">What this page leaves out</h2>
          <p>
            Everything above is the analysis itself, whole. What is missing is the part that needs an account: the chat
            where you keep asking until it makes sense, the short explainer video and illustrations Clariti builds from
            these same source lines, comparing a newer scan against this one, and the email check-in. Nothing on this
            page sends anything anywhere.
          </p>
        </section>

        <section className="example-outro" aria-labelledby="example-outro-title">
          <h2 id="example-outro-title">Now with the paperwork you actually have</h2>
          <p>
            One document at a time, photographed or pasted. Clariti explains what it says in plain language and helps
            you work out what to ask next — it does not diagnose.
          </p>
          <Link className="example-outro-cta" href="/">Explain my document<ArrowRight /></Link>
          <p className="example-outro-note">
            Before you do: <Link href="/privacy">what happens to a document you upload</Link>.
          </p>
        </section>
      </section>
    </ClaritiShell>
  );
}

/**
 * The fixture stopped parsing. Rather than draw a half-populated canvas of a
 * medical report — the exact failure mode this product is built to avoid — say so
 * and keep the way back open.
 */
function ExampleUnavailable() {
  return (
    <ClaritiShell>
      <section className="example-page">
        <aside className="example-banner" role="note">
          <span className="example-banner-icon" aria-hidden="true"><ShieldAlert /></span>
          <div className="example-banner-body">
            <p className="example-banner-label">The example is not available right now</p>
            <p>
              Clariti could not load its sample analysis, so there is nothing honest to show you here. The product
              itself is unaffected — this page is the only thing that reads the sample.
            </p>
          </div>
        </aside>
        <section className="example-outro" aria-labelledby="example-unavailable-title">
          <h2 id="example-unavailable-title">Bring your own document instead</h2>
          <p>Photograph it or paste the text, and Clariti explains what it says in plain language.</p>
          <Link className="example-outro-cta" href="/">Explain my document<ArrowRight /></Link>
        </section>
      </section>
    </ClaritiShell>
  );
}

/**
 * Copied from the workspace canvas so this page derives the hero pill the same way
 * it does: worst flag wins, and no flags means neutral rather than reassuring.
 * Duplicated rather than imported because app/workspace/page.tsx keeps it private;
 * it belongs in lib/domain/clariti-severity.ts next to flagSeverityToToken, and
 * should move there once both callers can be edited together.
 */
function worstFlagSeverityToken(flags: ClaritiAnalysis["flags"]): ClaritiSeverityToken {
  const rank: Record<ClaritiFlagSeverity, number> = { info: 0, check: 1, urgent: 2 };
  const worst = flags.reduce<ClaritiFlagSeverity | null>(
    (current, flag) => (current === null || rank[flag.severity] > rank[current] ? flag.severity : current),
    null,
  );
  return worst ? flagSeverityToToken(worst) : "neutral";
}
