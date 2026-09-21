import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeClaritiDocument, claritiAnalysisSchema, claritiDocumentKindSchema, type ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { reportError } from "@/lib/observability/report-error";
import { enforceFreeLimit, ensureClaritiProfile, FREE_DOCUMENT_LIMIT } from "@/lib/billing/subscription";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import { inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export const maxDuration = 120;

const requestSchema = z.object({
  kind: claritiDocumentKindSchema,
  question: z.string().min(1),
  documentText: z.string().min(20),
  fileName: z.string().min(1).optional(),
  documentId: z.string().uuid().optional(),
  /** The session the user was viewing when they attached this follow-up, used to link the new session into the same lineage. */
  previousSessionId: z.string().uuid().optional(),
  /**
   * Analyse this document into an existing thread instead of starting a new one.
   * A session is already a many-to-many join over documents, so a thread is a session
   * that was given more than one — no new table, and no migration nobody can apply.
   * Left out, the route behaves exactly as it always has: one document, one session.
   * It takes precedence over `previousSessionId`: a thread is a lineage already, and
   * the two together would file the document twice under different ideas of "related".
   */
  threadSessionId: z.string().uuid().optional(),
  /** Skip the LLM and only persist a client-provided analysis (e.g. after timeout fallback). */
  persistOnly: z.boolean().optional(),
  /** Send with `persistOnly` when the supplied analysis is the client's own fallback, so it is stored as degraded and never reused. */
  degraded: z.boolean().optional(),
  /** Bypass reuse of an existing document analysis (explicit re-run). */
  force: z.boolean().optional(),
  analysis: claritiAnalysisSchema.optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Clariti needs a document with readable text to analyse." }, { status: 400 });
  }

  try {
    // Unconditional, not `hasSupabaseBrowserConfig() && !user`: that older shape
    // let the route run with no user at all whenever a Supabase env var was
    // missing, so a misconfigured deploy became an open LLM endpoint over
    // medical documents rather than an obviously broken one.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!hasAiConsent(user)) {
      return aiConsentRequiredResponse();
    }

    const supabase = await getSupabaseSessionClient();
    const limited = await enforceRateLimit(supabase, "analyze");
    if (limited) return limited;

    const resolvedRequest = {
      ...parsed.data,
      kind: inferClaritiKind(parsed.data),
    };

    // The thread id arrives from the client, so ownership is proved here rather than
    // left to RLS. The policies guard each parent table, but nothing in them stops a
    // join row from pointing at one person's thread and another person's document.
    const thread = resolvedRequest.threadSessionId
      ? await findOwnedSession(supabase, user.id, resolvedRequest.threadSessionId)
      : null;
    if (resolvedRequest.threadSessionId && !thread) {
      // One answer for "no such thread" and for "not yours", so the route never
      // confirms that somebody else's id exists.
      return NextResponse.json({ ok: false, error: "Clariti could not find that thread in your account." }, { status: 404 });
    }

    const existing = resolvedRequest.documentId && !resolvedRequest.persistOnly
      ? await findExistingAnalysisForDocument(user.id, resolvedRequest.documentId, supabase)
      : null;

    // Reuse an existing analysis for this document so reloads / double-submits
    // do not re-run the LLM or create duplicate sessions. A degraded one is never
    // reused: it is the fallback text, not a reading of the document, so the next
    // load has to be allowed to replace it with a real answer.
    if (existing && !existing.degraded && !resolvedRequest.force) {
      // Reusing the reading does not reuse the membership: a document re-opened while
      // it is being added to a thread still has to join the thread.
      if (thread) {
        const linkError = await linkDocumentToSession(supabase, thread.id, existing.persisted.document.id as string);
        if (linkError) {
          return NextResponse.json(
            { ok: false, error: "Clariti could not add this document to that thread. Please try again." },
            { status: 500 },
          );
        }
        await touchSession(supabase, user.id, thread.id);
      }
      return NextResponse.json({
        ok: true,
        analysis: existing.analysis,
        persisted: existing.persisted,
        degraded: false,
        reused: true,
        threadSessionId: thread?.id ?? null,
      });
    }

    await ensureClaritiProfile(supabase, user.id, (user.user_metadata?.display_name as string | undefined) ?? null);
    // The free tier counts documents, and a document that already has an analysis
    // has already been counted. Charging again for the retry would sell the upgrade
    // to the one person whose first pass failed.
    if (!resolvedRequest.persistOnly && !existing) {
      const limitResponse = await enforceFreeLimit(supabase, user.id, "documents", FREE_DOCUMENT_LIMIT);
      if (limitResponse) return limitResponse;
    }

    const { analysis, degraded } = parsed.data.persistOnly && parsed.data.analysis
      // A persistOnly body carries an analysis this route did not produce, so it is
      // only as trustworthy as the caller says it is.
      ? { analysis: parsed.data.analysis, degraded: parsed.data.degraded === true }
      : await analyzeClaritiDocument(resolvedRequest).then((result) => {
          // Reported from the route rather than from the analysis module: that
          // module is imported by client components for its schema, and the
          // reporter reaches for next/server.
          if (result.degraded && result.failure) {
            reportError("ai/clariti-analysis", result.failure.message || result.failure.name, {
              errorName: result.failure.name,
              kind: resolvedRequest.kind,
              documentChars: resolvedRequest.documentText.length,
            });
          }
          return result;
        });

    const persisted = await persistAnalysis({ ...resolvedRequest, ownerId: user.id, analysis, degraded, thread });

    return NextResponse.json({ ok: true, analysis, persisted, degraded });
  } catch (error) {
    // The message can carry provider text that echoes the document, and the
    // document is somebody's medical record. It stays in the log.
    console.error(
      "[clariti] analysis failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { ok: false, error: "Clariti could not analyse this document. Please try again." },
      { status: 500 },
    );
  }
}

