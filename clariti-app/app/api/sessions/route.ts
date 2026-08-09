import { NextRequest, NextResponse } from "next/server";
import { createSessionSchema } from "@/lib/schemas/clariti";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

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
        .select("id, file_name, kind, status, extracted_text, created_at, updated_at")
        .in("id", documentIds)
        .eq("owner_id", user.id)
      : { data: [], error: null };

    if (documentsError) return NextResponse.json({ ok: false, error: documentsError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      session: {
        ...session,
        documents: documents ?? [],
        messages: messages ?? [],
        artifacts: artifacts ?? [],
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

  return NextResponse.json({
    ok: true,
    sessions: (data ?? []).map((session) => ({
      ...session,
      question: questionBySessionId.get(session.id as string) ?? null,
    })),
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
    const { error: linkError } = await supabase
      .from("clariti_session_documents")
      .insert(parsed.data.documentIds.map((documentId) => ({ session_id: session.id, document_id: documentId })));
    if (linkError) return NextResponse.json({ ok: false, error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session });
}
