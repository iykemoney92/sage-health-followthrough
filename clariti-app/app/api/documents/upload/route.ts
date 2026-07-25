import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { documentKindSchema } from "@/lib/schemas/clariti";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const metadataSchema = z.object({
  kind: documentKindSchema.default("unknown"),
  extractedText: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  const configured = hasSupabaseBrowserConfig();

  if (configured && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const parsed = metadataSchema.safeParse({
    kind: formData.get("kind") ?? "unknown",
    extractedText: formData.get("extractedText") ?? undefined,
  });

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "A document file is required." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "Supabase auth is required to upload documents." }, { status: 503 });

  const supabase = await getSupabaseSessionClient();
  const storagePath = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("clariti-documents")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("clariti_documents")
    .insert({
      owner_id: user.id,
      file_name: file.name,
      kind: parsed.data.kind,
      status: parsed.data.extractedText ? "extracted" : "uploaded",
      storage_path: storagePath,
      extracted_text: parsed.data.extractedText,
    })
    .select("id, file_name, kind, status, storage_path, created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: data });
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}
