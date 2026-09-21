import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaritiAnalysis, ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta, isClaritiAnalysisKind } from "@/lib/domain/clariti-document-kinds";
import { scoreThreadRelatedness, type ThreadDocument } from "@/lib/domain/clariti-threads";

export type ClaritiHistoryEntry = {
  sessionId: string;
  artifactId: string;
  /**
   * The document this reading is of. /api/analyze stores it inside the payload
   * jsonb because clariti_artifacts has no column for it. Null on artifacts
   * saved before threading, when a session held one document and the question
   * could not come up.
   */
  documentId: string | null;
  /**
   * Every thread this document is filed in, read from clariti_session_documents.
   *
   * Membership is that join table and nothing else. A thread means a person said
   * these documents belong together, so the row recording that decision is the
   * only thing that can answer "is this in my thread" — which is why a link
   * someone accepted counts here even though the reading itself still lives in
   * the session the document was read in.
   *
   * Plural because linking shares rather than moves: a hospital bill belongs to
   * "knee surgery" and to "2026 insurance appeal" at once, and a single id would
   * have to pick one of them and be wrong in the other.
   *
   * Falls back to the session the reading was written in — plus 0005's
   * parent_session_id lineage root — only for artifacts saved before threading,
   * which never recorded which document they read, so the join table cannot
   * speak for them. Lineage is never more than that fallback: one session
   * descending from another says Clariti was open at the time, not that a person
   * put their documents together.
   */
  threadIds: string[];
  kind: ClaritiAnalysisKind;
  title: string;
  summary: string;
  plainEnglish: string;
  /**
   * The verbatim quotes the reading was grounded in. Carried because this is
   * where an accession or claim number survives, and that number is the one
   * thing that ties a bill to its EOB — the most useful pairing the product has.
   * A ClaritiHistoryEntry is what clariti-threads gets handed as
   * ThreadAnalysisFacts, and without these a real match scores as unsure.
   */
  sourceAnchors: ClaritiAnalysis["sourceAnchors"];
  keyPoints: ClaritiAnalysis["keyPoints"];
  metrics: ClaritiAnalysis["metrics"];
  flags: ClaritiAnalysis["flags"];
  /**
   * The whole saved analysis, when the stored payload still carries one and it
   * came from a real read. Null otherwise — and a null here is why a document
   * can be compared inside its own thread but never *claimed* to be related to
   * something outside it: there is nothing to read that claim out of.
   */
  analysis: ClaritiAnalysis | null;
  createdAt: string;
};

type SessionJoin = { owner_id: string; parent_session_id: string | null };

type ArtifactRow = {
  id: string;
  session_id: string;
  kind: string;
  title: string;
  summary: string;
  payload: Partial<ClaritiAnalysis> | null;
  created_at: string;
  clariti_sessions: SessionJoin | SessionJoin[] | null;
};

/** One row of clariti_session_documents: this document is in this thread. */
type SessionDocumentLink = { session_id: string; document_id: string };

/**
 * The document an artifact was written for, from the payload jsonb — the only
 * place there is, since clariti_artifacts has no column for it. Null on
 * artifacts written before threading.
 */
function artifactDocumentId(payload: Partial<ClaritiAnalysis> | null): string | null {
  const documentId = (payload as { documentId?: unknown } | null)?.documentId;
  return typeof documentId === "string" ? documentId : null;
}

/**
 * The threads each of these readings' documents is filed in, keyed by document id.
 *
 * One query for the whole page of rows rather than one per row. The join table's
 * select policy is scoped to the caller's own sessions, and its insert policy
 * checks both halves against the owner, so a row reaching here names a session
 * this reader owns.
 */
async function loadThreadMembership(
  supabase: SupabaseClient,
  rows: ArtifactRow[],
): Promise<Map<string, string[]>> {
  const membership = new Map<string, string[]>();
  const documentIds = [...new Set(rows.map((row) => artifactDocumentId(row.payload)).filter((id): id is string => Boolean(id)))];
  if (documentIds.length === 0) return membership;

  const { data, error } = await supabase
    .from("clariti_session_documents")
    .select("session_id, document_id")
    .in("document_id", documentIds);

  // An empty map is not "in no thread" — rowToEntry falls back rather than
  // deciding a document was filed nowhere on the strength of a failed query.
  if (error || !data) return membership;
  return indexThreadsByDocument(data as unknown as SessionDocumentLink[]);
}

