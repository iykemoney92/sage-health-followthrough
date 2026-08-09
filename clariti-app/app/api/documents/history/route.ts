import { NextRequest, NextResponse } from "next/server";
import { isClaritiAnalysisKind } from "@/lib/domain/clariti-document-kinds";
import { getRecentClaritiAnalyses } from "@/lib/domain/clariti-history";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

/**
 * Recent saved document analyses for the signed-in user — used by the workspace
 * "Compare with earlier docs" affordance and by anything that needs to show what
 * Clariti already has on file (kind, title, summary, key points, metrics).
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: true, history: [] });

  const kindParam = request.nextUrl.searchParams.get("kind");
  const excludeSessionId = request.nextUrl.searchParams.get("excludeSessionId") ?? undefined;
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

  const supabase = await getSupabaseSessionClient();
  const history = await getRecentClaritiAnalyses(supabase, user.id, {
    kinds: isClaritiAnalysisKind(kindParam) ? [kindParam] : undefined,
    excludeSessionId,
    limit,
  });

  return NextResponse.json({
    ok: true,
    history: history.map((entry) => ({
      sessionId: entry.sessionId,
      kind: entry.kind,
      title: entry.title,
      summary: entry.summary,
      keyPoints: entry.keyPoints,
      metrics: entry.metrics,
      createdAt: entry.createdAt,
    })),
  });
}
