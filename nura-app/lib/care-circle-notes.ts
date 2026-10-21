import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToOwner } from "@/lib/integrations/push";

/**
 * Pass-on notes: the only words of the owner's that ever reach the circle, and only by choice.
 *
 * A note is either typed by the owner on the plan page or read back to them by Nura at the end
 * of a check-in call and confirmed with a yes. It is stored and shown exactly as given - no
 * model rewrites it - and the owner can withdraw it, which hides it from the circle at once.
 */

export const CIRCLE_NOTE_MAX_CHARS = 500;
/** Notes older than this drop off the plan page and out of the weekly email. */
export const CIRCLE_NOTE_WINDOW_DAYS = 14;
/** A plan gets at most this many notes a day, however they arrive. */
const DAILY_NOTE_LIMIT = 5;

export type CircleNoteSource = "owner_app" | "voice_call";

export type CircleNote = {
  id: string;
  body: string;
  source: CircleNoteSource;
  createdAt: string;
  withdrawn: boolean;
};

function toNote(row: Record<string, unknown>): CircleNote {
  return {
    id: row.id as string,
    body: row.body as string,
    source: row.source as CircleNoteSource,
    createdAt: row.created_at as string,
    withdrawn: Boolean(row.withdrawn_at),
  };
}

/** Collapses whitespace and trims to the stored limit; empty means "nothing to pass on". */
export function cleanNoteBody(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, CIRCLE_NOTE_MAX_CHARS);
}

/**
 * Recent notes for a plan. Through a watcher's session RLS already hides withdrawn ones; the
 * owner sees withdrawn notes too so they know what they took back.
 */
export async function listCircleNotes(
  supabase: SupabaseClient,
  planId: string,
  options: { since?: Date; includeWithdrawn?: boolean } = {},
): Promise<CircleNote[]> {
  const since = options.since ?? new Date(Date.now() - CIRCLE_NOTE_WINDOW_DAYS * 24 * 60 * 60_000);
  let query = supabase
    .from("nura_plan_circle_notes")
    .select("id, body, source, created_at, withdrawn_at")
    .eq("plan_id", planId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (!options.includeWithdrawn) query = query.is("withdrawn_at", null);
  const { data } = await query;
  return (data ?? []).map(toNote);
}

export type CreateNoteResult =
  | { ok: true; note: CircleNote; duplicate: boolean }
  | { ok: false; error: "empty" | "limit" | "failed"; message?: string };

/**
 * Stores a note. Repeating the same words within ten minutes returns the existing note, so a
 * voice agent retrying its tool call (or a double tap) never sends the circle the same thing twice.
 */
export async function createCircleNote(
  writeClient: SupabaseClient,
  input: { planId: string; body: string; source: CircleNoteSource; checkInId?: string | null },
): Promise<CreateNoteResult> {
  const body = cleanNoteBody(input.body);
  if (!body) return { ok: false, error: "empty" };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: recent } = await writeClient
    .from("nura_plan_circle_notes")
    .select("id, body, source, created_at, withdrawn_at")
    .eq("plan_id", input.planId)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false });

  const tenMinutesAgo = Date.now() - 10 * 60_000;
  const same = (recent ?? []).find(
    (row) => !row.withdrawn_at && (row.body as string) === body && new Date(row.created_at as string).getTime() > tenMinutesAgo,
  );
  if (same) return { ok: true, note: toNote(same), duplicate: true };
  if ((recent ?? []).length >= DAILY_NOTE_LIMIT) return { ok: false, error: "limit" };

  const { data, error } = await writeClient
    .from("nura_plan_circle_notes")
    .insert({ plan_id: input.planId, body, source: input.source, check_in_id: input.checkInId ?? null })
    .select("id, body, source, created_at, withdrawn_at")
    .single();
  if (error || !data) return { ok: false, error: "failed", message: error?.message };
  return { ok: true, note: toNote(data), duplicate: false };
}

/** Active circle member ids for a plan. Needs a service-role client. */
export async function listActiveMemberIds(admin: SupabaseClient, planId: string): Promise<string[]> {
  const { data } = await admin.from("nura_plan_members").select("member_id").eq("plan_id", planId).is("revoked_at", null);
  return (data ?? []).map((row) => row.member_id as string);
}

/** The owner's first name as the circle knows them. Needs a service-role client. */
export async function planOwnerFirstName(admin: SupabaseClient, planId: string) {
  const { data: plan } = await admin.from("nura_plans").select("owner_id").eq("id", planId).maybeSingle();
  if (!plan) return "Someone";
  const { data: profile } = await admin.from("nura_profiles").select("display_name").eq("id", plan.owner_id).maybeSingle();
  return ((profile?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Someone";
}

/** Lets each watcher know a note arrived. Push only - the weekly email carries notes as well. */
export async function pushCircleNote(admin: SupabaseClient, planId: string, ownerFirstName: string, note: CircleNote) {
  let notified = 0;
  for (const memberId of await listActiveMemberIds(admin, planId)) {
    const push = await sendPushToOwner(memberId, {
      title: `A message from ${ownerFirstName}`,
      body: note.body.slice(0, 160),
      url: `/plans/${planId}`,
    }).catch(() => null);
    if (push && push.sent > 0) notified += 1;
  }
  return notified;
}
