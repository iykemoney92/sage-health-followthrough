import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Times people anchor check-ins to instead of a clock: "after work", "after school", "after the
 * school run". Nura asks once what that usually means for this person, keeps it on their profile
 * (nura_profiles.routine_times), and uses it next time without asking again.
 */
export const ROUTINE_ANCHORS = ["after_work", "after_school", "after_school_run"] as const;
export type RoutineAnchor = (typeof ROUTINE_ANCHORS)[number];
/** Local wall-clock time, 24-hour "HH:MM", in the person's own time zone. */
export type RoutineTimes = Partial<Record<RoutineAnchor, string>>;

const LABELS: Record<RoutineAnchor, string> = {
  after_work: "after work",
  after_school: "after school",
  after_school_run: "after the school run",
};

const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Keeps only known anchors with a valid time, normalised to zero-padded "HH:MM". */
export function normalizeRoutineTimes(raw: unknown): RoutineTimes {
  if (!raw || typeof raw !== "object") return {};
  const out: RoutineTimes = {};
  for (const anchor of ROUTINE_ANCHORS) {
    const value = (raw as Record<string, unknown>)[anchor];
    if (typeof value !== "string") continue;
    const match = value.trim().match(HH_MM);
    if (match) out[anchor] = `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return out;
}

function spokenTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/** One line for the model saying what's already known, e.g. `after work = 18:00 (6pm)`. */
export function describeRoutineTimes(times: RoutineTimes) {
  const known = ROUTINE_ANCHORS.filter((anchor) => times[anchor]).map(
    (anchor) => `${LABELS[anchor]} = ${times[anchor]} (${spokenTime(times[anchor]!)})`,
  );
  return known.length > 0 ? known.join("; ") : "none saved yet";
}

export async function loadRoutineTimes(supabase: SupabaseClient, ownerId: string): Promise<RoutineTimes> {
  const { data } = await supabase.from("nura_profiles").select("routine_times").eq("id", ownerId).maybeSingle();
  return normalizeRoutineTimes(data?.routine_times);
}

/** Merges newly learned times into the profile. A no-op when nothing new was learned. */
export async function saveRoutineTimes(
  supabase: SupabaseClient,
  ownerId: string,
  current: RoutineTimes,
  learned: RoutineTimes | null | undefined,
) {
  const update = normalizeRoutineTimes(learned);
  const changed = ROUTINE_ANCHORS.some((anchor) => update[anchor] && update[anchor] !== current[anchor]);
  if (!changed) return current;
  const merged = { ...current, ...update };
  const { error } = await supabase.from("nura_profiles").update({ routine_times: merged }).eq("id", ownerId);
  if (error) console.error("[routine-times] save failed", error.message);
  return merged;
}
