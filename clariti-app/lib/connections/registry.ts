import type { ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";

/**
 * Where a health document can come from.
 *
 * The rule this file exists to enforce: availability is *derived*, never
 * authored. No entry can call itself ready because someone typed "ready" —
 * a source declares how it physically gets a document (its transport) and the
 * state is computed from that plus the environment. Same reasoning as the
 * severity pill in lib/domain/clariti-severity.ts: a confident label that
 * nothing computed is how you end up telling a patient something untrue.
 *
 * Adding a real connector later should be one entry here plus an adapter.
 */

/** Markets differ in what the patient can actually reach. "any" applies everywhere. */
export type ConnectionMarket = "us" | "uk" | "any";

/**
 * Clariti's own document vocabulary, minus "unknown" — a source advertises what
 * it can hand over, and "we are not sure what this is" is an outcome of reading
 * a document, not something a source can promise to deliver.
 */
export type ConnectionDocumentKind = Exclude<ClaritiAnalysisKind, "unknown">;

/** "user" sees only what works. "operator" sees the whole truth, including gaps. */
export type ConnectionAudience = "user" | "operator";

export type ConnectionEnv = Readonly<Record<string, string | undefined>>;

export type ConnectionAvailability =
  /** Works right now, for everyone, with nothing configured. */
  | { state: "ready" }
  /**
   * The person does the transfer themselves: they download the document from
   * somewhere they already have access to and bring it here. This is a real and
   * complete path, not a degraded one — it is how most documents arrive.
   */
  | { state: "guided" }
  /**
   * A connector whose operator credentials are absent. It names the env vars it
   * is missing so an operator can fix it, and it is never shown to a user — not
   * as "coming soon", not at all.
   */
  | { state: "unconfigured"; missing: string[] }
  /** Structurally closed to Clariti. No env var opens it. */
  | { state: "unavailable"; reason: string };

/**
 * How a source physically produces a document. This is the authored part, and
 * it is deliberately the *only* authored part: there is no way to write down a
 * state, so there is no way to write down an optimistic one.
 */
export type ConnectionTransport =
  /** The person hands us the file. Nothing to configure and nothing to break. */
  | { via: "upload" }
  /**
   * The person fetches it from a system they already have. Steps are required:
   * a guided route with no instructions is a shrug, not a path.
   */
  | {
      via: "self_serve";
      steps: readonly string[];
      /**
       * The limit of this route, where it has one. Sources rarely do exactly what
       * a person expects — the NHS App shows test results but refuses to export
       * them — and the honest place to say so is beside the steps, not in a
       * support article they will never read.
       */
      note?: string;
    }
  /** An operator-configured API connector. Usable only once its env is complete. */
  | { via: "connector"; requires: readonly string[] }
  /** Closed by the other side. The reason is shown to operators, not sold to users. */
  | { via: "closed"; reason: string };

export type ConnectionSource = {
  /** Stable and persisted. Renaming one orphans whatever referenced it. */
  id: string;
  name: string;
  /** One line, written for a frightened patient rather than a developer. */
  description: string;
  documentKinds: readonly ConnectionDocumentKind[];
  market: ConnectionMarket;
  transport: ConnectionTransport;
};

export type ResolvedConnectionSource = ConnectionSource & {
  availability: ConnectionAvailability;
};

/**
 * Seeded with what is genuinely true today. Anything Clariti cannot reach —
 * clinical-record aggregators, HealthKit, Health Connect, wearables — is absent
 * on purpose. Listing it would be a promise.
 */
export const CONNECTION_SOURCES = [
  {
    id: "upload",
    name: "Upload or take a photo",
    description:
      "Point your phone at the letter in your hand, or upload the PDF. Nothing has to be connected for this to work.",
    // Everything else on this list is a convenience over this one.
    documentKinds: [
      "medical_bill",
      "insurance_eob",
      "radiology_report",
      "lab_results",
      "discharge_summary",
      "medication_context",
      "pathology_report",
      "referral_letter",
      "visit_notes",
      "prior_authorization",
    ],
    market: "any",
    transport: { via: "upload" },
  },
  {
    id: "nhs_app_download",
    name: "NHS App documents",
    description:
      "Letters and reports from your GP surgery and your hospital are already in the NHS App, and you can download them.",
    // Checked against NHS's own help pages (nhs.uk/nhs-app/help/documents/ and
    // /help/test-results/, both last reviewed 13 January 2026) rather than
    // written from memory, because the first draft of this entry offered test
    // results — and NHS states flatly: "It is not possible to download your test
    // results from the NHS App."
    //
    // So: the kinds below are the ones nhs.uk actually names under Documents —
    // referral letters, discharge documents, reports from scans, and outcome
    // letters from appointments. `lab_results` is deliberately absent, and the
    // note beneath the steps says where those have to come from instead. A
    // guided route that sends someone hunting for a button that is not there is
    // worse than no route at all.
    documentKinds: [
      "referral_letter",
      "discharge_summary",
      "radiology_report",
      "visit_notes",
    ],
    market: "uk",
    transport: {
      via: "self_serve",
      steps: [
        "Open the NHS App and sign in.",
        "Tap Documents, then Your documents for GP letters, or Hospital and specialist documents for letters from a clinic.",
        "Open the letter you want. Some will not preview in the app and have to be downloaded to your device to read at all.",
        "Come back here and upload the file you downloaded.",
      ],
      note:
        "Test results are the one thing the NHS App will not let you download. You can read them on screen, so photograph that screen and bring the photo here, or ask your GP surgery for a copy.",
    },
  },
  {
    id: "patient_portal_download",
    name: "Patient portal download",
    description:
      "MyChart and portals like it let you download your own records. Save the document you need, then bring it here.",
    // No EOBs or prior-auth letters: those come from the insurer, not the
    // provider's portal, and sending someone to look for them there wastes the
    // one bit of energy a frightened person has.
    documentKinds: [
      "medical_bill",
      "lab_results",
      "radiology_report",
      "pathology_report",
      "visit_notes",
      "discharge_summary",
      "medication_context",
    ],
    market: "us",
    transport: {
      via: "self_serve",
      steps: [
        "Sign in to MyChart, or to whichever portal your hospital or clinic uses.",
        "Find the bill, result, or visit summary you want.",
        "Download or print it to PDF.",
        "Come back here and upload the file you saved.",
      ],
    },
  },
  {
    id: "cms_blue_button",
    name: "Medicare claims (CMS Blue Button)",
    description:
      "If you are on Medicare, your claims history can come straight from Medicare instead of you hunting for paperwork.",
    // Production Blue Button access needs a CMS application and a demo call, so
    // this stays hidden until an operator holds real credentials. These two env
    // names are the contract: the resolver reports them by name when absent.
    documentKinds: ["insurance_eob", "medical_bill", "medication_context"],
    market: "us",
    transport: {
      via: "connector",
      requires: ["CMS_BLUE_BUTTON_CLIENT_ID", "CMS_BLUE_BUTTON_CLIENT_SECRET"],
    },
  },
] as const satisfies readonly ConnectionSource[];

/** The narrow union of ids that ship today, for callers that want exhaustiveness. */
export type ConnectionSourceId = (typeof CONNECTION_SOURCES)[number]["id"];

/**
 * A variable set to "" or to a stray newline is not set. Shotstack taught us
 * this the expensive way (see lib/integrations/shotstack.ts): a whitespace
 * value that reads as truthy is how a broken integration looks configured.
 */
function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** The whole point of the file: state is computed, here and nowhere else. */
export function resolveAvailability(
  source: ConnectionSource,
  env: ConnectionEnv,
): ConnectionAvailability {
  const transport = source.transport;
  switch (transport.via) {
    case "upload":
      return { state: "ready" };
    case "self_serve":
      return { state: "guided" };
    case "connector": {
      const missing = transport.requires.filter((name) => !isPresent(env[name]));
      return missing.length > 0 ? { state: "unconfigured", missing } : { state: "ready" };
    }
    case "closed":
      return { state: "unavailable", reason: transport.reason };
  }
}

/** Usable means the person can actually get a document through it today. */
export function isUsableAvailability(availability: ConnectionAvailability): boolean {
  return availability.state === "ready" || availability.state === "guided";
}

function servesMarket(source: ConnectionSource, market: ConnectionMarket | undefined): boolean {
  if (source.market === "any") return true;
  // No market means we genuinely do not know where the person is. We return
  // every market's routes rather than guess and hide the one they need — the
  // same instinct as saying "we only read pages 1-4" instead of inventing 5.
  if (market === undefined || market === "any") return true;
  return source.market === market;
}

export type ResolveConnectionOptions = {
  /** The viewer's market. Omit it when it is unknown; do not guess one. */
  market?: ConnectionMarket;
  /** Defaults to "user", which hides everything that is not ready or guided. */
  audience?: ConnectionAudience;
  /** Override the catalogue. Exists for tests and for future gating. */
  sources?: readonly ConnectionSource[];
};

/**
 * The sources a given viewer should actually see.
 *
 * A user-facing list contains only what works. An operator view returns the
 * whole catalogue, gaps included, because that view exists to show the gaps.
 */
export function resolveConnectionSources(
  env: ConnectionEnv,
  options: ResolveConnectionOptions = {},
): ResolvedConnectionSource[] {
  const { audience = "user", market, sources = CONNECTION_SOURCES } = options;
  return sources
    .filter((source) => servesMarket(source, market))
    .map((source) => ({ ...source, availability: resolveAvailability(source, env) }))
    .filter((resolved) => audience === "operator" || isUsableAvailability(resolved.availability));
}

export function getConnectionSource(
  id: string,
  sources: readonly ConnectionSource[] = CONNECTION_SOURCES,
): ConnectionSource | undefined {
  return sources.find((source) => source.id === id);
}

/**
 * What an operator would have to set to light up every connector, keyed by
 * source id. Empty when nothing is waiting on credentials.
 */
export function missingConnectionEnv(
  env: ConnectionEnv,
  sources: readonly ConnectionSource[] = CONNECTION_SOURCES,
): Record<string, string[]> {
  const gaps: Record<string, string[]> = {};
  for (const source of sources) {
    const availability = resolveAvailability(source, env);
    if (availability.state === "unconfigured") gaps[source.id] = availability.missing;
  }
  return gaps;
}
