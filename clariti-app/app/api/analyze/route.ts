import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeClaritiDocument, claritiAnalysisSchema, claritiDocumentKindSchema } from "@/lib/ai/clariti-analysis";
import { enforceFreeLimit, ensureClaritiProfile, FREE_DOCUMENT_LIMIT } from "@/lib/billing/subscription";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import { inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";
import { enforceRateLimit } from "@/lib/rate-limit";
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
  /** Skip the LLM and only persist a client-provided analysis (e.g. after timeout fallback). */
  persistOnly: z.boolean().optional(),
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

    const limited = await enforceRateLimit(await getSupabaseSessionClient(), user.id, "analyze");
    if (limited) return limited;

    const resolvedRequest = {
      ...parsed.data,
      kind: inferClaritiKind(parsed.data),
    };

    // Reuse an existing analysis for this document so reloads / double-submits
    // do not re-run the LLM or create duplicate sessions.
    if (user && resolvedRequest.documentId && !resolvedRequest.persistOnly && !resolvedRequest.force) {
      const existing = await findExistingAnalysisForDocument(user.id, resolvedRequest.documentId);
      if (existing) {
        return NextResponse.json({ ok: true, analysis: existing.analysis, persisted: existing.persisted, reused: true });
      }
    }

    const supabase = await getSupabaseSessionClient();
    await ensureClaritiProfile(supabase, user.id, (user.user_metadata?.display_name as string | undefined) ?? null);
    if (!resolvedRequest.persistOnly) {
      const limitResponse = await enforceFreeLimit(supabase, user.id, "documents", FREE_DOCUMENT_LIMIT);
      if (limitResponse) return limitResponse;
    }

    const analysis = parsed.data.persistOnly && parsed.data.analysis
      ? parsed.data.analysis
      : await analyzeClaritiDocument(resolvedRequest);

    const persisted = await persistAnalysis({ ...resolvedRequest, ownerId: user.id, analysis });

    return NextResponse.json({ ok: true, analysis, persisted });
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

async function findExistingAnalysisForDocument(ownerId: string, documentId: string) {
  const supabase = await getSupabaseSessionClient();
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

  for (const session of sessions) {
    const [{ data: artifacts }, { data: document }] = await Promise.all([
      supabase
        .from("clariti_artifacts")
        .select("id, kind, title, summary, payload, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("clariti_documents")
        .select("id, file_name, kind, status, created_at")
        .eq("id", documentId)
        .eq("owner_id", ownerId)
        .maybeSingle(),
    ]);

    const artifact = artifacts?.[0];
    if (!artifact?.payload || !document) continue;
    const parsedAnalysis = claritiAnalysisSchema.safeParse(artifact.payload);
    if (!parsedAnalysis.success) continue;

    return {
      analysis: parsedAnalysis.data,
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
}: z.infer<typeof requestSchema> & {
  ownerId: string;
  analysis: Awaited<ReturnType<typeof analyzeClaritiDocument>>;
}) {
  const supabase = await getSupabaseSessionClient();
  const resolvedFileName = fileName ?? `${kind.replaceAll("_", "-")}.txt`;

  // Prefer updating an existing session for this document (especially persistOnly / retries).
  if (documentId) {
    const existing = await findExistingAnalysisForDocument(ownerId, documentId);
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

      await supabase
        .from("clariti_sessions")
        .update({ title: analysis.title, status: "active", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("owner_id", ownerId);

      if (existing.persisted.artifact?.id) {
        const { data: artifact, error: artifactError } = await supabase
          .from("clariti_artifacts")
          .update({
            kind: getClaritiKindMeta(analysis.kind).artifactKind,
            title: analysis.title,
            summary: analysis.summary,
            payload: analysis,
          })
          .eq("id", existing.persisted.artifact.id)
          .select("id, kind, title, created_at")
          .single();
        if (artifactError || !artifact) throw new Error(artifactError?.message ?? "Could not update artifact");
        return { document, session: { ...existing.persisted.session, title: analysis.title }, artifact };
      }

      const { data: artifact, error: artifactError } = await supabase
        .from("clariti_artifacts")
        .insert({
          session_id: sessionId,
          kind: getClaritiKindMeta(analysis.kind).artifactKind,
          title: analysis.title,
          summary: analysis.summary,
          payload: analysis,
        })
        .select("id, kind, title, created_at")
        .single();
      if (artifactError || !artifact) throw new Error(artifactError?.message ?? "Could not save artifact");
      return { document, session: { ...existing.persisted.session, title: analysis.title }, artifact };
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

  const { data: session, error: sessionError } = await supabase
    .from("clariti_sessions")
    .insert({
      owner_id: ownerId,
      title: analysis.title,
      status: "active",
      parent_session_id: parentSessionId,
    })
    .select("id, title, status, created_at, updated_at, parent_session_id")
    .single();

  if (sessionError || !session) throw new Error(sessionError?.message ?? "Could not save session");

  const sessionId = session.id as string;
  const savedDocumentId = document.id as string;
  const userMessageCreatedAt = new Date();
  const assistantMessageCreatedAt = new Date(userMessageCreatedAt.getTime() + 1);

  const [{ error: linkError }, { error: messagesError }, { data: artifact, error: artifactError }] = await Promise.all([
    supabase.from("clariti_session_documents").insert({ session_id: sessionId, document_id: savedDocumentId }),
    supabase.from("clariti_messages").insert([
      { session_id: sessionId, role: "user", content: question, created_at: userMessageCreatedAt.toISOString() },
      { session_id: sessionId, role: "assistant", content: buildInitialAnalysisReply(analysis), created_at: assistantMessageCreatedAt.toISOString() },
    ]),
    supabase
      .from("clariti_artifacts")
      .insert({
        session_id: sessionId,
        kind: getClaritiKindMeta(analysis.kind).artifactKind,
        title: analysis.title,
        summary: analysis.summary,
        payload: analysis,
      })
      .select("id, kind, title, created_at")
      .single(),
  ]);

  const persistenceError = linkError ?? messagesError ?? artifactError;
  if (persistenceError) throw new Error(persistenceError.message);

  return { document, session, artifact };
}

function buildInitialAnalysisReply(analysis: Awaited<ReturnType<typeof analyzeClaritiDocument>>) {
  const source = analysis.keyPoints[0]?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "your document";
  const nextAction = analysis.nextActions[0] ?? "talk this through with the right person";
  return `${analysis.summary}\n\nI put the main points in the panel on the right — written in plain language. A good next step: ${nextAction}. Source: ${source}.`;
}
