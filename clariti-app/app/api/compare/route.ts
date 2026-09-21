import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { requirePlusAccess } from "@/lib/billing/subscription";
import {
  findComparisonCandidates,
  getSessionThreadId,
  isComparableCandidate,
  type ClaritiComparisonCandidate,
} from "@/lib/domain/clariti-history";
import { buildProgressionComparison } from "@/lib/domain/clariti-progression";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  analysis: claritiAnalysisSchema,
  sessionId: z.string().uuid().nullish(),
  /**
   * The saved artifact this analysis was stored as, when the caller has it.
   * A thread is one session over many documents, so "not the one I am reading"
   * has to name a document — excluding the session would hide the rest of the
   * thread, which is exactly what we came for.
   */
  artifactId: z.string().uuid().optional(),
  /**
   * The earlier document to compare against. Prefer the artifact id: a thread
   * session holds many documents, so a session id alone no longer names one.
   * `compareSessionId` still works and resolves to the best-ranked document in
   * that session.
   */
  compareArtifactId: z.string().uuid().optional(),
  compareSessionId: z.string().uuid().optional(),
  /**
   * The reader saw a proposal, saw the reasons under it, and said yes. Only a
   * person sets this. A client that sets it automatically has re-invented
   * auto-linking with extra steps, and the whole point of proposing rather than
   * linking is that a wrong guess stops at the screen instead of becoming the
   * premise of everything Clariti says next.
   */
  confirmedRelated: z.boolean().optional(),
});

/**
 * Structured document-vs-document progression/regression comparison.
 * Purely derived from saved clariti_artifacts payloads — no invented values.
 *
 * The partner used to be "the most recent other document of the same kind",
 * which compared a thyroid panel against a diabetes panel and could never
 * compare a bill against its own EOB. It is now the thread the reader put the
 * document in, then whatever clariti-threads can actually give a reason for —
 * and when there is neither, this route says so rather than comparing anyway.
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
  const { analysis, sessionId, artifactId, compareArtifactId, compareSessionId, confirmedRelated } = parsed.data;
  const namedByReader = [compareArtifactId, compareSessionId].filter((id): id is string => Boolean(id));

  const threadId = sessionId ? await getSessionThreadId(supabase, user.id, sessionId) : null;
  const candidates = await findComparisonCandidates(supabase, user.id, {
    analysis,
    sessionId: sessionId ?? undefined,
    threadId,
    excludeArtifactId: artifactId,
    alwaysInclude: namedByReader,
    limit: 10,
  });

  const chosen = compareArtifactId
    ? candidates.find((candidate) => candidate.entry.artifactId === compareArtifactId)
    : compareSessionId
      ? candidates.find((candidate) => candidate.entry.sessionId === compareSessionId)
      // Nothing is picked for the reader unless Clariti can say why. The list is
      // still returned, guesses included and labelled, for them to choose from.
      : candidates.find(isComparableCandidate);

  // A guess can still be compared — but only after the person looking at the
  // reasons has said these two belong together. That acceptance is the link.
  const acceptedGuess = Boolean(chosen && namedByReader.length > 0 && confirmedRelated === true);

  if (!chosen || !(isComparableCandidate(chosen) || acceptedGuess)) {
    return NextResponse.json({
      ok: true,
      comparison: null,
      message: emptyStateMessage(chosen, candidates),
      candidates: candidates.map(toCandidatePayload),
    });
  }

  const plusResponse = await requirePlusAccess(supabase, user.id, "compare");
  if (plusResponse) return plusResponse;

  const comparison = buildProgressionComparison({
    current: analysis,
    earlier: chosen.entry,
    currentSessionId: sessionId ?? null,
  });

  return NextResponse.json({
    ok: true,
    comparison,
    /**
     * Additive: the UI can show what the pairing rests on. A comparison the
     * reader accepted off a guess must not be presented as one Clariti matched.
     */
    comparedBecause: {
      basis: chosen.basis,
      guess: !isComparableCandidate(chosen),
      reasons: acceptedGuess && !isComparableCandidate(chosen)
        ? [...chosen.reasons, "You told Clariti these two belong together — it did not work that out itself."]
        : chosen.reasons,
    },
    candidates: candidates.map(toCandidatePayload),
  });
}

function toCandidatePayload(candidate: ClaritiComparisonCandidate) {
  return {
    sessionId: candidate.entry.sessionId,
    title: candidate.entry.title,
    createdAt: candidate.entry.createdAt,
    // New fields; the older three above are unchanged for existing callers.
    artifactId: candidate.entry.artifactId,
    kind: candidate.entry.kind,
    basis: candidate.basis,
    reasons: candidate.reasons,
    /** Show this one as something to confirm, never as a match Clariti found. */
    guess: !isComparableCandidate(candidate),
  };
}

function emptyStateMessage(
  chosen: ClaritiComparisonCandidate | undefined,
  candidates: ClaritiComparisonCandidate[],
) {
  if (chosen) {
    return `Clariti cannot find anything “${chosen.entry.title}” and this document share — no common claim, marker, body area, or thread. If they are part of the same story, say so and it will compare them.`;
  }

  if (candidates.length === 0) {
    return "Clariti has no other saved document to compare this one against yet.";
  }

  // No count here on purpose: the list has been filtered down to what is worth
  // offering, so any number taken from it would understate what the reader
  // actually has on file.
  return "Clariti has earlier documents saved, but none it can honestly compare this one against: nothing they share — a claim number, a marker, a body area, a thread — came through. Putting one of them in this thread is what tells Clariti they are part of the same story.";
}
