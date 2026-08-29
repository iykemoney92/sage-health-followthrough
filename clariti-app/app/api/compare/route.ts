import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getRecentClaritiAnalyses } from "@/lib/domain/clariti-history";
import { buildProgressionComparison } from "@/lib/domain/clariti-progression";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  analysis: claritiAnalysisSchema,
  sessionId: z.string().uuid().nullish(),
  compareSessionId: z.string().uuid().optional(),
});

/**
 * Structured document-vs-document progression/regression comparison.
 * Purely derived from saved clariti_artifacts payloads — no invented values.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit(await getSupabaseSessionClient(), "compare");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const supabase = await getSupabaseSessionClient();
  const { analysis, sessionId, compareSessionId } = parsed.data;

  const candidates = await getRecentClaritiAnalyses(supabase, user.id, {
    kinds: [analysis.kind],
    excludeSessionId: sessionId ?? undefined,
    limit: 10,
  });

  const earlier = compareSessionId
    ? candidates.find((entry) => entry.sessionId === compareSessionId)
    : candidates[0];

  if (!earlier) {
    return NextResponse.json({
      ok: true,
      comparison: null,
      message: `No earlier saved ${analysis.kind.replaceAll("_", " ")} document was found to compare against.`,
      candidates: candidates.map((entry) => ({ sessionId: entry.sessionId, title: entry.title, createdAt: entry.createdAt })),
    });
  }

  const plusResponse = await requirePlusAccess(supabase, user.id, "compare");
  if (plusResponse) return plusResponse;

  const comparison = buildProgressionComparison({
    current: analysis,
    earlier,
    currentSessionId: sessionId ?? null,
  });

  return NextResponse.json({
    ok: true,
    comparison,
    candidates: candidates.map((entry) => ({ sessionId: entry.sessionId, title: entry.title, createdAt: entry.createdAt })),
  });
}
