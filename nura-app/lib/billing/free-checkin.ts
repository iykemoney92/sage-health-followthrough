import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Everyone gets their first proactive check-in free, Plus or not. Before 31 Oct 2026 a person who
 * skipped the card screen at the end of onboarding never received a single check-in: each one was
 * marked `skipped_plus_required`, so they never saw what Nura is for (10 people had their first and
 * only check-in blocked). Now the trial screen comes after that first check-in instead of before it.
 *
 * A check-in counts as the free one once Nura has tried to reach the person through any channel:
 * a push or WhatsApp sent, a call placed, answered, re-dialled or missed. Failures, skips and the
 * row being claimed right now don't count, so a delivery error never uses it up.
 */
export const FREE_CHECKIN_USED_STATUSES = [
  "sent_push",
  "sent_whatsapp",
  "escalated_push",
  "placed",
  "redial_pending",
  "completed",
  "missed_stale",
  "missed_consolidated",
] as const;

/** Owners (from the list given) who have already had their free check-in. */
export async function ownersWhoUsedFreeCheckIn(supabase: SupabaseClient, ownerIds: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(ownerIds));
  if (unique.length === 0) return new Set();
  const { data, error } = await supabase
    .from("nura_check_ins")
    .select("owner_id")
    .in("owner_id", unique)
    .in("call_status", FREE_CHECKIN_USED_STATUSES as unknown as string[]);
  if (error) {
    // If this can't be read, treat everyone as having used it: the cost of a wrong answer is a
    // free check-in withheld (the pre-31-Oct behaviour), never unlimited free calls.
    console.error("[free-checkin] lookup failed:", error.message);
    return new Set(unique);
  }
  return new Set((data ?? []).map((row) => row.owner_id as string));
}

export async function hasUsedFreeCheckIn(supabase: SupabaseClient, ownerId: string): Promise<boolean> {
  return (await ownersWhoUsedFreeCheckIn(supabase, [ownerId])).has(ownerId);
}

type DueCheckIn = { id: string; owner_id: string; scheduled_for?: string | null };

/**
 * Of the check-ins due in this run, which may go out for someone without Plus: only the earliest
 * one for an owner who has not had their free check-in yet. Everything else for a non-Plus owner
 * stays gated, so two check-ins due at once can't both go out free.
 */
export function pickFreeCheckIns(
  due: DueCheckIn[],
  plusByOwner: Map<string, boolean>,
  usedFree: Set<string>,
): Set<string> {
  const earliestByOwner = new Map<string, DueCheckIn>();
  for (const checkIn of due) {
    if (plusByOwner.get(checkIn.owner_id)) continue;
    if (usedFree.has(checkIn.owner_id)) continue;
    const current = earliestByOwner.get(checkIn.owner_id);
    const at = (c: DueCheckIn) => (c.scheduled_for ? new Date(c.scheduled_for).getTime() : Number.POSITIVE_INFINITY);
    if (!current || at(checkIn) < at(current)) earliestByOwner.set(checkIn.owner_id, checkIn);
  }
  return new Set(Array.from(earliestByOwner.values()).map((c) => c.id));
}
