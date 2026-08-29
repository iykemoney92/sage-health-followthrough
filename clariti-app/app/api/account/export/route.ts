import { NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

type SessionClient = Awaited<ReturnType<typeof getSupabaseSessionClient>>;

/** PostgREST puts `in` filters in the query string, so a heavy account's session list would blow the URL length limit in one request. */
const IN_FILTER_CHUNK = 100;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Deliberately the session client, not the service role: row-level security is then the
  // thing guaranteeing the export contains this account and nothing else, rather than a
  // filter this route has to get right on every table.
  const supabase = await getSupabaseSessionClient();
  const ownerId = user.id;

  const [profile, documents, sessions, followUps, videos] = await Promise.all([
    supabase.from("clariti_profiles").select("*").eq("id", ownerId).maybeSingle(),
    supabase.from("clariti_documents").select("*").eq("owner_id", ownerId),
    supabase.from("clariti_sessions").select("*").eq("owner_id", ownerId),
    supabase.from("clariti_follow_ups").select("*").eq("owner_id", ownerId),
    supabase.from("clariti_video_generations").select("*").eq("owner_id", ownerId),
  ]);

  const sessionIds = (sessions.data ?? []).map((row) => row.id as string);

  const [messages, artifacts, sessionDocuments] = await Promise.all([
    selectWhereIn(supabase, "clariti_messages", sessionIds),
    selectWhereIn(supabase, "clariti_artifacts", sessionIds),
    selectWhereIn(supabase, "clariti_session_documents", sessionIds),
  ]);

  // A portability export that quietly drops a table is worse than one that fails: the
  // person would keep a file they believe is complete and delete the account behind it.
  const failure = [profile, documents, sessions, followUps, videos, messages, artifacts, sessionDocuments]
    .map((result) => result.error)
    .find(Boolean);
  if (failure) {
    console.error(`[account/export] read failed: ${failure.message}`);
    return NextResponse.json({
      ok: false,
      error: "Clariti could not read all of your data, so it did not build a file that would look complete but is not. Please try again.",
    }, { status: 500 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      displayName: (user.user_metadata?.display_name as string | undefined) ?? null,
      createdAt: user.created_at ?? null,
    },
    profile: profile.data ?? null,
    documents: documents.data ?? [],
    analyses: sessions.data ?? [],
    messages: messages.data,
    artifacts: artifacts.data,
    documentLinks: sessionDocuments.data,
    checkIns: followUps.data ?? [],
    videoGenerations: videos.data ?? [],
    note: "This file contains every row Clariti holds for your account. The uploaded files themselves stay in your account until you delete it.",
  };

  const stamp = new Date().toISOString().slice(0, 10);

  // `inline`, not `attachment`: the iOS WebView cannot save a download, so an attachment
  // disposition would leave native users with nothing at all. Rendering the JSON is
  // something the WebView can do, and the browser path uses an anchor `download`
  // attribute — which supplies its own filename — so nothing is lost on the web.
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `inline; filename="clariti-data-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

async function selectWhereIn(supabase: SessionClient, table: string, sessionIds: string[]) {
  const rows: unknown[] = [];

  for (let index = 0; index < sessionIds.length; index += IN_FILTER_CHUNK) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in("session_id", sessionIds.slice(index, index + IN_FILTER_CHUNK));
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
  }

  return { data: rows, error: null };
}
