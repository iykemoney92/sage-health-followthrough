import { NextRequest, NextResponse } from "next/server";
import { createArtifactSchema } from "@/lib/schemas/clariti";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: true, artifacts: [] });

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const supabase = await getSupabaseSessionClient();
  let query = supabase
    .from("clariti_artifacts")
    .select("id, session_id, kind, title, summary, payload, created_at, clariti_sessions!inner(owner_id)")
    .eq("clariti_sessions.owner_id", user.id)
    .order("created_at", { ascending: false });

  if (sessionId) query = query.eq("session_id", sessionId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, artifacts: data });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createArtifactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  if (!user) return NextResponse.json({ ok: false, error: "Supabase auth is required to save artifacts." }, { status: 503 });

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_artifacts")
    .insert({
      session_id: parsed.data.sessionId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      summary: parsed.data.summary,
      payload: parsed.data.payload,
    })
    .select("id, session_id, kind, title, summary, payload, created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, artifact: data });
}
