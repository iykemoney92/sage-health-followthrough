import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nura stops reaching out to someone who has stopped answering.
 *
 * QA on 18 Nov 2026 found 5 people messaged for a week with 0 replies, one of them sent a near-identical
 * "Morning 🌿" note every day. After UNANSWERED_LIMIT check-ins with no reply, the next one is replaced
 * by a single "I'll pause these" note, and everything after that is held until they write back, at
 * which point the count starts again from zero. Calls about someone the owner cares for are not
 * covered: those go to the other person, whose silence is a different signal.
 */
export const UNANSWERED_LIMIT = 3;

/** Check-in outcomes that reached the person (or tried to) and so count as unanswered outreach. */
const DELIVERED = new Set([
  "sent_push",
  "sent_email",
  "sent_whatsapp",
  "placed",
  "missed_stale",
  "missed_consolidated",
  "redial_pending",
  "escalated_email",
  "escalated_push",
  "escalated_whatsapp",
]);

/** The pause note itself, and everything held after it. */
export const PAUSE_ASKED = "paused_asked";
export const PAUSE_HELD = "paused_quiet";

export type BackoffState = { unanswered: number; asked: boolean };
export type BackoffDecision = "send" | "ask" | "hold";

export function backoffDecision(state: BackoffState | undefined): BackoffDecision {
  if (!state || state.unanswered < UNANSWERED_LIMIT) return "send";
  return state.asked ? "hold" : "ask";
}

type CheckInRow = { owner_id: string; triggered_at: string | null; call_status: string | null };
type MessageRow = { owner_id: string; created_at: string };

/** Pure: the backoff state per owner from their replies and the check-ins sent to them. */
export function computeBackoff(
  ownerIds: string[],
  replies: MessageRow[],
  checkIns: CheckInRow[],
): Map<string, BackoffState> {
  const lastAnswer = new Map<string, number>();
  const bump = (owner: string, at: string | null) => {
    if (!at) return;
    const t = Date.parse(at);
    if (Number.isFinite(t) && t > (lastAnswer.get(owner) ?? 0)) lastAnswer.set(owner, t);
  };
  for (const r of replies) bump(r.owner_id, r.created_at);
  // A call they picked up is an answer too.
  for (const c of checkIns) if (c.call_status === "completed") bump(c.owner_id, c.triggered_at);

  const out = new Map<string, BackoffState>();
  for (const owner of ownerIds) out.set(owner, { unanswered: 0, asked: false });
  for (const c of checkIns) {
    const state = out.get(c.owner_id);
    if (!state || !c.triggered_at) continue;
    if (Date.parse(c.triggered_at) <= (lastAnswer.get(c.owner_id) ?? 0)) continue;
    if (c.call_status === PAUSE_ASKED) state.asked = true;
    else if (c.call_status && DELIVERED.has(c.call_status)) state.unanswered += 1;
  }
  return out;
}

/** Loads replies and recent check-ins for these owners and works out each one's backoff state. */
export async function loadBackoff(supabase: SupabaseClient, ownerIds: string[]): Promise<Map<string, BackoffState>> {
  const owners = Array.from(new Set(ownerIds));
  if (owners.length === 0) return new Map();
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: replies }, { data: checkIns }] = await Promise.all([
    supabase
      .from("nura_messages")
      .select("owner_id, created_at")
      .in("owner_id", owners)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("nura_check_ins")
      .select("owner_id, triggered_at, call_status")
      .in("owner_id", owners)
      .not("triggered_at", "is", null)
      .gte("triggered_at", since)
      .limit(2000),
  ]);
  return computeBackoff(owners, (replies ?? []) as MessageRow[], (checkIns ?? []) as CheckInRow[]);
}

/** The one note sent instead of the next check-in once someone has stopped answering. */
export function pauseNote(firstName: string): string {
  const hi = firstName && firstName !== "there" ? `Hi ${firstName}` : "Hi";
  return (
    `${hi}, I've sent you a few check-ins without hearing back, so I'll pause them for now. ` +
    `Reply here any time and I'll pick up again, or tell me how often you'd like to hear from me.`
  );
}