type SessionClient = Awaited<ReturnType<typeof getSupabaseSessionClient>>;
type OwnedSession = { id: string; title: string; status: string; created_at: string; updated_at: string; parent_session_id: string | null };

/**
 * A session the caller actually owns, or null. Every threading operation takes a session
 * id from the client and then writes a row that joins it to a document, so ownership is
 * proved before the write rather than inferred from the insert having succeeded.
 */
async function findOwnedSession(supabase: SessionClient, ownerId: string, sessionId: string): Promise<OwnedSession | null> {
  const { data } = await supabase
    .from("clariti_sessions")
    .select("id, title, status, created_at, updated_at, parent_session_id")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return (data as OwnedSession | null) ?? null;
}

/**
 * Adds a document to a thread. Both halves must already be known to belong to the caller.
 *
 * (session_id, document_id) is the table's primary key, so linking the same pair twice is
 * a conflict rather than a duplicate row — ignored here, because "add this to the thread"
 * pressed twice should be quiet, not an error about a unique constraint. `ignoreDuplicates`
 * matters for a second reason: it makes this DO NOTHING, and 0004 gives the join table
 * select/insert/delete policies but no update one, so DO UPDATE would be refused by RLS.
 */
async function linkDocumentToSession(supabase: SessionClient, sessionId: string, documentId: string) {
  const { error } = await supabase
    .from("clariti_session_documents")
    .upsert({ session_id: sessionId, document_id: documentId }, { onConflict: "session_id,document_id", ignoreDuplicates: true });

  return error;
}

