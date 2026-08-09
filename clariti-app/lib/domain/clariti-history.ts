import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaritiAnalysis, ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { isClaritiAnalysisKind } from "@/lib/domain/clariti-document-kinds";

export type ClaritiHistoryEntry = {
  sessionId: string;
  artifactId: string;
  kind: ClaritiAnalysisKind;
  title: string;
  summary: string;
  keyPoints: ClaritiAnalysis["keyPoints"];
  metrics: ClaritiAnalysis["metrics"];
  flags: ClaritiAnalysis["flags"];
  createdAt: string;
};

type ArtifactRow = {
  id: string;
  session_id: string;
  kind: string;
  title: string;
  summary: string;
  payload: Partial<ClaritiAnalysis> | null;
  created_at: string;
};

/**
 * Recent saved document analyses for an owner, newest first. Used both by
 * /api/documents/history and by the messages agent to ground "compare this to
 * my earlier labs/bills" requests in real saved data — never invented content.
 */
export async function getRecentClaritiAnalyses(
  supabase: SupabaseClient,
  ownerId: string,
  options: { kinds?: ClaritiAnalysisKind[]; excludeSessionId?: string; limit?: number } = {},
): Promise<ClaritiHistoryEntry[]> {
  const { kinds, excludeSessionId, limit = 20 } = options;

  let query = supabase
    .from("clariti_artifacts")
    .select("id, session_id, kind, title, summary, payload, created_at, clariti_sessions!inner(owner_id)")
    .eq("clariti_sessions.owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (excludeSessionId) query = query.neq("session_id", excludeSessionId);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as ArtifactRow[];
  const entries = rows.map(rowToEntry).filter((entry): entry is ClaritiHistoryEntry => Boolean(entry));

  if (!kinds || kinds.length === 0) return entries;
  return entries.filter((entry) => kinds.includes(entry.kind));
}

function rowToEntry(row: ArtifactRow): ClaritiHistoryEntry | null {
  const payload = row.payload ?? {};
  const kind = isClaritiAnalysisKind(payload.kind) ? payload.kind : isClaritiAnalysisKind(row.kind) ? row.kind : "unknown";
  return {
    sessionId: row.session_id,
    artifactId: row.id,
    kind,
    title: row.title,
    summary: row.summary,
    keyPoints: Array.isArray(payload.keyPoints) ? payload.keyPoints : [],
    metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
    flags: Array.isArray(payload.flags) ? payload.flags : [],
    createdAt: row.created_at,
  };
}

const COMPARE_INTENT_PATTERN =
  /\b(compare|comparison|vs\.?|versus|change[sd]?|difference|different|trend|improv(?:e|ed|ing)|worsen(?:ed|ing)?|before and after|prior (?:lab|labs|bill|scan|result)|previous (?:lab|labs|bill|scan|result|visit)|last (?:lab|labs|bill|scan|time)|earlier (?:lab|labs|bill|scan|result|document)|since (?:my|the) last|over time|(?:went|gone) (?:up|down)|higher or lower)\b/i;

export function hasCompareIntent(text: string) {
  return COMPARE_INTENT_PATTERN.test(text);
}
