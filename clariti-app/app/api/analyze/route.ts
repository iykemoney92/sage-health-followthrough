import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeClaritiDocument, claritiDocumentKindSchema } from "@/lib/ai/clariti-analysis";
import { inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  kind: claritiDocumentKindSchema,
  question: z.string().min(1),
  documentText: z.string().min(20),
  fileName: z.string().min(1).optional(),
  documentId: z.string().uuid().optional(),
});

const DEMO_OWNER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    const supabaseConfigured = hasSupabaseBrowserConfig();

    if (supabaseConfigured && !user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const resolvedRequest = {
      ...parsed.data,
      kind: inferClaritiKind(parsed.data),
    };
    const analysis = await analyzeClaritiDocument(resolvedRequest);
    const ownerId = user?.id ?? DEMO_OWNER_ID;
    const persisted = supabaseConfigured && user
      ? await persistAnalysis({ ...resolvedRequest, ownerId, analysis })
      : null;

    return NextResponse.json({ ok: true, analysis, persisted });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not analyze document" },
      { status: 500 },
    );
  }
}

async function persistAnalysis({
  ownerId,
  kind,
  question,
  documentText,
  fileName,
  documentId,
  analysis,
}: z.infer<typeof requestSchema> & {
  ownerId: string;
  analysis: Awaited<ReturnType<typeof analyzeClaritiDocument>>;
}) {
  const supabase = await getSupabaseSessionClient();
  const resolvedFileName = fileName ?? `${kind.replaceAll("_", "-")}.txt`;

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

  const { data: session, error: sessionError } = await supabase
    .from("clariti_sessions")
    .insert({
      owner_id: ownerId,
      title: analysis.title,
      status: "active",
    })
    .select("id, title, status, created_at, updated_at")
    .single();

  if (sessionError || !session) throw new Error(sessionError?.message ?? "Could not save session");

  const sessionId = session.id as string;
  const savedDocumentId = document.id as string;

  const [{ error: linkError }, { error: userMessageError }, { error: assistantMessageError }, { data: artifact, error: artifactError }] = await Promise.all([
    supabase.from("clariti_session_documents").insert({ session_id: sessionId, document_id: savedDocumentId }),
    supabase.from("clariti_messages").insert({ session_id: sessionId, role: "user", content: question }),
    supabase.from("clariti_messages").insert({ session_id: sessionId, role: "assistant", content: `${analysis.summary}\n\n${analysis.plainEnglish}` }),
    supabase
      .from("clariti_artifacts")
      .insert({
        session_id: sessionId,
        kind: analysis.kind === "medical_bill" ? "bill_breakdown" : analysis.kind === "insurance_eob" ? "eob_explanation" : "radiology_explainer",
        title: analysis.title,
        summary: analysis.summary,
        payload: analysis,
      })
      .select("id, kind, title, created_at")
      .single(),
  ]);

  const persistenceError = linkError ?? userMessageError ?? assistantMessageError ?? artifactError;
  if (persistenceError) throw new Error(persistenceError.message);

  return { document, session, artifact };
}