/** Join rows as "which threads is this document in", which is what membership means. */
function indexThreadsByDocument(links: SessionDocumentLink[]): Map<string, string[]> {
  const membership = new Map<string, string[]>();
  for (const link of links) {
    const threads = membership.get(link.document_id) ?? [];
    threads.push(link.session_id);
    membership.set(link.document_id, threads);
  }
  return membership;
}

/**
 * Recent saved document analyses for an owner, newest first. Used both by
 * /api/documents/history and by the messages agent to ground "compare this to
 * my earlier labs/bills" requests in real saved data — never invented content.
 */
export async function getRecentClaritiAnalyses(
  supabase: SupabaseClient,
  ownerId: string,
  options: { kinds?: ClaritiAnalysisKind[]; excludeSessionId?: string; limit?: number } = {},
): Promise<ClaritiHistoryEntry[]> {
  const { kinds, excludeSessionId, limit = 20 } = options;

  let query = supabase
    .from("clariti_artifacts")
    .select("id, session_id, kind, title, summary, payload, created_at, clariti_sessions!inner(owner_id, parent_session_id)")
    .eq("clariti_sessions.owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (excludeSessionId) query = query.neq("session_id", excludeSessionId);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as ArtifactRow[];
  const membership = await loadThreadMembership(supabase, rows);
  const entries = rows
    .map((row) => rowToEntry(row, membership))
    .filter((entry): entry is ClaritiHistoryEntry => Boolean(entry));

  if (!kinds || kinds.length === 0) return entries;
  return entries.filter((entry) => kinds.includes(entry.kind));
}

/**
 * The thread a session is, or null when we cannot establish one.
 *
 * A session with documents filed against it in clariti_session_documents is a
 * thread, named by its own id: that join table is where a person's decision to
 * put documents together is recorded, so it is what makes a session a thread in
 * the first place.
 *
 * parent_session_id is consulted only for a session the join table has never
 * heard of — a follow-up chained before membership was direct (0005), whose
 * story is its lineage root's. It is a fallback for old rows and nothing more:
 * being descended from a session is not a statement that two documents belong
 * together.
 */
export async function getSessionThreadId(
  supabase: SupabaseClient,
  ownerId: string,
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clariti_sessions")
    .select("id, parent_session_id")
    .eq("owner_id", ownerId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  // Asked after ownership is proved, so an id that is not this reader's never
  // reaches the join table.
  const { data: links } = await supabase
    .from("clariti_session_documents")
    .select("document_id")
    .eq("session_id", data.id as string)
    .limit(1);

  if ((links ?? []).length > 0) return data.id as string;
  return (data.parent_session_id as string | null) ?? (data.id as string);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every saved analysis in one thread, newest first — one per document in it.
 *
 * Fetched by thread rather than taken out of the recent-documents window: a
 * thread can be months old and still be the story this document belongs to, and
 * a reader with a busy month in between would otherwise have the one document
 * that actually matches fall off the end of the list — which looks exactly like
 * the bug this all replaced.
 *
 * The members are the documents in clariti_session_documents, because that is
 * where the reader's own filing lives. Their readings are then collected from
 * wherever they were written: linking shares a document rather than moving it,
 * so a document someone accepted into this thread keeps its artifact in the
 * session it was read in, and a query over sessions alone would never find it.
 */
export async function getThreadAnalyses(
  supabase: SupabaseClient,
  ownerId: string,
  threadId: string,
  options: { excludeSessionId?: string; limit?: number } = {},
): Promise<ClaritiHistoryEntry[]> {
  const { excludeSessionId, limit = 20 } = options;
  // The id goes into a PostgREST filter string, which has no placeholders.
  if (!UUID_PATTERN.test(threadId)) return [];

  // What is in this thread: the documents a person filed into it.
  const { data: memberLinks, error: memberLinksError } = await supabase
    .from("clariti_session_documents")
    .select("document_id")
    .eq("session_id", threadId);
  if (memberLinksError) return [];

  const documentIds = [...new Set((memberLinks ?? []).map((link) => link.document_id as string))];

  // Where those documents' readings live — their other threads included, since a
  // document shared into this one was read in one of them. The same rows are the
  // membership rowToEntry needs, so they are only fetched once.
  let membership = new Map<string, string[]>();
  const sessionIds = new Set<string>([threadId]);
  if (documentIds.length > 0) {
    const { data: readingLinks } = await supabase
      .from("clariti_session_documents")
      .select("session_id, document_id")
      .in("document_id", documentIds);

    membership = indexThreadsByDocument((readingLinks ?? []) as unknown as SessionDocumentLink[]);
    for (const threads of membership.values()) {
      for (const sessionId of threads) sessionIds.add(sessionId);
    }
  }

  // Legacy fallback: follow-ups chained through parent_session_id (0005), from
  // before a document could be filed into a thread directly. Their artifacts
  // often never recorded which document they read, so nothing above can reach
  // them. Kept as a source of documents to look at, not as a claim — an entry
  // only reads as same-thread if the join table agrees.
  const { data: lineage } = await supabase
    .from("clariti_sessions")
    .select("id")
    .eq("owner_id", ownerId)
    .or(`id.eq.${threadId},parent_session_id.eq.${threadId}`);

  const ownSessionIds = new Set<string>([threadId, ...((lineage ?? []) as Array<{ id: string }>).map((session) => session.id)]);
  for (const id of ownSessionIds) sessionIds.add(id);

  const documentSet = new Set(documentIds);
  const { data, error } = await supabase
    .from("clariti_artifacts")
    .select("id, session_id, kind, title, summary, payload, created_at, clariti_sessions!inner(owner_id, parent_session_id)")
    .eq("clariti_sessions.owner_id", ownerId)
    .in("session_id", [...sessionIds])
    // Fetched wide because the rows that survive the filter below are what the
    // limit counts: a session shared with this thread also holds documents that
    // are not in it, and those must not eat the caller's slots.
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, 40));

  if (error || !data) return [];

  const rows = (data as unknown as ArtifactRow[]).filter((row) => {
    if (excludeSessionId && row.session_id === excludeSessionId) return false;
    const documentId = artifactDocumentId(row.payload);
    // A reading that names its document is in this thread exactly when that
    // document is — wherever the reading itself happens to be stored.
    if (documentId) return documentSet.has(documentId);
    // One that names none was written before threading. It can only be read as
    // part of this thread when it sits in the thread's own sessions, where every
    // document is a member; in a session shared from elsewhere there is no way
    // to tell which document it read, so it is left out rather than guessed at.
    return ownSessionIds.has(row.session_id);
  });

  return rows
    .slice(0, limit)
    .map((row) => rowToEntry(row, membership))
    .filter((entry): entry is ClaritiHistoryEntry => Boolean(entry));
}

/**
 * Why Clariti is willing to put two documents side by side.
 *
 * - `same-thread`   the two documents are filed in one thread already.
 * - `related`       clariti-threads found something concrete in common and can name it.
 * - `same-kind-only` nothing in common but the document type. A guess, and it has
 *                    to be shown as one: a thyroid panel and a diabetes panel are
 *                    both lab_results and measure nothing alike.
 * - `no-shared-signal` nothing at all. Only ever surfaced for a document the
 *                    reader named explicitly, so the answer can say so out loud
 *                    instead of the document quietly disappearing.
 */
export type ComparisonBasis = "same-thread" | "related" | "same-kind-only" | "no-shared-signal";

export type ClaritiComparisonCandidate = {
  entry: ClaritiHistoryEntry;
  basis: ComparisonBasis;
  /**
   * Ranking only. The number comes from clariti-threads and nothing here reads
   * meaning into its scale — the basis and the reasons carry the meaning.
   */
  score: number;
  /** Why this was proposed, in words the reader can check against their own papers. */
  reasons: string[];
};

/** True when Clariti has a basis it can state. A guess is not a basis. */
export function isComparableCandidate(candidate: ClaritiComparisonCandidate) {
  return candidate.basis === "same-thread" || candidate.basis === "related";
}

const BASIS_RANK: Record<ComparisonBasis, number> = {
  "same-thread": 0,
  related: 1,
  "same-kind-only": 2,
  "no-shared-signal": 3,
};

/**
 * Earlier documents worth offering as a comparison, best first.
 *
 * This used to be "other sessions with the same analysis.kind", which is wrong
 * in both directions: two lab panels of different organs are the same kind and
 * measure nothing alike, while a bill and its EOB are different kinds and are
 * the single most useful pairing the product has. Thread membership is the
 * reader's own statement that two documents belong together, so it ranks first;
 * everything outside the thread is ranked by clariti-threads and is a proposal,
 * never a link.
 */
export async function findComparisonCandidates(
  supabase: SupabaseClient,
  ownerId: string,
  options: {
    analysis: ClaritiAnalysis;
    sessionId?: string;
    threadId?: string | null;
    /**
     * The current document's own saved artifact. Named rather than inferred
     * because a thread is one session over many documents, so "not this one"
     * cannot mean "not this session" — that would throw away the rest of the
     * thread, which is the whole point of looking.
     */
    excludeArtifactId?: string;
    /**
     * Session or artifact ids that must appear in the result even with no basis
     * at all, so a document the reader named by hand gets an honest answer
     * rather than being dropped on the floor.
     */
    alwaysInclude?: string[];
    limit?: number;
  },
): Promise<ClaritiComparisonCandidate[]> {
  const { analysis, sessionId, threadId, excludeArtifactId, alwaysInclude = [], limit = 10 } = options;

  // Deliberately no `kinds` filter. Kind was the old proxy for relatedness and
  // it is the thing this function exists to stop using. Neither query excludes
  // the current session either — see `excludeArtifactId`.
  const [inThread, recent] = await Promise.all([
    threadId ? getThreadAnalyses(supabase, ownerId, threadId) : [],
    getRecentClaritiAnalyses(supabase, ownerId, { limit: Math.max(limit * 4, 40) }),
  ]);

  const seen = new Set<string>();
  const entries = [...inThread, ...recent].filter((entry) => {
    if (seen.has(entry.artifactId)) return false;
    seen.add(entry.artifactId);
    return !isSameDocument(entry, { analysis, sessionId, excludeArtifactId });
  });

  const current: ThreadDocument = {
    id: sessionId ?? "current",
    kind: analysis.kind,
    title: analysis.title,
    createdAt: new Date().toISOString(),
    analysis,
  };

  const scored = entries.map((entry) => scoreCandidate(entry, current, threadId ?? null));
  const kept = scored.filter(
    (candidate) =>
      candidate.basis !== "no-shared-signal"
      || alwaysInclude.includes(candidate.entry.artifactId)
      || alwaysInclude.includes(candidate.entry.sessionId),
  );

  kept.sort((a, b) => {
    const byBasis = BASIS_RANK[a.basis] - BASIS_RANK[b.basis];
    if (byBasis !== 0) return byBasis;
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.createdAt.localeCompare(a.entry.createdAt);
  });

  return kept.slice(0, limit);
}

function scoreCandidate(
  entry: ClaritiHistoryEntry,
  current: ThreadDocument,
  threadId: string | null,
): ClaritiComparisonCandidate {
  if (threadId && entry.threadIds.includes(threadId)) {
    // Thread membership is a fact about the reader's own filing — a row in
    // clariti_session_documents they put there — not something Clariti worked
    // out, so it outranks everything below. The reason says what is true of the
    // data and stops there — it does not tell the reader what they meant by
    // putting the two together.
    return {
      entry,
      basis: "same-thread",
      score: 0,
      reasons: ["It is in the same thread as the document you are reading."],
    };
  }

  // The gate is `analysis`: it is non-null only for a payload that was a real,
  // whole read. The facts handed to the scorer are the entry's own — same
  // payload, and the entry is what every other caller of clariti-threads passes
  // too, so what gets scored here is what gets scored there.
  const scored = entry.analysis ? scoreThreadRelatedness(current, toThreadDocument(entry)) : null;
  const score = scored?.score ?? 0;
  // Narrowed on the tag, not read off the union. `unsure` deliberately carries
  // `weakSignals`/`whyNot` rather than `reasons`, precisely so evidence Clariti
  // refused to act on cannot be rendered as though it had acted on it.
  const reasons = scored?.verdict === "related" ? scored.reasons : [];

  // A score with no reason attached is not something we can put in front of a
  // reader, so it does not count as a basis either.
  if (score > 0 && reasons.length > 0) return { entry, basis: "related", score, reasons };

  // "unknown" is not a kind, it is the absence of one — two documents Clariti
  // failed to classify have nothing in common except that failure.
  if (entry.kind === current.kind && entry.kind !== "unknown") {
    return {
      entry,
      basis: "same-kind-only",
      score,
      reasons: [
        `Both are the same kind of document (${getClaritiKindMeta(entry.kind).documentNoun}). That is all Clariti found in common, so this is a guess rather than a match.`,
      ],
    };
  }

  return { entry, basis: "no-shared-signal", score, reasons: [] };
}

/**
 * The document being read, in the list of documents to compare it against.
 *
 * Callers that know their artifact id say so. The fallback matches the row this
 * analysis was saved as — same session, same title, same summary — and is
 * deliberately willing to drop an exact duplicate too: a document compared with
 * a copy of itself reports no change, which reads as reassurance and is not.
 */
function isSameDocument(
  entry: ClaritiHistoryEntry,
  options: { analysis: ClaritiAnalysis; sessionId?: string; excludeArtifactId?: string },
) {
  if (options.excludeArtifactId) return entry.artifactId === options.excludeArtifactId;
  return Boolean(options.sessionId)
    && entry.sessionId === options.sessionId
    && entry.title === options.analysis.title
    && entry.summary === options.analysis.summary;
}

function toThreadDocument(entry: ClaritiHistoryEntry): ThreadDocument {
  return {
    id: entry.sessionId,
    kind: entry.kind,
    title: entry.title,
    createdAt: entry.createdAt,
    analysis: {
      summary: entry.summary,
      plainEnglish: entry.plainEnglish,
      // The quotes are the point: a claim or accession number only survives the
      // trip through the database inside one of them.
      sourceAnchors: entry.sourceAnchors,
      keyPoints: entry.keyPoints,
      metrics: entry.metrics,
      flags: entry.flags,
    },
  };
}

function rowToEntry(row: ArtifactRow, membership: Map<string, string[]>): ClaritiHistoryEntry | null {
  const payload = row.payload ?? {};
  const kind = isClaritiAnalysisKind(payload.kind) ? payload.kind : isClaritiAnalysisKind(row.kind) ? row.kind : "unknown";
  const session = Array.isArray(row.clariti_sessions) ? row.clariti_sessions[0] : row.clariti_sessions;
  const documentId = artifactDocumentId(row.payload);
  const filedIn = documentId ? membership.get(documentId) ?? [] : [];
  // Nothing in the join table speaks for a reading that never recorded its
  // document: it was written before threading. The session it was written in is
  // the thread it is in, and 0005's parent named that story before membership
  // was direct, so both are kept. This is the only place lineage counts.
  const lineageRoot = session?.parent_session_id ?? null;
  return {
    sessionId: row.session_id,
    artifactId: row.id,
    documentId,
    threadIds: filedIn.length > 0
      ? filedIn
      : lineageRoot ? [row.session_id, lineageRoot] : [row.session_id],
    kind,
    title: row.title,
    summary: row.summary,
    plainEnglish: typeof payload.plainEnglish === "string" ? payload.plainEnglish : "",
    sourceAnchors: Array.isArray(payload.sourceAnchors) ? payload.sourceAnchors : [],
    keyPoints: Array.isArray(payload.keyPoints) ? payload.keyPoints : [],
    metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
    flags: Array.isArray(payload.flags) ? payload.flags : [],
    analysis: toSavedAnalysis(row.payload, kind),
    createdAt: row.created_at,
  };
}

/**
 * The saved payload as a whole analysis, or null.
 *
 * Null for a `degraded` payload on purpose: that is the regex fallback, not a
 * reading of the document, and relatedness worked out from its generic key
 * points would be Clariti asserting that two of someone's records belong
 * together on the strength of text it never actually read. Such a document can
 * still be compared inside its own thread, where the relationship is the
 * reader's statement rather than ours.
 *
 * Checked rather than cast: these rows are years of accumulated jsonb, and a
 * half-written one reaching scoreThreadRelatedness as if it were whole is how
 * you get a confident match out of two empty documents.
 */
function toSavedAnalysis(payload: Partial<ClaritiAnalysis> | null, kind: ClaritiAnalysisKind): ClaritiAnalysis | null {
  if (!payload) return null;
  if ((payload as { degraded?: unknown }).degraded === true) return null;

  const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  const filled = (value: unknown) => Array.isArray(value) && value.length > 0;

  if (!text(payload.title) || !text(payload.summary) || !text(payload.plainEnglish) || !text(payload.safetyNote)) return null;
  if (!filled(payload.sourceAnchors) || !filled(payload.keyPoints)) return null;
  if (!filled(payload.questions) || !filled(payload.nextActions)) return null;

  return {
    ...(payload as ClaritiAnalysis),
    kind,
    metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
    flags: Array.isArray(payload.flags) ? payload.flags : [],
  };
}

const COMPARE_INTENT_PATTERN =
  /\b(compare|comparison|vs\.?|versus|change[sd]?|difference|different|trend|improv(?:e|ed|ing)|worsen(?:ed|ing)?|before and after|prior (?:lab|labs|bill|scan|result)|previous (?:lab|labs|bill|scan|result|visit)|last (?:lab|labs|bill|scan|time)|earlier (?:lab|labs|bill|scan|result|document)|since (?:my|the) last|over time|(?:went|gone) (?:up|down)|higher or lower)\b/i;

export function hasCompareIntent(text: string) {
  return COMPARE_INTENT_PATTERN.test(text);
}