/** Threads are listed newest-activity first, so one that just gained a document has to move. */
async function touchSession(supabase: SessionClient, ownerId: string, sessionId: string) {
  await supabase
    .from("clariti_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("owner_id", ownerId);
}

/**
 * The analysis of one document inside a session that may now hold several.
 *
 * "The newest artifact in this session" stopped meaning "the reading of this document"
 * the moment a second document could be added, and handing back a reading of somebody's
 * knee MRI as if it were their bill is exactly the confident-but-wrong output the rest of
 * this codebase was refactored to avoid. Artifacts written since threading carry their
 * document id inside the payload jsonb — the same place `degraded` rides, because
 * clariti_artifacts has no column for either. Older artifacts carry nothing, so they are
 * only trusted in a session holding a single document, which is what every session was
 * until now.
 */
function pickArtifactForDocument<T extends { payload: unknown }>(artifacts: T[], documentId: string, documentsInSession: number) {
  const claimed = artifacts.find((artifact) => (artifact.payload as { documentId?: unknown } | null)?.documentId === documentId);
  if (claimed) return claimed;
  if (documentsInSession <= 1) return artifacts[0];
  return undefined;
}

async function findExistingAnalysisForDocument(ownerId: string, documentId: string, client?: SessionClient) {
  const supabase = client ?? await getSupabaseSessionClient();
  const { data: links, error: linksError } = await supabase
    .from("clariti_session_documents")
    .select("session_id")
    .eq("document_id", documentId);

  if (linksError || !links?.length) return null;

  const sessionIds = links.map((link) => link.session_id as string);
  const { data: sessions, error: sessionsError } = await supabase
    .from("clariti_sessions")
    .select("id, title, status, created_at, updated_at")
    .eq("owner_id", ownerId)
    .in("id", sessionIds)
    .order("updated_at", { ascending: false });

  if (sessionsError || !sessions?.length) return null;

  // How many documents each candidate session holds, which is what decides whether an
  // unclaimed artifact can be read as this document's.
  const { data: siblingLinks } = await supabase
    .from("clariti_session_documents")
    .select("session_id, document_id")
    .in("session_id", sessionIds);

  const documentsBySession = new Map<string, number>();
  for (const link of siblingLinks ?? []) {
    const key = link.session_id as string;
    documentsBySession.set(key, (documentsBySession.get(key) ?? 0) + 1);
  }

  for (const session of sessions) {
    const [{ data: artifacts }, { data: document }] = await Promise.all([
      supabase
        .from("clariti_artifacts")
        .select("id, kind, title, summary, payload, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("clariti_documents")
        .select("id, file_name, kind, status, created_at")
        .eq("id", documentId)
        .eq("owner_id", ownerId)
        .maybeSingle(),
    ]);

    const artifact = pickArtifactForDocument(artifacts ?? [], documentId, documentsBySession.get(session.id as string) ?? 1);
    if (!artifact?.payload || !document) continue;
    const parsedAnalysis = claritiAnalysisSchema.safeParse(artifact.payload);
    if (!parsedAnalysis.success) continue;

    return {
      analysis: parsedAnalysis.data,
      // The flag rides inside the payload jsonb because clariti_artifacts has no
      // column for it; claritiAnalysisSchema strips it back off the analysis.
      degraded: (artifact.payload as { degraded?: unknown }).degraded === true,
      persisted: { document, session, artifact },
    };
  }

  return null;
}

async function persistAnalysis({
  ownerId,
  kind,
  question,
  documentText,
  fileName,
  documentId,
  previousSessionId,
  analysis,
  degraded,
  thread,
}: z.infer<typeof requestSchema> & {
  ownerId: string;
  analysis: ClaritiAnalysis;
  degraded: boolean;
  /** Already proved by the route to belong to `ownerId`; null means "a thread of its own". */
  thread: OwnedSession | null;
}) {
  const supabase = await getSupabaseSessionClient();
  const resolvedFileName = fileName ?? `${kind.replaceAll("_", "-")}.txt`;
  // `degraded` is stored with the analysis rather than beside it, so a later read can
  // tell a real pass from the fallback without a new column. The document id rides
  // along for the same reason: a thread holds one artifact per document, and nothing
  // else on the row says which document each artifact read.
  const payloadFor = (analysedDocumentId: string) => ({ ...analysis, degraded, documentId: analysedDocumentId });

  // Prefer updating an existing session for this document (especially persistOnly / retries).
  if (documentId) {
    const existing = await findExistingAnalysisForDocument(ownerId, documentId, supabase);
    if (existing?.persisted.session?.id) {
      const sessionId = existing.persisted.session.id as string;
      const { data: document, error: documentError } = await supabase
        .from("clariti_documents")
        .update({
          file_name: resolvedFileName,
          kind,
          status: "extracted",
          extracted_text: documentText,
        })
        .eq("id", documentId)
        .eq("owner_id", ownerId)
        .select("id, file_name, kind, status, created_at")
        .single();
      if (documentError || !document) throw new Error(documentError?.message ?? "Could not update document");

      // A re-run renames its session after the document it just read — right for a
      // session holding one document, wrong for a thread, where it would rename the
      // whole story ("Knee surgery") after whichever report was re-read last.
      const documentsInSession = await countSessionDocuments(supabase, sessionId);
      await supabase
        .from("clariti_sessions")
        .update({
          ...(documentsInSession > 1 ? {} : { title: analysis.title }),
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("owner_id", ownerId);

      // The caller asked for this document to sit in a thread as well. Its analysis
      // stays where it was made; only the membership is added.
      if (thread && thread.id !== sessionId) {
        const linkError = await linkDocumentToSession(supabase, thread.id, documentId);
        if (linkError) throw new Error(linkError.message);
        await touchSession(supabase, ownerId, thread.id);
      }

      const sessionAfterUpdate = documentsInSession > 1
        ? existing.persisted.session
        : { ...existing.persisted.session, title: analysis.title };

      if (existing.persisted.artifact?.id) {
        const { data: artifact, error: artifactError } = await supabase
          .from("clariti_artifacts")
          .update({
            kind: getClaritiKindMeta(analysis.kind).artifactKind,
            title: analysis.title,
            summary: analysis.summary,
            payload: payloadFor(documentId),
          })
          .eq("id", existing.persisted.artifact.id)
          .select("id, kind, title, created_at")
          .single();
        if (artifactError || !artifact) throw new Error(artifactError?.message ?? "Could not update artifact");
        return { document, session: sessionAfterUpdate, artifact, threadSessionId: thread?.id ?? null };
      }

      const { data: artifact, error: artifactError } = await supabase
        .from("clariti_artifacts")
        .insert({
          session_id: sessionId,
          kind: getClaritiKindMeta(analysis.kind).artifactKind,
          title: analysis.title,
          summary: analysis.summary,
          payload: payloadFor(documentId),
        })
        .select("id, kind, title, created_at")
        .single();
      if (artifactError || !artifact) throw new Error(artifactError?.message ?? "Could not save artifact");
      return { document, session: sessionAfterUpdate, artifact, threadSessionId: thread?.id ?? null };
    }

  }

  const documentResult = documentId
    ? await supabase
      .from("clariti_documents")
      .update({
        file_name: resolvedFileName,
        kind,
        status: "extracted",
        extracted_text: documentText,
      })
      .eq("id", documentId)
      .eq("owner_id", ownerId)
      .select("id, file_name, kind, status, created_at")
      .single()
    : await supabase
      .from("clariti_documents")
      .insert({
        owner_id: ownerId,
        file_name: resolvedFileName,
        kind,
        status: "extracted",
        extracted_text: documentText,
      })
      .select("id, file_name, kind, status, created_at")
      .single();

  const { data: document, error: documentError } = documentResult;
  if (documentError || !document) throw new Error(documentError?.message ?? "Could not save document");

  let session: OwnedSession;
  if (thread) {
    // The story already exists, so the document joins it rather than starting one of
    // its own. The thread keeps its own title: it is named for the story, and renaming
    // "Knee surgery" after the scan that happened to arrive last is a change nobody
    // asked for. Only its activity time moves.
    const { data: updatedThread } = await supabase
      .from("clariti_sessions")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", thread.id)
      .eq("owner_id", ownerId)
      .select("id, title, status, created_at, updated_at, parent_session_id")
      .maybeSingle();

    session = (updatedThread as OwnedSession | null) ?? thread;
  } else {
    let parentSessionId: string | null = null;
    if (previousSessionId) {
      const { data: previousSession } = await supabase
        .from("clariti_sessions")
        .select("id, parent_session_id")
        .eq("id", previousSessionId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      // Link into the existing lineage's root, or make the previous session the root if it has none yet.
      if (previousSession) parentSessionId = (previousSession.parent_session_id as string | null) ?? previousSession.id;
    }

    const { data: newSession, error: sessionError } = await supabase
      .from("clariti_sessions")
      .insert({
        owner_id: ownerId,
        title: analysis.title,
        status: "active",
        parent_session_id: parentSessionId,
      })
      .select("id, title, status, created_at, updated_at, parent_session_id")
      .single();

    if (sessionError || !newSession) throw new Error(sessionError?.message ?? "Could not save session");
    session = newSession as OwnedSession;
  }

  const sessionId = session.id as string;
  const savedDocumentId = document.id as string;
  const userMessageCreatedAt = new Date();
  const assistantMessageCreatedAt = new Date(userMessageCreatedAt.getTime() + 1);

  const [linkError, { error: messagesError }, { data: artifact, error: artifactError }] = await Promise.all([
    // Upsert rather than insert: into a thread this pair can already exist, and a
    // primary-key conflict is not a reason to fail an analysis that succeeded.
    linkDocumentToSession(supabase, sessionId, savedDocumentId),
    supabase.from("clariti_messages").insert([
      { session_id: sessionId, role: "user", content: question, created_at: userMessageCreatedAt.toISOString() },
      { session_id: sessionId, role: "assistant", content: buildInitialAnalysisReply(analysis, degraded), created_at: assistantMessageCreatedAt.toISOString() },
    ]),
    supabase
      .from("clariti_artifacts")
      .insert({
        session_id: sessionId,
        kind: getClaritiKindMeta(analysis.kind).artifactKind,
        title: analysis.title,
        summary: analysis.summary,
        payload: payloadFor(savedDocumentId),
      })
      .select("id, kind, title, created_at")
      .single(),
  ]);

  const persistenceError = linkError ?? messagesError ?? artifactError;
  if (persistenceError) throw new Error(persistenceError.message);

  return { document, session, artifact, threadSessionId: thread?.id ?? null };
}

/** How many documents a session holds — one means it is still a single document, not a thread. */
async function countSessionDocuments(supabase: SessionClient, sessionId: string) {
  const { data } = await supabase
    .from("clariti_session_documents")
    .select("document_id")
    .eq("session_id", sessionId);

  return (data ?? []).length;
}

function buildInitialAnalysisReply(analysis: ClaritiAnalysis, degraded: boolean) {
  const source = analysis.keyPoints[0]?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "your document";
  const nextAction = analysis.nextActions[0] ?? "talk this through with the right person";

  // This line is saved to the chat and is the first thing the person reads, so a
  // pass that never happened has to say so here too — not only in the panel.
  if (degraded) {
    return `I could not finish reading this document, so the panel on the right only shows the parts I could pick out of the text itself — please treat it as unfinished rather than an explanation. Opening this document again will try once more. In the meantime: ${nextAction}.`;
  }
  return `${analysis.summary}\n\nI put the main points in the panel on the right — written in plain language. A good next step: ${nextAction}. Source: ${source}.`;
}
