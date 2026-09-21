import { NextRequest, NextResponse } from "next/server";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { getRecentClaritiAnalyses, getThreadAnalyses, type ClaritiHistoryEntry } from "@/lib/domain/clariti-history";
import { suggestThreadLinks, type Thread, type ThreadDocument } from "@/lib/domain/clariti-threads";
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
  // The document the reader has open, which is the one the workspace renders: newest
  // first, the same order /api/sessions returns and the same row the page reads as
  // `documents[0]`. Proposals are about the document in front of them.
  const candidate = openThreadDocumentIds
    .flatMap((documentId) => {
      const entry = entryByDocumentId.get(documentId);
      if (!entry?.analysis) return [];
      return [toThreadDocument(documentId, documentCreatedAt.get(documentId) ?? entry.createdAt, entry, entry.analysis)];
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];

  if (!candidate) {
    // Nothing readable to compare from — an empty thread, or one whose documents only
    // ever got the fallback text. Both lists are empty, which shows the reader nothing
    // rather than telling them Clariti looked and found nothing.
    return NextResponse.json({ ok: true, proposals: [], unsure: [] });
  }

  const suggestions = suggestThreadLinks(candidate, threads);
  const alreadyHere = new Set(openThreadDocumentIds);

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
