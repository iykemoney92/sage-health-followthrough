import { NextRequest, NextResponse } from "next/server";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { getRecentClaritiAnalyses, getThreadAnalyses, type ClaritiHistoryEntry } from "@/lib/domain/clariti-history";
import { scoreThreadRelatedness, suggestThreadLinks, type Thread, type ThreadDocument } from "@/lib/domain/clariti-threads";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/**
 * What Clariti would say about the thread a reader has open: documents elsewhere in
 * their library that look like they belong in it, and the threads it looked at and
 * would not call.
 *
 * This route only ever *proposes*. It writes nothing. Thread membership is one row in
 * clariti_session_documents and PATCH /api/sessions owns it, reached when the reader
 * presses Add — because a thread decides what the agent reads together, and a link
 * Clariti made on its own would have it reason across documents that may not belong
 * together and state relationships that do not exist.
 *
 * `unsure` is returned alongside `proposals` for the same reason the rest of this
 * codebase says "Clariti does not know" out loud: an empty proposals list on its own
 * reads as "nothing else of yours is about this", which is a stronger claim than
 * looking at a few threads entitles anyone to make.
 *
 * `disagreements` is the one thing here about the thread the reader already has rather
 * than about what to add to it: two of its documents stating different figures for the
 * same quantity, two different amounts owed most usefully of all. It is computed here
 * and nowhere else on purpose — the workspace renders these and deliberately does not
 * work out for itself what disagrees, so that what a reader is told two documents
 * contradict each other about is decided in one place, under the rules below.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How much of the library one request reads. A bound has to exist — these are whole
 * saved analyses, and a shoebox of paperwork would otherwise be pulled in full to draw
 * one rail. It is deliberately loose rather than tight: what falls outside it is a
 * thread Clariti never looked at, and that thread is then absent from `unsure` too, so
 * the rail stays quiet about it rather than claiming it was considered.
 */
const ANALYSIS_LIMIT = 100;
const THREAD_LIMIT = 50;

