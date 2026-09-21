import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionSchema } from "@/lib/schemas/clariti";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

/**
 * A session is a thread: clariti_session_documents has always been a many-to-many join,
 * it was simply only ever given one document per session. PATCH is how a document is
 * added to a thread it was not analysed into, or taken back out again.
 */
const threadMembershipSchema = z.object({
  action: z.enum(["link", "unlink"]),
  sessionId: z.string().uuid(),
  documentId: z.string().uuid(),
});

/**
 * The document an artifact was written for. /api/analyze stores it inside the payload
 * jsonb because clariti_artifacts has no column for it and nobody can apply a migration
 * to this project right now. Null on artifacts saved before threading, where the session
 * held one document and the question could not come up.
 */
function artifactDocumentId(payload: unknown) {
  const documentId = (payload as { documentId?: unknown } | null)?.documentId;
  return typeof documentId === "string" ? documentId : null;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: true, sessions: [] });

  const supabase = await getSupabaseSessionClient();
  let sessionId = request.nextUrl.searchParams.get("sessionId");
  const documentId = request.nextUrl.searchParams.get("documentId");

  if (documentId && !sessionId) {
    const { data: links, error: linksError } = await supabase
      .from("clariti_session_documents")
      .select("session_id")
      .eq("document_id", documentId);

    if (linksError) {
      return NextResponse.json({ ok: false, error: linksError.message }, { status: 500 });
    }

    const linkedSessionIds = (links ?? []).map((link) => link.session_id as string);
    if (linkedSessionIds.length === 0) {
      return NextResponse.json({ ok: true, session: null });
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from("clariti_sessions")
      .select("id")
      .eq("owner_id", user.id)
      .in("id", linkedSessionIds)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (sessionsError) {
      return NextResponse.json({ ok: false, error: sessionsError.message }, { status: 500 });
    }

    sessionId = (sessions?.[0]?.id as string | undefined) ?? null;
    if (!sessionId) {
      return NextResponse.json({ ok: true, session: null });
    }
  }

  if (sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from("clariti_sessions")
      .select("id, title, status, created_at, updated_at, parent_session_id")
      .eq("owner_id", user.id)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ ok: false, error: sessionError?.message ?? "Session not found" }, { status: 404 });
    }

    const [{ data: links, error: linksError }, { data: messages, error: messagesError }, { data: artifacts, error: artifactsError }] = await Promise.all([
      supabase.from("clariti_session_documents").select("document_id").eq("session_id", sessionId),
      supabase.from("clariti_messages").select("id, role, content, created_at").eq("session_id", sessionId).order("created_at", { ascending: true }),
      supabase.from("clariti_artifacts").select("id, kind, title, summary, payload, created_at").eq("session_id", sessionId).order("created_at", { ascending: false }),
    ]);

    const relatedError = linksError ?? messagesError ?? artifactsError;
    if (relatedError) return NextResponse.json({ ok: false, error: relatedError.message }, { status: 500 });

    const documentIds = (links ?? []).map((link) => link.document_id as string);
    const { data: documents, error: documentsError } = documentIds.length > 0
      ? await supabase
        .from("clariti_documents")
        .select("id, file_name, kind, status, created_at, updated_at")
        .in("id", documentIds)
        .eq("owner_id", user.id)
        // Newest first, the same order as the artifacts above. A thread holds several of
        // each, and `documents[0]` only belongs with `artifacts[0]` when both are sorted
        // the same way — unordered, Postgres was free to hand back the knee MRI next to
        // the reading of the bill.
        .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (documentsError) return NextResponse.json({ ok: false, error: documentsError.message }, { status: 500 });

    // The text of one document, not of the whole thread.
    //
    // The workspace reads `documents[0]` and nothing else: that is the document on
    // screen, and the rest of the rail is drawn from file names and dates. Selecting
    // `extracted_text` for every row was one document's text before threading; in a
    // thread it is every document a reader has ever filed together, in full, on each
    // session open and again on every thread refresh. The rest are left to be read when
    // something actually needs them.
    const openDocumentId = (documents ?? [])[0]?.id as string | undefined;
    const { data: openDocument, error: openDocumentError } = openDocumentId
      ? await supabase
        .from("clariti_documents")
        .select("extracted_text")
        .eq("id", openDocumentId)
        .eq("owner_id", user.id)
        .maybeSingle()
      : { data: null, error: null };

    if (openDocumentError) return NextResponse.json({ ok: false, error: openDocumentError.message }, { status: 500 });

    const sessionDocuments = (documents ?? []).map((document, index) => (
      index === 0 ? { ...document, extracted_text: openDocument?.extracted_text ?? null } : document
    ));

    return NextResponse.json({
      ok: true,
      session: {
        ...session,
        documents: sessionDocuments,
        documentCount: sessionDocuments.length,
        messages: messages ?? [],
        // Each reading says which document it read, so a thread view can pair them
        // exactly rather than by position. A document with no artifact here was linked
        // in from elsewhere: it was read in the thread it was analysed into.
        artifacts: (artifacts ?? []).map((artifact) => ({
          ...artifact,
          document_id: artifactDocumentId(artifact.payload),
        })),
      },
    });
  }

  const { data, error } = await supabase
    .from("clariti_sessions")
    .select("id, title, status, created_at, updated_at, parent_session_id")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const sessionIds = (data ?? []).map((session) => session.id as string);
  const { data: messages, error: messagesError } = sessionIds.length > 0
    ? await supabase
      .from("clariti_messages")
      .select("session_id, role, content, created_at")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (messagesError) return NextResponse.json({ ok: false, error: messagesError.message }, { status: 500 });

  const questionBySessionId = new Map<string, string>();
  for (const message of messages ?? []) {
    const sessionIdForMessage = message.session_id as string;
    if (!questionBySessionId.has(sessionIdForMessage)) {
      questionBySessionId.set(sessionIdForMessage, message.content as string);
    }
  }

  // Every document in every thread, not just the first. A thread list that shows one
  // document per row is a list of documents wearing a thread's name — the reader cannot
  // see that the X-ray, the letter and the MRI are the same story until they open it.
  // The text itself is deliberately not selected: this response would otherwise carry
  // every document the account holds, in full, to render a sidebar.
  const { data: threadLinks, error: threadLinksError } = sessionIds.length > 0
    ? await supabase
      .from("clariti_session_documents")
      .select("session_id, document_id")
      .in("session_id", sessionIds)
    : { data: [], error: null };

  if (threadLinksError) return NextResponse.json({ ok: false, error: threadLinksError.message }, { status: 500 });

  const linkedDocumentIds = [...new Set((threadLinks ?? []).map((link) => link.document_id as string))];
  const { data: linkedDocuments, error: linkedDocumentsError } = linkedDocumentIds.length > 0
    ? await supabase
      .from("clariti_documents")
      .select("id, file_name, kind, status, created_at")
      .in("id", linkedDocumentIds)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (linkedDocumentsError) return NextResponse.json({ ok: false, error: linkedDocumentsError.message }, { status: 500 });

  const documentRows = linkedDocuments ?? [];
  const documentById = new Map(documentRows.map((document) => [document.id as string, document] as const));
  const documentsBySessionId = new Map<string, Array<(typeof documentRows)[number]>>();
  for (const link of threadLinks ?? []) {
    const document = documentById.get(link.document_id as string);
    // A link whose document did not come back belongs to someone else's document or to
    // one that is gone; it is left out rather than shown as a blank row.
    if (!document) continue;
    const sessionKey = link.session_id as string;
    const existing = documentsBySessionId.get(sessionKey);
    if (existing) existing.push(document);
    else documentsBySessionId.set(sessionKey, [document]);
  }

  return NextResponse.json({
    ok: true,
    sessions: (data ?? []).map((session) => {
      const documents = (documentsBySessionId.get(session.id as string) ?? [])
        .slice()
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));

      return {
        ...session,
        question: questionBySessionId.get(session.id as string) ?? null,
        documents,
        documentCount: documents.length,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  if (!user) return NextResponse.json({ ok: false, error: "Supabase auth is required to create sessions." }, { status: 503 });

  const supabase = await getSupabaseSessionClient();
  const { data: session, error } = await supabase
    .from("clariti_sessions")
    .insert({ owner_id: user.id, title: parsed.data.title, status: "active" })
    .select("id, title, status, created_at, updated_at, parent_session_id")
    .single();

  if (error || !session) return NextResponse.json({ ok: false, error: error?.message ?? "Could not create session" }, { status: 500 });

  if (parsed.data.documentIds.length > 0) {
    // The ids come from the client, so each one is checked against owner_id before a row
    // joins it to this thread. RLS refuses a foreign document here too, but it answers
    // with a policy violation — a sentence about row-level security, printed where the
    // explanation should be — and it leaves the ownership rule invisible at the one place
    // a join row is actually written.
    const { data: ownedDocuments, error: ownedError } = await supabase
      .from("clariti_documents")
      .select("id")
      .in("id", parsed.data.documentIds)
      .eq("owner_id", user.id);

    if (ownedError) return NextResponse.json({ ok: false, error: ownedError.message }, { status: 500 });

    const ownedIds = new Set((ownedDocuments ?? []).map((document) => document.id as string));
    const missing = parsed.data.documentIds.filter((documentId) => !ownedIds.has(documentId));
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Clariti could not find every one of those documents in your account." },
        { status: 404 },
      );
    }

    const { error: linkError } = await supabase
      .from("clariti_session_documents")
      .insert(parsed.data.documentIds.map((documentId) => ({ session_id: session.id, document_id: documentId })));
    if (linkError) return NextResponse.json({ ok: false, error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session });
}

/**
 * Add a document to a thread, or take it back out.
 *
 * **Linking shares, it does not move.** The join table permits either, and the difference
 * is visible to the reader: a hospital bill genuinely belongs both to "knee surgery" and
 * to "2026 insurance appeal", and a move would quietly empty the first thread to fill the
 * second. Clariti does not decide for someone that a document has stopped being part of a
 * story they put it in — the same rule that says suggest threads, never auto-link. So a
 * link is one added row and nothing else changes.
 *
 * **Unlinking never deletes the document.** It removes exactly the one (session, document)
 * row, so a mislinked document is one press away from being put back, and the document's
 * file, text and reading all survive. The reading follows the document to another of its
 * threads, because an artifact is addressed by session and one left in a thread the
 * document has left cannot be found again. A document cannot be unlinked from the last
 * thread it is in: that would leave it in the account with no thread to open it from.
 */
export async function PATCH(request: NextRequest) {
  // Unconditional, unlike the GET above: a write needs a real user, and a missing
  // Supabase env var is a broken deploy, not permission to edit an account's threads.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = threadMembershipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Clariti needs a thread and a document to change." }, { status: 400 });
  }

  const { action, sessionId, documentId } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  // Both halves are checked against owner_id here rather than left to RLS. The policies
  // guard each parent table, but a join row is two ids from the client pointing at two
  // tables, and "is this session mine" and "is this document mine" are separate questions
  // — a row that answers yes to one and no to the other is precisely what must not exist.
  const [{ data: session }, { data: document }] = await Promise.all([
    supabase.from("clariti_sessions").select("id, title").eq("id", sessionId).eq("owner_id", user.id).maybeSingle(),
    supabase.from("clariti_documents").select("id, file_name").eq("id", documentId).eq("owner_id", user.id).maybeSingle(),
  ]);

  if (!session || !document) {
    // One answer for "no such thing" and for "not yours", so the route never confirms
    // that somebody else's id exists.
    return NextResponse.json(
      { ok: false, error: "Clariti could not find that thread or document in your account." },
      { status: 404 },
    );
  }

  // Every thread this document is already in. RLS keeps this to the caller's own threads,
  // which is what makes the count below safe to reason about.
  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("clariti_session_documents")
    .select("session_id")
    .eq("document_id", documentId);

  if (existingLinksError) {
    return NextResponse.json(
      { ok: false, error: "Clariti could not read this document's threads. Please try again." },
      { status: 500 },
    );
  }

  const threadIds = (existingLinks ?? []).map((link) => link.session_id as string);

  if (action === "link") {
    if (threadIds.includes(sessionId)) {
      return NextResponse.json({ ok: true, linked: true, alreadyLinked: true, sessionId, documentId });
    }

    // Upsert with ignoreDuplicates rather than insert: two presses race, and the loser
    // should be a no-op rather than an error about a primary key. It also makes this
    // DO NOTHING, which matters because the join table has no update policy.
    const { error: linkError } = await supabase
      .from("clariti_session_documents")
      .upsert({ session_id: sessionId, document_id: documentId }, { onConflict: "session_id,document_id", ignoreDuplicates: true });

    if (linkError) {
      return NextResponse.json(
        { ok: false, error: "Clariti could not add this document to that thread. Please try again." },
        { status: 500 },
      );
    }

    // Threads are listed newest-activity first, so one that just gained a document moves.
    await supabase
      .from("clariti_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("owner_id", user.id);

    return NextResponse.json({ ok: true, linked: true, alreadyLinked: false, sessionId, documentId });
  }

  if (!threadIds.includes(sessionId)) {
    return NextResponse.json({ ok: false, error: "That document is not in this thread." }, { status: 404 });
  }

  if (threadIds.length <= 1) {
    return NextResponse.json(
      {
        ok: false,
        error: "This is the only thread this document is in. Add it to another thread first, then it can be taken out of this one.",
      },
      { status: 409 },
    );
  }

  // The plain-English reading of this document may have been written in the thread it is
  // leaving. Artifacts are addressed by session, so one left behind is unreachable: the
  // next time the document is opened /api/analyze finds no saved analysis and pays a
  // provider for another one. It follows the document instead.
  const [{ data: artifactsHere }, { data: sessionLinks }] = await Promise.all([
    supabase.from("clariti_artifacts").select("id, payload").eq("session_id", sessionId).order("created_at", { ascending: false }),
    supabase.from("clariti_session_documents").select("document_id").eq("session_id", sessionId),
  ]);

  const claimed = (artifactsHere ?? []).filter((artifact) => artifactDocumentId(artifact.payload) === documentId);
  const readingIds = claimed.length > 0
    ? claimed.map((artifact) => artifact.id as string)
    // Nothing claims a document, which is how every artifact written before threading
    // looks. In a thread holding only this document they can only be readings of it; in
    // one holding several there is no way to tell, so nothing moves.
    : (sessionLinks ?? []).length <= 1 ? (artifactsHere ?? []).map((artifact) => artifact.id as string) : [];

  const { error: unlinkError } = await supabase
    .from("clariti_session_documents")
    .delete()
    .eq("session_id", sessionId)
    .eq("document_id", documentId);

  if (unlinkError) {
    return NextResponse.json(
      { ok: false, error: "Clariti could not take this document out of that thread. Please try again." },
      { status: 500 },
    );
  }

  let readingMovedToSessionId: string | null = null;
  const remainingThreadIds = threadIds.filter((id) => id !== sessionId);
  if (readingIds.length > 0 && remainingThreadIds.length > 0) {
    const { data: destination } = await supabase
      .from("clariti_sessions")
      .select("id")
      .in("id", remainingThreadIds)
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const destinationId = (destination?.id as string | undefined) ?? null;
    if (destinationId) {
      const { error: moveError } = await supabase
        .from("clariti_artifacts")
        .update({ session_id: destinationId })
        .in("id", readingIds);

      // A failed move is not a failed unlink: the document did leave the thread, which is
      // what was asked for. The reading is stranded, and the response says so rather than
      // reporting a move that did not happen.
      if (!moveError) readingMovedToSessionId = destinationId;
    }
  }

  return NextResponse.json({ ok: true, unlinked: true, sessionId, documentId, readingMovedToSessionId });
}
