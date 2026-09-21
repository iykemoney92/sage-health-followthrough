import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Download } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import {
  resolveConnectionSources,
  type ConnectionMarket,
  type ResolvedConnectionSource,
} from "@/lib/connections/registry";
import "../connections.css";

export const metadata: Metadata = {
  title: "Connect your records",
  description:
    "Every way to get a health document in front of Clariti: photograph the letter in your hand, or download the PDF your health service already holds for you.",
};

// Not added to PROTECTED_PREFIXES in proxy.ts on purpose. Nothing here is
// account data — it is how you get a first document to Clariti, which is
// exactly what somebody who has not signed up yet needs to read.

/** Where a route works, not a connection status: there is no connection to report. */
const MARKET_LABEL: Record<ConnectionMarket, string> = {
  any: "Works everywhere",
  uk: "United Kingdom",
  us: "United States",
};

/**
 * The registry resolves `unconfigured` and `unavailable` sources out of a user
 * audience for us, so nothing on this page is a "coming soon" tile. What is
 * left is what a person can actually do today.
 */
export default function ConnectionsPage() {
  const sources = resolveConnectionSources(process.env);
  const universal = sources.filter((source) => source.transport.via === "upload");
  // On the resolved state, not the transport: a connector whose env is complete
  // resolves to "ready", and filing it under "if your records are somewhere else"
  // would describe a live connection as something the person has to do by hand.
  const guided = sources.filter((source) => source.availability.state === "guided");

  return (
    <ClaritiShell>
      <main className="connections-page">
        <header className="connections-hero">
          <p className="clariti-kicker">YOUR RECORDS</p>
          <h1>Connect your records</h1>
          <p>
            One route works in every country, for everyone, with no account anywhere: put the document in front of
            Clariti. Photograph the letter in your hand, or download the PDF your health service already holds for you
            and bring it here.
          </p>
        </header>

        {universal.map((source) => (
          <section className="connections-primary" key={source.id} aria-labelledby={`connection-${source.id}`}>
            <span className="connections-primary-icon" aria-hidden="true"><Camera /></span>
            <div className="connections-primary-body">
              <p className="connections-region">{MARKET_LABEL[source.market]}</p>
              <h2 id={`connection-${source.id}`}>{source.name}</h2>
              <p className="connections-gives">{source.description}</p>
              <DocumentKinds source={source} />
              <Link className="connections-cta" href="/">Add a document</Link>
            </div>
          </section>
        ))}

        {guided.length > 0 ? (
          <section className="connections-guided" aria-labelledby="connections-guided-title">
            <h2 className="connections-section-title" id="connections-guided-title">
              If your records are already online
            </h2>
            {/* Deliberately vague about which documents: the NHS App will hand over a
                letter but not a test result, and the per-source cards below are where
                that belongs. A lead that promises "letters and results" here would be
                wrong for half the people reading it. */}
            <p className="connections-section-lead">
              Your health service may already hold the document as a file you can download yourself — one of these will
              match where you are treated. Fetching it takes a minute, and it is a complete answer rather than a
              workaround: it is the same document, and Clariti reads it the same way.
            </p>

            <div className="connections-grid">
              {guided.map((source) => (
                <article className="connection-card" key={source.id} aria-labelledby={`connection-${source.id}`}>
                  <div className="connection-card-head">
                    <span className="connection-card-icon" aria-hidden="true"><Download /></span>
                    <div>
                      <p className="connections-region">{MARKET_LABEL[source.market]}</p>
                      <h3 id={`connection-${source.id}`}>{source.name}</h3>
                    </div>
                  </div>

                  <p className="connections-gives">{source.description}</p>
                  <DocumentKinds source={source} />
                  <Steps source={source} />

                  <Link className="connections-card-cta" href="/">Upload what you downloaded</Link>
                </article>
              ))}
            </div>

            {/* The known dead end in the route above: the NHS App shows a test result
                on screen but will not download it, and portals vary. Saying so with the
                way out is better than sending someone back to a screen that has no
                download button. Clariti's upload accepts png/jpeg, so this is real. */}
            <p className="connections-guided-note">
              If a result only ever appears on screen and there is nothing to download, a screenshot is enough. Clariti
              reads a photo or a screenshot the same way it reads a PDF.
            </p>
          </section>
        ) : null}

        <p className="connections-footnote">
          Clariti has no direct line into any hospital, insurer or health service, and nothing on this page opens one:
          every route here is you bringing the document yourself.
        </p>
      </main>
    </ClaritiShell>
  );
}

/** What the source can actually hand over, in the same words the rest of the app uses. */
function DocumentKinds({ source }: { source: ResolvedConnectionSource }) {
  if (source.documentKinds.length === 0) return null;

  return (
    <ul className="connections-documents">
      {source.documentKinds.map((kind) => <li key={kind}>{getClaritiKindMeta(kind).title}</li>)}
    </ul>
  );
}

/** Numbered because these get followed on a phone, one hand, paperwork in the other. */
function Steps({ source }: { source: ResolvedConnectionSource }) {
  if (source.transport.via !== "self_serve") return null;

  const { steps, note } = source.transport;

  return (
    <>
      <ol className="connections-steps">
        {steps.map((step, index) => <li key={`${source.id}-step-${index}`}>{step}</li>)}
      </ol>
      {/* Where the route stops. Said here rather than left for someone to discover
          halfway through, holding the paperwork. */}
      {note ? <p className="connections-step-note">{note}</p> : null}
    </>
  );
}