export async function GET(request: NextRequest) {
  // Unconditional, like /api/analyze and PATCH /api/sessions: this reads across a
  // person's whole medical library, so a missing Supabase env var is a broken deploy,
  // not permission to browse one.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ ok: false, error: "Clariti needs a thread to look at." }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();

  // Ownership, half one: the thread. Checked here rather than left to RLS, which
  // answers a policy violation where the explanation should be. One answer for "no such
  // thread" and for "not yours", so the route never confirms somebody else's id exists.
  const { data: openThread, error: openThreadError } = await supabase
    .from("clariti_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (openThreadError) {
    return NextResponse.json({ ok: false, error: "Clariti could not read this thread. Please try again." }, { status: 500 });
  }
  if (!openThread) {
    return NextResponse.json({ ok: false, error: "Clariti could not find that thread in your account." }, { status: 404 });
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("clariti_sessions")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(THREAD_LIMIT);

  if (sessionsError) {
    return NextResponse.json({ ok: false, error: "Clariti could not read your threads. Please try again." }, { status: 500 });
  }

  // The open thread goes in first, so it is in the set whatever the bound above drops.
  // It has to be: suggestThreadLinks skips a thread that already holds the candidate,
  // and that skip is the only thing stopping this thread's own documents from being
  // proposed back into it.
  const threadRows = new Map<string, { id: string; title: string }>();
  threadRows.set(openThread.id as string, { id: openThread.id as string, title: (openThread.title as string) ?? "" });
  for (const row of sessionRows ?? []) {
    threadRows.set(row.id as string, { id: row.id as string, title: (row.title as string) ?? "" });
  }

  const { data: links, error: linksError } = await supabase
    .from("clariti_session_documents")
    .select("session_id, document_id")
    .in("session_id", [...threadRows.keys()]);

  if (linksError) {
    return NextResponse.json({ ok: false, error: "Clariti could not read what is in your threads. Please try again." }, { status: 500 });
  }

  const linkedDocumentIds = [...new Set((links ?? []).map((link) => link.document_id as string))];

  // Ownership, half two: the documents. A join row is two ids pointing at two tables,
  // and "is this thread mine" and "is this document mine" are separate questions — the
  // row that answers yes to one and no to the other is exactly what must not be read
  // back as though it were a document of this person's.
  //
  // `extracted_text` is pointedly not selected. Nothing here reads a document's text;
  // the scorer works off the saved analysis, and pulling the library's full text to
  // rank a handful of proposals would cost the same as shipping it.
  const { data: documentRows, error: documentsError } = linkedDocumentIds.length > 0
    ? await supabase
      .from("clariti_documents")
      .select("id, created_at")
      .in("id", linkedDocumentIds)
      .eq("owner_id", user.id)
    : { data: [], error: null };

  if (documentsError) {
    return NextResponse.json({ ok: false, error: "Clariti could not read your documents. Please try again." }, { status: 500 });
  }

  const documentCreatedAt = new Map((documentRows ?? []).map((document) => [document.id as string, String(document.created_at)] as const));

  const documentIdsByThread = new Map<string, string[]>();
  for (const link of links ?? []) {
    const documentId = link.document_id as string;
    // A link whose document did not come back belongs to someone else's document or to
    // one that is gone. It is dropped rather than carried as a nameless member of a
    // thread, which would make the thread look fuller than it is.
    if (!documentCreatedAt.has(documentId)) continue;
    const threadId = link.session_id as string;
    const existing = documentIdsByThread.get(threadId);
    if (existing) existing.push(documentId);
    else documentIdsByThread.set(threadId, [documentId]);
  }

  // The open thread is fetched by id as well as by recency: it can be months old and
  // still be the thread being read, and a reader with a busy year in between would
  // otherwise have the document they are actually looking at fall off the recent window.
  const [openThreadEntries, recentEntries] = await Promise.all([
    getThreadAnalyses(supabase, user.id, sessionId, { limit: ANALYSIS_LIMIT }),
    getRecentClaritiAnalyses(supabase, user.id, { limit: ANALYSIS_LIMIT }),
  ]);

  // Keyed by document, not by session. A thread holds several documents now, so a
  // session id no longer names one of them — and an artifact follows its document when
  // that document is unlinked, so the reading for a document can sit in any thread the
  // document is in.
  const entryByDocumentId = new Map<string, ClaritiHistoryEntry>();
  // Sorted rather than trusted: the two queries overlap, so concatenating them leaves
  // the newest reading of a document behind whichever list it happened to land in first.
  const entries = [...openThreadEntries, ...recentEntries].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
  for (const entry of entries) {
    if (!entry.analysis) continue;
    const documentId = analysedDocumentId(entry, documentIdsByThread.get(entry.sessionId) ?? []);
    if (!documentId || !documentCreatedAt.has(documentId)) continue;
    // Newest first now, so the first reading of a document is its current one.
    if (!entryByDocumentId.has(documentId)) entryByDocumentId.set(documentId, entry);
  }

  const threadDocuments = (threadId: string): ThreadDocument[] =>
    (documentIdsByThread.get(threadId) ?? []).flatMap((documentId) => {
      const entry = entryByDocumentId.get(documentId);
      // A document Clariti never managed to read — or read only with the regex
      // fallback, which clariti-history deliberately returns as no analysis at all —
      // has nothing to score. Leaving it out is why a thread of such documents is
      // never proposed rather than proposed on the strength of text nobody read.
      if (!entry?.analysis) return [];
      return [toThreadDocument(documentId, documentCreatedAt.get(documentId) ?? entry.createdAt, entry, entry.analysis)];
    });

  const threads: Thread[] = [...threadRows.values()].map((row) => ({
    id: row.id,
    title: row.title,
    // Full document lists, never pre-filtered. A thread is skipped precisely because it
    // already holds the candidate, so quietly removing the candidate from it first would
    // turn that skip into a proposal to file a document into the thread it is already in.
    documents: threadDocuments(row.id),
  }));

  const openThreadDocumentIds = documentIdsByThread.get(sessionId) ?? [];
  // Newest first, the same order /api/sessions returns and the same row the page reads
  // as `documents[0]`. The whole list is kept rather than just its head: proposals are
  // about the document in front of the reader, but a figure two documents state
  // differently is a fact about the story, so disagreements are read across all of it.
  const openThreadDocuments = openThreadDocumentIds
    .flatMap((documentId) => {
      const entry = entryByDocumentId.get(documentId);
      if (!entry?.analysis) return [];
      return [toThreadDocument(documentId, documentCreatedAt.get(documentId) ?? entry.createdAt, entry, entry.analysis)];
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const candidate = openThreadDocuments[0];

  if (!candidate) {
    // Nothing readable to compare from — an empty thread, or one whose documents only
    // ever got the fallback text. All three lists are empty, which shows the reader
    // nothing rather than telling them Clariti looked and found nothing.
    return NextResponse.json({ ok: true, proposals: [], unsure: [], disagreements: [] });
  }

  const suggestions = suggestThreadLinks(candidate, threads);
  const alreadyHere = new Set(openThreadDocumentIds);
  // Only documents already in this thread. A figure on a document Clariti is merely
  // proposing contradicts nothing yet: nobody has said those two documents are about
  // the same episode of care, and reporting that they disagree would decide that for
  // them — the same link-without-asking this whole route exists to refuse.
  const disagreements = findThreadDisagreements(openThreadDocuments);

  return NextResponse.json({
    ok: true,
    proposals: suggestions.proposals
      // Linking shares rather than moves, so a document accepted into this thread stays
      // in the one it came from — and that thread would go on matching it forever.
      // Proposing a document already sitting in this thread is an Add button that does
      // nothing, so it is dropped here rather than in the browser.
      .filter((proposal) => !alreadyHere.has(proposal.matchedDocument.id))
      .map((proposal) => ({
        ...proposal,
        // Said plainly rather than left to be dug out of `matchedDocument`: pressing Add
        // sends this to PATCH /api/sessions, which links by clariti_documents id.
        documentId: proposal.matchedDocument.id,
        document: proposal.matchedDocument,
      })),
    unsure: suggestions.unsure,
    disagreements,
  });
}

/**
 * The document a reading was written for.
 *
 * clariti-history reads this out of the payload jsonb, which is the only place there is:
 * clariti_artifacts has no column for it and nobody can apply a migration to this project.
 */
function analysedDocumentId(entry: ClaritiHistoryEntry, documentIdsInSession: string[]): string | null {
  if (entry.documentId) return entry.documentId;
  // Null on artifacts saved before threading, when a session held one document and the
  // question could not come up. Where that is still true the reading can only be of that
  // document; where the thread has since gained others there is no way to tell, and
  // guessing would file one document's claim number under another document's name.
  return documentIdsInSession.length === 1 ? documentIdsInSession[0] : null;
}

function toThreadDocument(
  documentId: string,
  createdAt: string,
  entry: ClaritiHistoryEntry,
  analysis: ClaritiAnalysis,
): ThreadDocument {
  return {
    // Threaded by document rather than by session, because the reader's Add button acts
    // on a document and a thread now holds several of them.
    id: documentId,
    kind: entry.kind,
    title: entry.title,
    createdAt,
    // The whole saved analysis, not the entry's flattened key points and metrics: the
    // scorer leans on `sourceAnchors`, which are verbatim quotes, so a claim or accession
    // number survives into them intact where a summary would have paraphrased it away.
    // Pass the flattened fields instead and identifier matching has nothing to match on,
    // and almost everything lands in `unsure`.
    analysis,
  };
}

/**
 * Two documents in one thread that do not say the same thing about one figure.
 *
 * Shaped for the workspace, which renders these and computes none of them itself: a
 * label, every document's own value with the document it came from, and a note carrying
 * the reason Clariti believes the two figures are about the same thing. No score, and
 * no verdict on which is right — a reader who can see both numbers, both document names
 * and the reference tying them together can check this and overrule it, and that is the
 * only form this finding is allowed to take.
 */
type ThreadDisagreement = {
  id: string;
  label: string;
  note: string | null;
  values: Array<{ documentTitle: string; value: string }>;
};

type AmountConcept = { concept: string; aliases: Set<string> };

/**
 * Money figures that two views of one claim are meant to agree on, and the different
 * names paperwork gives them. The bill says "Amount you owe", the Explanation of
 * Benefits says "Patient responsibility"; they are one quantity, and when they differ
 * that difference is the most useful thing this product can catch.
 *
 * Note which way this cuts against clariti-threads. `normalizeMetricLabel` there throws
 * exactly these labels away as non-distinctive, and is right to: every bill ever
 * printed carries "amount due", so matching two documents on it would call a
 * dermatology bill and a cardiology bill one story. Here they are the whole point,
 * because the question is a different one. There it is "are these the same episode";
 * here it is "given that they are, do they agree" — and the first question is answered,
 * by the same rule and the same extractor, before this one is ever asked.
 *
 * Left out deliberately:
 *
 * - Deductible and coinsurance. Both appear as a per-claim figure on an EOB and as an
 *   annual plan figure elsewhere, and nothing in the label says which this one is, so
 *   "Deductible $0" against "Deductible $250" would be a contradiction Clariti invented
 *   out of two true statements.
 * - Dates of service, which a bill may state as a range and an EOB as a single day.
 * - Anything measured rather than billed. Two haemoglobin readings months apart are a
 *   history, not a contradiction; clariti-progression is where a change over time
 *   belongs, and flagging one here would tell somebody their lab results disagree when
 *   what actually happened is that they got better.
 */
const COMPARABLE_AMOUNTS: AmountConcept[] = [
  {
    // First because it is the one that matters: this is the number a person pays.
    // What the payer decided the patient owes. An assessment, made once.
    concept: "patient_responsibility",
    aliases: new Set([
      "patient responsibility", "patient responsibility estimate", "estimated patient responsibility",
      "your responsibility", "your share", "your share of the cost", "patient portion", "your portion",
      "due from patient", "what you owe", "you owe",
    ]),
  },
  {
    // What is still outstanding today. A running figure that moves as payments land,
    // so it legitimately differs from the assessed share above — a part-paid bill has
    // a smaller balance than the responsibility the EOB assessed, and calling that a
    // disagreement would send someone to argue a bill they actually owe. Kept as its
    // own concept so two balances can still be compared against each other.
    concept: "balance_due",
    aliases: new Set([
      "balance due", "amount due", "total due", "amount now due", "patient balance",
      "patient due", "amount payable", "amount to pay", "pay this amount",
      "please pay this amount", "you pay", "patient pays", "amount you owe",
    ]),
  },
  {
    concept: "billed",
    aliases: new Set([
      "amount billed", "billed amount", "billed", "billed charges", "amount charged", "charged amount",
      "total charges", "charges", "total charged", "gross charges", "provider charged", "provider charges",
      "submitted charges", "submitted amount", "amount submitted",
    ]),
  },
  {
    concept: "allowed",
    aliases: new Set([
      "allowed amount", "amount allowed", "allowed", "allowed charges", "plan allowed", "eligible amount",
      "eligible charges", "approved amount", "amount approved", "negotiated rate", "contracted rate",
    ]),
  },
  {
    concept: "plan_paid",
    aliases: new Set([
      "insurance paid", "insurer paid", "plan paid", "your plan paid", "health plan paid", "carrier paid",
      "payer paid", "benefits paid", "insurance payment", "plan payment", "paid by insurance", "paid by plan",
      "paid by your plan", "amount paid by insurance", "amount paid by plan", "amount paid by your plan",
      "total paid by plan",
    ]),
  },
  {
    // A copay is per visit wherever it is printed, so unlike a deductible it cannot be
    // an annual figure on one document and a per-claim figure on the other.
    concept: "copay",
    aliases: new Set(["copay", "co pay", "copayment", "co payment", "copay amount", "copayment amount"]),
  },
];

/**
 * Currencies, only where the document names one outright. A bare "$" is deliberately
 * unknown — it is US, Canadian and Australian dollars at once — because the point of
 * reading currency at all is to refuse a comparison, and refusing on a guess would
 * silence a real disagreement between two ordinary dollar bills.
 */
const CURRENCIES: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\busd\b|\bus\s*\$|\bus dollars?\b/i, code: "USD" },
  { pattern: /\bcad\b|\bca\s*\$/i, code: "CAD" },
  { pattern: /\baud\b|\bau\s*\$/i, code: "AUD" },
  { pattern: /\bgbp\b|£/i, code: "GBP" },
  { pattern: /\beur\b|€/i, code: "EUR" },
  { pattern: /\bngn\b|₦/i, code: "NGN" },
  { pattern: /\binr\b|₹/i, code: "INR" },
  { pattern: /\bjpy\b|¥/i, code: "JPY" },
];

/**
 * One number, with or without thousands separators. Written to match a whole figure so
 * that a string carrying two of them — "$340.00 of $1,200.00" — matches twice and is
 * then refused rather than read as whichever one came first. "1.234,56" falls out the
 * same way, as two matches, which is the honest outcome: Clariti does not know whether
 * that is one thousand or one point two.
 */
const AMOUNT_PATTERN = /-?\d[\d,]*(?:\.\d+)?/g;

/** Enough to say what is wrong without turning the rail into a wall of cards. */
const MAX_DISAGREEMENTS = 6;

type AmountClaim = { label: string; value: string; cents: number; currency: string | null; caveat: string | null };

/**
 * Figures two documents in one thread state differently for the same quantity.
 *
 * The bar is high and the silence is the design. A false disagreement sends somebody to
 * argue a bill they actually owe, or to sit on one believing the EOB had settled it,
 * and that is a worse outcome than Clariti saying nothing — so a difference is reported
 * only when both sides are demonstrably the same quantity about the same event, and
 * every number the reader is shown is the one their own document printed.
 */
function findThreadDisagreements(documents: ThreadDocument[]): ThreadDisagreement[] {
  if (documents.length < 2) return [];

  // The gate, and the reason this stays quiet most of the time: two documents are only
  // compared when they carry the same episode-scoped reference — the claim, invoice or
  // authorisation number that makes them two views of one event. Sharing a thread is
  // not that. A year-long insurance appeal holds three bills for three visits, and
  // three different amounts owed across them is three correct bills; calling that a
  // contradiction is exactly the harm this feature is able to do.
  const ties: Array<{ first: number; second: number; reason: string }> = [];
  for (let first = 0; first < documents.length; first += 1) {
    for (let second = first + 1; second < documents.length; second += 1) {
      const reason = sharedEpisodeReason(documents[first], documents[second]);
      if (reason) ties.push({ first, second, reason });
    }
  }
  if (ties.length === 0) return [];

  const found: ThreadDisagreement[] = [];

  for (const concept of COMPARABLE_AMOUNTS) {
    const claims = documents.map((document) => amountClaimFor(document, concept));

    const edges = ties.filter((tie) => {
      const first = claims[tie.first];
      const second = claims[tie.second];
      if (!first || !second) return false;
      // Two currencies are not two answers to one question. Refused only when both
      // documents actually name one, so "$340.00" against "340 USD" stays one figure
      // written twice rather than becoming a disagreement about nothing.
      if (first.currency && second.currency && first.currency !== second.currency) return false;
      return first.cents !== second.cents;
    });
    if (edges.length === 0) continue;

    // Grouped by the episode that tied the documents, not by transitive closure over
    // the edges. A union-find lets one document carrying two reference numbers bridge
    // two separately-gated pairs, and the card then reports figures from two different
    // episodes of care as contradicting each other — which is the false disagreement
    // this whole path is built to avoid. A document that genuinely belongs to two
    // episodes now appears in both groups, which is the truth about it.
    const byEpisode = new Map<string, Set<number>>();
    for (const edge of edges) {
      const members = byEpisode.get(edge.reason) ?? new Set<number>();
      members.add(edge.first);
      members.add(edge.second);
      byEpisode.set(edge.reason, members);
    }

    for (const group of [...byEpisode.values()].map((members) => [...members])) {
      // Newest document first: where one figure supersedes another, the current one is
      // the one the reader sees at the top.
      const members = group
        .map((index) => ({ index, claim: claims[index] as AmountClaim }))
        .sort((one, other) => documents[other.index].createdAt.localeCompare(documents[one.index].createdAt));

      const values: Array<{ documentTitle: string; value: string }> = [];
      const kept: Array<{ index: number; claim: AmountClaim }> = [];
      const seen = new Set<string>();
      for (const member of members) {
        const documentTitle = documents[member.index].title.trim();
        // A figure with no document name beside it cannot be checked against anything,
        // and an unattributed number is the one thing this card must never show.
        if (!documentTitle || !member.claim.value) continue;
        kept.push(member);
        const key = JSON.stringify([documentTitle, member.claim.value]);
        if (seen.has(key)) continue;
        seen.add(key);
        values.push({ documentTitle, value: member.claim.value });
      }
      if (values.length < 2) continue;
      if (new Set(kept.map((member) => member.claim.cents)).size < 2) continue;

      // The words each document printed, not a name of Clariti's own. The whole claim
      // being made is that one thing is called two things, so the reader has to be able
      // to find both of them on their own paperwork.
      const printed: string[] = [];
      for (const member of kept) {
        if (member.claim.label && !printed.includes(member.claim.label)) printed.push(member.claim.label);
      }
      if (printed.length === 0) continue;

      const tie = edges.find((edge) => group.includes(edge.first) && group.includes(edge.second));
      const caveats = kept
        .filter((member) => member.claim.caveat)
        .slice(0, 2)
        .map((member) => `${documents[member.index].title.trim()} notes: “${member.claim.caveat}”.`);

      found.push({
        id: `${concept.concept}-${group.map((index) => documents[index].id).sort().join("-")}`,
        label: printed.slice(0, 3).join(" / "),
        // Why Clariti thinks these are one figure, in the reader's own reference number,
        // plus anything either document said about its own number. A caveat like "this
        // is not a bill" is the difference between a disagreement and a
        // misunderstanding, and withholding it would be the confident-sounding version.
        note: [tie?.reason ?? null, ...caveats].filter(Boolean).join(" ") || null,
        values,
      });
    }
  }

  return found.slice(0, MAX_DISAGREEMENTS);
}

/**
 * The reference number tying two documents to one episode of care, in the words the
 * scorer would use to explain it — or null, which is most pairs.
 *
 * Read back off the evidence rather than re-derived. clariti-threads does not export
 * its extractor on its own and should not have to: there needs to be one definition of
 * what counts as an episode reference, and one place where "claim" is an episode while
 * "member" is only a person. A second copy here would drift from it the first time
 * either was tuned, and the copy that drifts is the one comparing people's money.
 */
function sharedEpisodeReason(first: ThreadDocument, second: ThreadDocument): string | null {
  const tie = scoreThreadRelatedness(first, second).evidence.find((item) => item.signal === "episode_identifier");
  return tie?.reason ?? null;
}

/**
 * What one document says this quantity is — or null, meaning it is not to be compared.
 *
 * Read out of `metrics` and nowhere else. A metric is the only place the analysis keeps
 * a label and a value as separate fields, so it is the only place Clariti knows which
 * number a label names. Pulling a figure out of a key point's prose means picking one
 * number out of a sentence that may hold several — "your responsibility is not stated;
 * the plan allowed $1,200" — and picking wrong there manufactures a disagreement out of
 * a document that never disagreed with anything.
 */
function amountClaimFor(document: ThreadDocument, concept: AmountConcept): AmountClaim | null {
  let claim: AmountClaim | null = null;

  for (const metric of document.analysis.metrics) {
    if (conceptForLabel(metric.label) !== concept.concept) continue;

    const amount = readAmount(metric.value);
    // Stated, but not in a form Clariti can compare: "see reverse", "varies", a range,
    // two figures in one string. The document does say something about this quantity
    // and Clariti cannot tell what, so it sits the comparison out entirely rather than
    // being represented by whichever other line it happens to carry.
    if (!amount) return null;
    if (claim) {
      // The document states this quantity twice and contradicts itself. That is a
      // disagreement inside one document, which is not what this finding is about and
      // not something a second document can settle.
      if (claim.cents !== amount.cents) return null;
      continue;
    }

    claim = {
      label: metric.label.trim().replace(/[\s:]+$/, ""),
      // Shown exactly as the document's own reading printed it, never the normalised
      // number: the reader is being asked to check this against the page in their hand.
      value: metric.value.trim(),
      cents: amount.cents,
      currency: amount.currency,
      caveat: readCaveat(metric.caveat),
    };
  }

  return claim;
}

/**
 * Fold the differences that are wording rather than meaning, so "Amount you owe" and
 * "Patient responsibility" land on the same quantity. Anything not in the table above
 * returns null and is never compared — the list is short on purpose, and a label
 * Clariti does not recognise is one it cannot promise names the same thing twice.
 */
function conceptForLabel(label: string): string | null {
  const normalized = label
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return null;

  const withoutTotal = normalized.replace(/^total\s+/, "");
  const variants = [
    normalized,
    withoutTotal,
    normalized.replace(/\s+amount$/, ""),
    withoutTotal.replace(/\s+amount$/, ""),
  ];

  for (const entry of COMPARABLE_AMOUNTS) {
    if (variants.some((variant) => entry.aliases.has(variant))) return entry.concept;
  }
  return null;
}

/**
 * A figure, in whole cents, plus the currency if the document named one.
 *
 * Normalised only as far as spelling goes: a currency symbol, thousands separators and
 * trailing zeroes are how a number is written, so "$340.00", "340 USD" and "$340" are
 * one amount. Anything Clariti cannot resolve to exactly one number is null, because
 * the alternative is choosing one — and a disagreement built on the wrong half of
 * "$340.00 of $1,200.00" is a disagreement about nothing.
 */
function readAmount(raw: string): { cents: number; currency: string | null } | null {
  const text = raw.trim();
  // A percentage is a share of something, not the something. "Coinsurance 20%" and
  // "Coinsurance $64.00" are both true of one claim.
  if (!text || text.includes("%")) return null;

  const numbers = [...text.matchAll(AMOUNT_PATTERN)];
  if (numbers.length !== 1) return null;

  const value = Number(numbers[0][0].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;

  return { cents: Math.round(value * 100), currency: CURRENCIES.find((entry) => entry.pattern.test(text))?.code ?? null };
}

function readCaveat(caveat: string | undefined): string | null {
  const text = (caveat ?? "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  if (!text) return null;
  return text.length > 140 ? `${text.slice(0, 139).trimEnd()}…` : text;
}

