import type { ClaritiAnalysis, ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";

/**
 * Threading: deciding whether two of one person's documents belong to the same
 * story, so the reader can follow it and the agent can reason across it.
 *
 * What this replaces: /api/compare used to find a partner by matching
 * `analysis.kind`. Kind is wrong in both directions — a thyroid panel and a
 * diabetes panel are both `lab_results` and were compared as though they
 * measured the same thing, while a bill and its EOB are different kinds and so
 * could never be compared at all.
 *
 * Nothing here links anything. It proposes, with its reasons written out, and a
 * person accepts. Clariti already refuses to sound confident about a document it
 * could not read; silently deciding that a dermatology letter belongs in a
 * cardiology thread would be the same failure with more surface area, because
 * every later answer would then reason across documents that are not about the
 * same thing.
 */

/**
 * The parts of a saved analysis this file reasons over. Deliberately a subset:
 * a fresh `ClaritiAnalysis` and a stored `ClaritiHistoryEntry` both satisfy it,
 * so neither caller needs an adapter, and nothing here can reach for a field
 * that history rows do not carry.
 */
export type ThreadAnalysisFacts = {
  summary: string;
  keyPoints: ClaritiAnalysis["keyPoints"];
  metrics: ClaritiAnalysis["metrics"];
  plainEnglish?: string;
  sourceAnchors?: ClaritiAnalysis["sourceAnchors"];
  flags?: ClaritiAnalysis["flags"];
};

export type ThreadDocument = {
  /** Whatever the caller threads by — a session id today. Opaque here. */
  id: string;
  kind: ClaritiAnalysisKind;
  title: string;
  /** ISO. When Clariti saved it, which is not the date printed on the page — see CLOSE_IN_TIME_DAYS. */
  createdAt: string;
  analysis: ThreadAnalysisFacts;
};

/** A story: one `clariti_sessions` row and the documents linked to it. */
export type Thread = {
  id: string;
  title: string;
  documents: ThreadDocument[];
};

export type ThreadSignal =
  | "episode_identifier"
  | "anatomy"
  | "shared_metrics"
  | "clinician"
  | "kind_pair"
  | "facility"
  | "person_identifier"
  | "close_in_time";

export type ThreadEvidence = {
  signal: ThreadSignal;
  /** Written for the reader, not for a log. This string is what the UI shows. */
  reason: string;
  weight: number;
};

/**
 * "Not sure" is a verdict, not a small number. It used to be tempting to return
 * a score and let the caller pick a cutoff; a caller that forgets the cutoff
 * then links a dermatology letter into a cardiology thread and never says so.
 * The union makes the caller look.
 */
export type ThreadRelatedness =
  | {
      verdict: "related";
      score: number;
      /** Best first. Safe to show next to the proposal. */
      reasons: string[];
      evidence: ThreadEvidence[];
    }
  | {
      verdict: "unsure";
      score: number;
      /** Not called `reasons`, so a UI that renders `reasons` cannot render these by accident. */
      weakSignals: string[];
      whyNot: string;
      evidence: ThreadEvidence[];
    };

export type ThreadLinkProposal = {
  threadId: string;
  threadTitle: string;
  score: number;
  reasons: string[];
  evidence: ThreadEvidence[];
  /** The document in the thread that the candidate actually matched. */
  matchedDocument: { id: string; title: string; kind: ClaritiAnalysisKind; createdAt: string };
};

export type ThreadLinkUncertainty = {
  threadId: string;
  threadTitle: string;
  whyNot: string;
  weakSignals: string[];
};

export type ThreadLinkSuggestions = {
  /** Ranked, strongest first. Often empty, and that is the intended common case. */
  proposals: ThreadLinkProposal[];
  /**
   * Threads Clariti looked at and would not propose. Carried so the UI can say
   * "these look adjacent but Clariti will not call it" rather than showing an
   * empty list that reads as "you have nothing else about this".
   */
  unsure: ThreadLinkUncertainty[];
};

/** The bar, in the reader's words. Exported so the UI can state it rather than paraphrase it. */
export const THREAD_EVIDENCE_RULE =
  "Clariti only suggests a link when something ties two documents to the same episode of care — a reference number they share, the same body part, or the same measurement repeated. Being yours, being from the same hospital, being from the same month, or being the same type of document is not enough, however many of those are true at once.";

/**
 * Weak on purpose: `createdAt` is when Clariti saved the analysis, not the date
 * printed on the document. Somebody uploading a shoebox of old paperwork in one
 * sitting would otherwise look like one busy fortnight of care.
 */
const CLOSE_IN_TIME_DAYS = 45;

const WEIGHTS: Record<ThreadSignal, number> = {
  episode_identifier: 0.6,
  anatomy: 0.28,
  clinician: 0.22,
  shared_metrics: 0.2,
  kind_pair: 0.12,
  facility: 0.08,
  close_in_time: 0.08,
  person_identifier: 0.06,
};

/** Extra weight per shared measurement beyond the first, and the ceiling for it. */
const EXTRA_METRIC_WEIGHT = 0.06;
const MAX_METRIC_WEIGHT = 0.34;

/**
 * Signals specific enough to one episode of care to carry a proposal on their
 * own: a reference number scoped to that episode, the same body part with no
 * side contradicting it, or the same distinctive measurement reported twice.
 */
const EPISODE_SIGNALS = new Set<ThreadSignal>(["episode_identifier", "anatomy", "shared_metrics"]);

/**
 * Signals that say "same episode" rather than "same person". A clinician both
 * documents name is one of them and is the only one that cannot stand alone:
 * the GP who ordered your thyroid panel ordered your diabetes panel too, and
 * signs everything else you own.
 */
const TYING_SIGNALS = new Set<ThreadSignal>([...EPISODE_SIGNALS, "clinician"]);

/**
 * True of documents that have nothing to do with each other. Every document in
 * one person's library carries their member number, a hospital prints its name
 * on everything it sends, two lab sheets are two lab sheets, and a shoebox of
 * old paperwork uploaded in one sitting is all "the same fortnight".
 *
 * So none of these may second a tying signal, and no pile of them proposes
 * anything. This set used to be just `close_in_time`, which is how a thyroid
 * panel and a diabetes panel — same lab, same member number, same kind, same
 * fortnight — came back `related`.
 */
const WEAK_SIGNALS = new Set<ThreadSignal>(["person_identifier", "facility", "kind_pair", "close_in_time"]);

/**
 * Identifier labels, split by what the number is actually scoped to.
 *
 * The split is the point. A claim or accession number names one episode, so two
 * documents carrying the same one are two views of the same event. A member,
 * policy or MRN number names *the person*, and every document in this library
 * already belongs to the same person — matching on it would link a dermatology
 * bill to a cardiology bill and call it evidence. `account` sits with the person
 * group for the same reason: a hospital account number is printed on every bill
 * that hospital ever sends you.
 */
const EPISODE_IDENTIFIER_LABELS = new Set([
  "claim",
  "invoice",
  "statement",
  "accession",
  "requisition",
  "specimen",
  "order",
  "encounter",
  "admission",
  "authorisation",
  "authorization",
  "auth",
  "case",
  "referral",
  "episode",
]);

const PERSON_IDENTIFIER_LABELS = new Set([
  "member",
  "subscriber",
  "policy",
  "group",
  "nhs",
  "mrn",
  "chart",
  "patient",
  "account",
  "acct",
]);

/**
 * An identifier is only believed when the document labels it as one. A bare
 * number match is how "Page 1 of 4" and "2026" become a shared claim reference:
 * both documents really do contain the number, for reasons that have nothing to
 * do with each other. The label has to sit immediately before the value — only
 * a connector word may come between — so "Policy year 2026" does not read as
 * policy number 2026.
 */
const IDENTIFIER_PATTERN =
  /\b(claim|invoice|statement|accession|requisition|specimen|order|encounter|admission|authorisation|authorization|auth|case|referral|episode|member|subscriber|policy|group|nhs|mrn|chart|patient|account|acct)\s*(?:no\.?|number|num|#|id|ident(?:ifier)?|ref(?:erence)?)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{3,})/gi;

/** A bare year, a plan year range, or a packed date — none of which identify an episode. */
const DATE_SHAPED_IDENTIFIER = /^(?:(?:19|20)\d{2}(?:(?:19|20)\d{2})?|(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/;

/**
 * Titles only. Patients are Mr/Ms/Mrs on their own letters, and "Dear Ms
 * Adeyemi" appearing on a dermatology letter and a cardiology letter says only
 * that both are hers — which is what threading already assumes.
 */
const CLINICIAN_PATTERN = /\b(?:dr|doctor|prof|professor|consultant)\.?[ \t]+([A-Za-z][\w'-]+(?:[ \t]+[A-Za-z][\w'-]+)?)/gi;

/**
 * Weak, not tying: a large hospital is where all of somebody's unrelated care
 * happens, so a shared facility narrows nothing on its own.
 */
const FACILITY_PATTERN =
  /\b((?:[A-Z][\w'&.-]*\s+){1,3}(?:Hospital|Clinic|Infirmary|Surgery|Trust|Practice|Healthcare|Health System|Medical Cent(?:er|re)|Health Cent(?:er|re)|Imaging Cent(?:er|re)|Cancer Cent(?:er|re)|Laborator(?:y|ies)|Radiology|Pathology))\b/g;

/**
 * Anatomy is the signal that separates a knee story from a heart story, so the
 * synonyms have to cover how each kind of document talks: a referral says
 * "dermatology", the report it produced says "skin".
 */
const ANATOMY_REGIONS: Array<{ region: string; pattern: RegExp }> = [
  { region: "knee", pattern: /\b(knees?|patellae?|patellar|meniscus|menisci|acl|mcl|pcl|cruciate)\b/ },
  { region: "shoulder", pattern: /\b(shoulders?|rotator cuff|glenohumeral|supraspinatus)\b/ },
  { region: "hip", pattern: /\b(hips?|acetabular|acetabulum|femoral head)\b/ },
  { region: "spine", pattern: /\b(spine|spinal|lumbar|thoracic|vertebrae?|vertebral|sciatica|disc bulge|disc herniation)\b/ },
  { region: "brain", pattern: /\b(brain|cerebral|cerebellar|intracranial|neurolog\w+|skull)\b/ },
  { region: "chest", pattern: /\b(chest|lungs?|pulmonary|pleural|bronch\w+|respirator\w+)\b/ },
  { region: "heart", pattern: /\b(hearts?|cardiac|cardiolog\w+|coronary|myocard\w+|echocardiogram)\b/ },
  { region: "liver", pattern: /\b(liver|hepatic|hepatolog\w+)\b/ },
  { region: "kidney", pattern: /\b(kidneys?|renal|nephrolog\w+)\b/ },
  { region: "thyroid", pattern: /\b(thyroid|thyroidectomy)\b/ },
  { region: "breast", pattern: /\b(breasts?|mammogra\w+)\b/ },
  { region: "prostate", pattern: /\b(prostate|prostatic)\b/ },
  { region: "abdomen", pattern: /\b(abdomen|abdominal)\b/ },
  { region: "pelvis", pattern: /\b(pelvis|pelvic)\b/ },
  { region: "skin", pattern: /\b(skin|dermatolog\w+|cutaneous|eczema|psoriasis|melanoma)\b/ },
  { region: "eye", pattern: /\b(eyes?|ocular|retinal?|ophthalm\w+)\b/ },
  { region: "ear", pattern: /\b(ears?|tympanic|audiolog\w+|otolog\w+)\b/ },
  { region: "bowel", pattern: /\b(colon|colorectal|colonoscopy|bowel|rectal)\b/ },
  { region: "stomach", pattern: /\b(stomach|gastric|gastroenterolog\w+|endoscopy)\b/ },
  { region: "ankle", pattern: /\b(ankles?|achilles)\b/ },
  { region: "wrist", pattern: /\b(wrists?|carpal)\b/ },
  { region: "elbow", pattern: /\b(elbows?|epicondyl\w+)\b/ },
  { region: "foot", pattern: /\b(feet|foot|plantar|metatarsal\w*)\b/ },
  { region: "hand", pattern: /\b(hands?|fingers?|phalange\w*)\b/ },
];

/**
 * Labels every document of a type carries. Two EOBs both reporting "Deductible"
 * are not one story — that is the form, not the episode.
 */
const NON_DISTINCTIVE_METRIC_LABELS = new Set([
  "date", "dates", "date of service", "dates of service", "service date", "date of birth", "dob", "visit",
  "total", "subtotal", "amount", "amount due", "amount billed", "billed amount", "allowed amount", "balance",
  "balance due", "charges", "total charges", "payment", "payments", "paid", "insurance paid", "adjustment",
  "adjustments", "due", "tax", "quantity", "units", "unit", "price", "rate",
  "deductible", "copay", "co pay", "coinsurance", "patient responsibility", "you owe", "plan", "coverage",
  "patient", "patient name", "name", "provider", "facility", "page", "pages", "number", "reference", "id",
  "claim", "claim number", "account", "account number", "member id", "group number", "policy number",
  "status", "type", "code", "cpt code", "description", "service", "services", "result", "results", "value",
  "test", "sample", "specimen", "method", "range", "reference range",
]);

/** Kinds that habitually belong to one story. Weak on its own — this is the signal that was wrong before. */
const KIND_PAIRS: Array<{ kinds: [ClaritiAnalysisKind, ClaritiAnalysisKind]; reason: string }> = [
  {
    kinds: ["medical_bill", "insurance_eob"],
    reason: "A bill and an Explanation of Benefits are usually two sides of the same claim.",
  },
  {
    kinds: ["medical_bill", "prior_authorization"],
    reason: "A bill and an approval letter often cover the same treatment.",
  },
  {
    kinds: ["insurance_eob", "prior_authorization"],
    reason: "An Explanation of Benefits and an approval letter often cover the same treatment.",
  },
  {
    kinds: ["radiology_report", "radiology_report"],
    reason: "Two scan reports are often the same thing looked at again later.",
  },
  {
    kinds: ["lab_results", "lab_results"],
    reason: "Two lab sheets are often the same tests repeated later.",
  },
  {
    kinds: ["pathology_report", "pathology_report"],
    reason: "Two pathology reports are often the same sample followed up.",
  },
  {
    kinds: ["referral_letter", "radiology_report"],
    reason: "A referral is often what led to the scan.",
  },
  {
    kinds: ["referral_letter", "visit_notes"],
    reason: "A referral and the visit notes that followed are usually one appointment.",
  },
  {
    kinds: ["visit_notes", "discharge_summary"],
    reason: "Visit notes and a discharge summary are usually one stay.",
  },
  {
    kinds: ["discharge_summary", "medication_context"],
    reason: "A discharge summary and a medication list are usually the same going-home instructions.",
  },
];

type ExtractedIdentifier = { key: string; display: string; label: string; scope: "episode" | "person" };

/**
 * Everything Clariti stored about the document, for reference numbers only.
 *
 * A number is safe to read this widely: the document printed it, and Clariti
 * repeats it rather than inventing one, so a claim number that reached the
 * summary or a metric is still the document's own. Words are not safe that way
 * — see `documentOwnWords`.
 */
function flattenForIdentifiers(document: ThreadDocument): string {
  const { analysis } = document;
  return [
    document.title,
    analysis.summary,
    analysis.plainEnglish ?? "",
    ...(analysis.sourceAnchors ?? []),
    ...analysis.keyPoints.flatMap((point) => [point.label, point.detail, point.sourceAnchor]),
    ...analysis.metrics.flatMap((metric) => [`${metric.label}: ${metric.value}`, metric.caveat ?? ""]),
    ...(analysis.flags ?? []).flatMap((flag) => [flag.label, flag.detail]),
  ]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n");
}

/**
 * The document's own words: its title and the verbatim quotes pulled out of it.
 * Nothing Clariti wrote itself.
 *
 * Anatomy, clinicians and facilities are read from this rather than from the
 * whole analysis, because the analysis prompt asks the model for red-flag safety
 * advice. "If you develop chest pain, seek urgent care" is boilerplate that
 * lands on documents about anything at all, and reading it as anatomy matched a
 * thyroid panel to a foot X-ray on a chest neither of them mentions. The anchors
 * are also the only text here checked back against the source document, which
 * makes them the most trustworthy field available.
 */
function documentOwnWords(document: ThreadDocument): string {
  const { analysis } = document;
  return [document.title, ...(analysis.sourceAnchors ?? []), ...analysis.keyPoints.map((point) => point.sourceAnchor)]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n");
}

function extractIdentifiers(text: string): ExtractedIdentifier[] {
  const found = new Map<string, ExtractedIdentifier>();

  for (const match of text.matchAll(IDENTIFIER_PATTERN)) {
    const label = (match[1] ?? "").toLowerCase();
    const raw = (match[2] ?? "").replace(/[-.,;:]+$/, "");
    const key = raw.replace(/[\s-]/g, "").toUpperCase();
    const digits = key.replace(/\D/g, "").length;

    // A real reference has digits and length. Without both, "Claim status:
    // denied" reads as claim number "denied" and "Order 3 of 5" as order 3.
    if (key.length < 6 || digits < 4) continue;
    if (DATE_SHAPED_IDENTIFIER.test(key)) continue;

    const scope = EPISODE_IDENTIFIER_LABELS.has(label) ? "episode" : PERSON_IDENTIFIER_LABELS.has(label) ? "person" : null;
    if (!scope) continue;

    // First label wins, so the noun in the reason is the one the reader can find
    // on the page rather than whichever spelling we happened to match last.
    if (!found.has(key)) found.set(key, { key, display: raw, label, scope });
  }

  return [...found.values()];
}

function identifierNoun(label: string): string {
  if (label === "nhs") return "NHS number";
  if (label === "mrn" || label === "chart") return "medical record number";
  if (label === "acct") return "account number";
  if (label.startsWith("auth")) return "authorisation number";
  return `${label} number`;
}

/**
 * Which side of the body, when the document says. A left-knee MRI and a
 * right-knee X-ray share the word "knee" and share nothing else that matters,
 * and threading them would have the agent report one knee's history as the
 * other's. Only the side stated closest before the word counts; where a document
 * names both sides Clariti reads it as unknown rather than picking one.
 */
function lateralityFor(lowerText: string, pattern: RegExp): "left" | "right" | null {
  const sides = new Set<string>();

  for (const match of lowerText.matchAll(new RegExp(pattern.source, "gi"))) {
    if (match.index === undefined) continue;
    const before = lowerText.slice(Math.max(0, match.index - 40), match.index);
    const side = [...before.matchAll(/\b(left|right)\b/g)].pop();
    if (side) sides.add(side[1]);
  }

  return sides.size === 1 ? ([...sides][0] as "left" | "right") : null;
}

function extractRegions(lowerText: string): Map<string, "left" | "right" | null> {
  const regions = new Map<string, "left" | "right" | null>();
  for (const entry of ANATOMY_REGIONS) {
    if (!entry.pattern.test(lowerText)) continue;
    regions.set(entry.region, lateralityFor(lowerText, entry.pattern));
  }
  return regions;
}

function extractClinicians(text: string): Set<string> {
  const names = new Set<string>();

  for (const match of text.matchAll(CLINICIAN_PATTERN)) {
    // Keep only the capitalised words that follow the title. "Dr Okafor
    // reviewed the scan" is Dr Okafor; "dr who wrote this" is nobody.
    const words = (match[1] ?? "").trim().split(/\s+/).filter((word) => /^[A-Z]/.test(word));
    const surname = words[words.length - 1];
    if (!surname) continue;
    const key = surname.toLowerCase().replace(/['’]s$/, "").replace(/[^a-z-]/g, "");
    if (key.length >= 3) names.add(key);
  }

  return names;
}

function extractFacilities(text: string): Set<string> {
  const facilities = new Set<string>();
  for (const match of text.matchAll(FACILITY_PATTERN)) {
    const name = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (name.length >= 6) facilities.add(name.toLowerCase());
  }
  return facilities;
}

/**
 * Fold only the differences that are spelling, not meaning: British and American
 * haemoglobin are one test, "Haemoglobin (g/dL)" and "Haemoglobin level" are one
 * test, and a thyroid panel and a diabetes panel still share nothing.
 */
function normalizeMetricLabel(label: string): string | null {
  const cleaned = label
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(level|levels|count|counts|serum|blood|plasma|total)\b\s*$/g, "")
    .trim();

  const folded = cleaned
    .replace(/\bhemoglobin\b/g, "haemoglobin")
    .replace(/\bhematocrit\b/g, "haematocrit")
    .replace(/\b(?:haemoglobin )?a1c\b/g, "hba1c");

  if (folded.length < 3) return null;
  if (/^\d+$/.test(folded)) return null;
  if (NON_DISTINCTIVE_METRIC_LABELS.has(folded)) return null;
  return folded;
}

function sharedMetricLabels(a: ThreadDocument, b: ThreadDocument): string[] {
  const other = new Set(
    b.analysis.metrics.map((metric) => normalizeMetricLabel(metric.label)).filter((label): label is string => Boolean(label)),
  );

  const shared = new Map<string, string>();
  for (const metric of a.analysis.metrics) {
    const normalized = normalizeMetricLabel(metric.label);
    if (!normalized || !other.has(normalized) || shared.has(normalized)) continue;
    // Display the label the way the newer document prints it.
    shared.set(normalized, metric.label.trim());
  }

  return [...shared.values()];
}

function kindPairReason(a: ClaritiAnalysisKind, b: ClaritiAnalysisKind): string | null {
  if (a === "unknown" || b === "unknown") return null;
  const pair = KIND_PAIRS.find(
    (entry) => (entry.kinds[0] === a && entry.kinds[1] === b) || (entry.kinds[0] === b && entry.kinds[1] === a),
  );
  return pair?.reason ?? null;
}

/** An unreadable date is unknown, not "the same day" — that zero would read as a match. */
function daysBetween(a: string, b: string): number | null {
  const first = Date.parse(a);
  const second = Date.parse(b);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.abs(first - second) / 86_400_000;
}

function listOut(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function collectEvidence(a: ThreadDocument, b: ThreadDocument): ThreadEvidence[] {
  const textA = flattenForIdentifiers(a);
  const textB = flattenForIdentifiers(b);
  const ownWordsA = documentOwnWords(a);
  const ownWordsB = documentOwnWords(b);
  const evidence: ThreadEvidence[] = [];

  const identifiersB = extractIdentifiers(textB);
  const shared = extractIdentifiers(textA)
    .map((identifier) => ({ identifier, match: identifiersB.find((other) => other.key === identifier.key) }))
    .filter((entry): entry is { identifier: ExtractedIdentifier; match: ExtractedIdentifier } => Boolean(entry.match));

  const episodeIds = shared.filter((entry) => entry.identifier.scope === "episode" || entry.match.scope === "episode");
  const personIds = shared.filter((entry) => !episodeIds.includes(entry));

  if (episodeIds[0]) {
    const first = episodeIds[0].identifier;
    const extra = episodeIds.length > 1 ? ` (and ${episodeIds.length - 1} more shared reference${episodeIds.length > 2 ? "s" : ""})` : "";
    evidence.push({
      signal: "episode_identifier",
      reason: `Both documents give the same ${identifierNoun(first.label)}, ${first.display}${extra}.`,
      weight: WEIGHTS.episode_identifier,
    });
  }

  if (personIds[0]) {
    const first = personIds[0].identifier;
    evidence.push({
      signal: "person_identifier",
      // Said out loud rather than scored quietly: this number is on everything
      // the person owns, so it proves whose paperwork it is and nothing else.
      reason: `Both show the same ${identifierNoun(first.label)}, ${first.display} — that is on all of your paperwork, so on its own it only says these are both yours.`,
      weight: WEIGHTS.person_identifier,
    });
  }

  const regionsA = extractRegions(ownWordsA.toLowerCase());
  const regionsB = extractRegions(ownWordsB.toLowerCase());
  const sharedRegions: string[] = [];
  for (const [region, sideA] of regionsA) {
    if (!regionsB.has(region)) continue;
    const sideB = regionsB.get(region) ?? null;
    if (sideA && sideB && sideA !== sideB) continue;
    sharedRegions.push(region);
  }
  if (sharedRegions.length > 0) {
    evidence.push({
      signal: "anatomy",
      reason:
        sharedRegions.length === 1
          ? `Both documents are about the ${sharedRegions[0]}.`
          : `Both documents are about the same areas of the body (${listOut(sharedRegions)}).`,
      weight: WEIGHTS.anatomy,
    });
  }

  const cliniciansB = extractClinicians(ownWordsB);
  const sharedClinicians = [...extractClinicians(ownWordsA)].filter((name) => cliniciansB.has(name));
  if (sharedClinicians.length > 0) {
    const named = sharedClinicians.map((name) => `Dr ${name.charAt(0).toUpperCase()}${name.slice(1)}`);
    evidence.push({
      signal: "clinician",
      reason: `Both documents name ${listOut(named)}.`,
      weight: WEIGHTS.clinician,
    });
  }

  const sharedMetrics = sharedMetricLabels(a, b);
  if (sharedMetrics.length > 0) {
    evidence.push({
      signal: "shared_metrics",
      reason:
        sharedMetrics.length === 1
          ? `Both report ${sharedMetrics[0]}, so one can be read as a later reading of the other.`
          : `Both report the same measurements (${listOut(sharedMetrics.slice(0, 4))}).`,
      weight: Math.min(MAX_METRIC_WEIGHT, WEIGHTS.shared_metrics + (sharedMetrics.length - 1) * EXTRA_METRIC_WEIGHT),
    });
  }

  const pairReason = kindPairReason(a.kind, b.kind);
  if (pairReason) evidence.push({ signal: "kind_pair", reason: pairReason, weight: WEIGHTS.kind_pair });

  const facilitiesB = extractFacilities(ownWordsB);
  const sharedFacilities = [...extractFacilities(ownWordsA)].filter((name) => facilitiesB.has(name));
  if (sharedFacilities[0]) {
    evidence.push({
      signal: "facility",
      reason: `Both mention ${sharedFacilities[0].replace(/\b\w/g, (letter) => letter.toUpperCase())}.`,
      weight: WEIGHTS.facility,
    });
  }

  const days = daysBetween(a.createdAt, b.createdAt);
  if (days !== null && days <= CLOSE_IN_TIME_DAYS) {
    const whole = Math.round(days);
    evidence.push({
      signal: "close_in_time",
      reason: whole === 0 ? "Clariti saved both on the same day." : `Clariti saved these ${whole} day${whole === 1 ? "" : "s"} apart.`,
      weight: WEIGHTS.close_in_time,
    });
  }

  return evidence.sort((first, second) => second.weight - first.weight);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How related two documents look, and why.
 *
 * The bar, and the reasoning behind it: a wrong link is worse than no link,
 * because the agent then reasons across documents that are not about the same
 * thing and states relationships that do not exist. So a proposal needs
 * something that ties the two to the same *episode*: a reference number scoped
 * to that episode, the same body part, or the same measurement repeated. A
 * clinician they both name is real evidence but is not that on its own, so it
 * needs a second signal behind it.
 *
 * What may never be that second signal is the weak set. Each of those is true of
 * documents that have nothing to do with each other — your member number, your
 * hospital, the kind of document, the fortnight you uploaded them in — so
 * letting one of them second a loose match describes every pair of documents a
 * person owns.
 *
 * The score ranks proposals. It never decides them — the rule above does. A
 * cutoff on a number is exactly the kind of thing a caller tunes upward one
 * afternoon and quietly starts linking strangers' knees together.
 */
export function scoreThreadRelatedness(a: ThreadDocument, b: ThreadDocument): ThreadRelatedness {
  const evidence = collectEvidence(a, b);
  const score = round2(Math.min(1, evidence.reduce((total, item) => total + item.weight, 0)));

  const tying = evidence.filter((item) => TYING_SIGNALS.has(item.signal));
  const episodeScoped = evidence.some((item) => EPISODE_SIGNALS.has(item.signal));
  // Corroboration is whatever is left once the strongest tie and the whole weak
  // set are taken out, which leaves a second tying signal and nothing else: a
  // member number, a hospital name and a kind pair are three ways of saying
  // "these are both yours", and three of those are still not one story. This is
  // the clause that carries `clinician`, the one tie that cannot stand alone.
  const corroboration = evidence.filter((item) => item !== tying[0] && !WEAK_SIGNALS.has(item.signal));

  if (episodeScoped || (tying.length > 0 && corroboration.length > 0)) {
    return { verdict: "related", score, reasons: evidence.map((item) => item.reason), evidence };
  }

  return {
    verdict: "unsure",
    score,
    weakSignals: evidence.map((item) => item.reason),
    whyNot: whyNotFor(evidence, tying),
    evidence,
  };
}

function whyNotFor(evidence: ThreadEvidence[], tying: ThreadEvidence[]): string {
  if (evidence.length === 0) {
    return "Nothing in either document connects them — no shared reference number, no clinician they both name, no shared body part, and no measurement that appears in both.";
  }

  if (tying.length === 0) {
    return "What these have in common is true of all of your paperwork — the same kind of document, the same weeks, the same place. Clariti will not call that one story.";
  }

  const restIsWeak = evidence.some((item) => WEAK_SIGNALS.has(item.signal))
    ? " Everything else they have in common is true of all of your paperwork, so none of it seconds that."
    : "";
  return `Only one thing links them: ${tying[0].reason}${restIsWeak} One loose match is how unrelated documents end up in the same story, so Clariti leaves this one to you.`;
}

/**
 * Ranked proposals for linking a document into a thread the person already has.
 *
 * Proposals, not links. A thread decides what the agent reads together, so
 * accepting one is the person's call and the reasons have to be on screen when
 * they make it. `unsure` carries the threads Clariti looked at and would not
 * propose, so the UI can say that rather than showing an empty list that reads
 * as "nothing else of yours is about this".
 */
export function suggestThreadLinks(
  candidate: ThreadDocument,
  existingThreads: Thread[],
  options: { limit?: number } = {},
): ThreadLinkSuggestions {
  const { limit = 5 } = options;
  const proposals: ThreadLinkProposal[] = [];
  const unsure: ThreadLinkUncertainty[] = [];

  for (const thread of existingThreads) {
    const others = thread.documents.filter((document) => document.id !== candidate.id);
    // Already in this thread, or nothing in it to compare against.
    if (others.length === 0 || others.length !== thread.documents.length) continue;

    let best: { document: ThreadDocument; relatedness: ThreadRelatedness } | null = null;
    for (const document of others) {
      const relatedness = scoreThreadRelatedness(candidate, document);
      const better =
        !best ||
        (relatedness.verdict === "related" && best.relatedness.verdict === "unsure") ||
        (relatedness.verdict === best.relatedness.verdict && relatedness.score > best.relatedness.score);
      if (better) best = { document, relatedness };
    }
    if (!best) continue;

    if (best.relatedness.verdict === "related") {
      proposals.push({
        threadId: thread.id,
        threadTitle: thread.title,
        score: best.relatedness.score,
        reasons: best.relatedness.reasons,
        evidence: best.relatedness.evidence,
        matchedDocument: {
          id: best.document.id,
          title: best.document.title,
          kind: best.document.kind,
          createdAt: best.document.createdAt,
        },
      });
      continue;
    }

    unsure.push({
      threadId: thread.id,
      threadTitle: thread.title,
      whyNot: best.relatedness.whyNot,
      weakSignals: best.relatedness.weakSignals,
    });
  }

  return {
    proposals: proposals.sort((first, second) => second.score - first.score).slice(0, limit),
    unsure: unsure.slice(0, limit),
  };
}
