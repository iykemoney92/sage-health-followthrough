import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { getSubscriptionAccess, type PlusFeature } from "@/lib/billing/subscription";
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
 * How many comparisons a free reader gets in one 30-day window.
 *
 * THIS IS THE PRICING DECISION FOR THIS ROUTE. Change the number, change
 * nothing else.
 *
 * Comparison used to be behind a hard Plus gate, which was backwards: it is the
 * cheapest thing Clariti does — buildProgressionComparison is arithmetic over
 * two analyses that are already saved, and no model is called — and it is one of
 * only two features that give a reader a reason to open Clariti a second time.
 * Gating it meant that in practice nobody ever used it.
 *
 * Five is sized off what a free account can actually hold: FREE_DOCUMENT_LIMIT
 * in lib/billing/subscription.ts is 3 documents, which is three distinct pairs,
 * so five covers every pair with room to re-run one when a newer result lands.
 * It is not sized off cost, because there is no per-comparison cost to size
 * against. Raising it spends nothing; lowering it only buys a worse first month.
 * The ceiling that stops a scripted client is the per-hour one in
 * lib/rate-limit.ts ("compare": 30/hour), which runs on every request above.
 */
const FREE_COMPARISON_LIMIT = 5;

/**
 * The window the allowance refreshes on. Thirty days rather than a lifetime on
 * purpose: a reader who comes back next month with a new result should find the
 * feature working, because that returning visit is the whole reason this route
 * was opened up.
 */
const FREE_COMPARISON_WINDOW_SECONDS = 30 * 24 * 60 * 60;

/**
 * Ledger key for the free allowance. It is deliberately not one of
 * lib/rate-limit.ts's RATE_LIMITS routes — those are per-hour abuse ceilings
 * charged on every request, this is a per-reader entitlement charged only when a
 * comparison is actually produced.
 */
const FREE_COMPARISON_LEDGER_ROUTE = "compareFree";

/**
 * Charge one comparison against a free reader's allowance, and report whether
 * that put them over it.
 *
 * This rides on clariti_increment_rate_limit — the same SECURITY DEFINER counter
 * lib/rate-limit.ts uses — rather than a column of its own, because nobody can
 * apply a migration to this project and the tally has to be one a client cannot
 * wind back. The function reads its owner from auth.uid() and clariti_rate_limits
 * has no RLS policy for `authenticated`, so a session can inflate its own count
 * and nothing else. The window start is computed here, server-side, so a client
 * calling the RPC with a window of its own buys itself nothing: this is the
 * window that gets read.
 *
 * Charged only where the old Plus gate sat — after the "nothing worth comparing"
 * branch above — so a reader whose documents do not match is told so without
 * spending anything. A refused attempt does still increment, the same way the
 * rate limiter's does; it costs nothing beyond this window, which expires.
 *
 * A counter that could not run lets the comparison through. A comparison spends
 * no provider money, so a bookkeeping outage should cost the ceiling and not the
 * reader — the same asymmetry lib/rate-limit.ts draws with its FAIL_CLOSED set,
 * where only the routes that spend real money fail closed.
 */
async function chargeFreeComparison(supabase: SupabaseClient) {
  const windowMs = FREE_COMPARISON_WINDOW_SECONDS * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const { data, error } = await supabase.rpc("clariti_increment_rate_limit", {
    p_route: FREE_COMPARISON_LEDGER_ROUTE,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    console.error("[compare] free allowance check failed:", error.message);
    return false;
  }

  return Number(data) > FREE_COMPARISON_LIMIT;
}

/**
 * The refusal a free reader who has used the feature five times should get.
 *
 * The body is deliberately the one plusRequiredResponse sends — error
 * "plus_required", feature, upgradeUrl, message — because app/workspace/page.tsx
 * matches on exactly that shape, and that match is what fires
 * track("plus_upgrade_redirect"). Changing the shape would silently drop the
 * funnel event. Only the words differ: someone who has just used comparison five
 * times has earned a pitch for what Plus adds, not a notice that the thing they
 * were using was never theirs.
 */
function freeComparisonLimitResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "plus_required",
      feature: "compare" satisfies PlusFeature,
      upgradeUrl: "/billing",
      message:
        `You have used your ${FREE_COMPARISON_LIMIT} free comparisons — they refresh every 30 days. `
        + "Clariti Plus compares without a ceiling: every new result against the one before it, so you can "
        + "see what actually moved instead of reading two documents side by side.",
    },
    { status: 402 },
  );
}

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

  // Plus is unchanged: no allowance, no ledger write, straight through. Only a
  // free reader is metered, and only here — at the point a comparison is about
  // to be produced — so the branches above that decline to compare cost nothing.
  const access = await getSubscriptionAccess(supabase, user.id);
  if (!access.hasPlus && (await chargeFreeComparison(supabase))) {
    return freeComparisonLimitResponse();
  }

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
