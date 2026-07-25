import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";
import { documentKindSchema } from "@/lib/schemas/clariti";

const requestSchema = z.object({
  fileName: z.string().min(1),
  kind: documentKindSchema.default("unknown"),
  extractedText: z.string().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: true, documents: [] });

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_documents")
    .select("id, file_name, kind, status, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const documentIds = (data ?? []).map((document) => document.id as string);
  const { data: links, error: linksError } = documentIds.length > 0
    ? await supabase
      .from("clariti_session_documents")
      .select("document_id, session_id")
      .in("document_id", documentIds)
    : { data: [], error: null };

  if (linksError) return NextResponse.json({ ok: false, error: linksError.message }, { status: 500 });

  const sessionIdByDocumentId = new Map((links ?? []).map((link) => [link.document_id as string, link.session_id as string]));
  return NextResponse.json({
    ok: true,
    documents: (data ?? []).map((document) => ({
      ...document,
      session_id: sessionIdByDocumentId.get(document.id as string) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  if (!user) return NextResponse.json({ ok: false, error: "Supabase auth is required to save documents." }, { status: 503 });

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_documents")
    .insert({
      owner_id: user.id,
      file_name: parsed.data.fileName,
      kind: parsed.data.kind,
      status: parsed.data.extractedText ? "extracted" : "uploaded",
      extracted_text: parsed.data.extractedText,
    })
    .select("id, file_name, kind, status, created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: data });
}
