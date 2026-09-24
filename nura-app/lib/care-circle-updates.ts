import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NURA_CORE_IDENTITY } from "@/lib/domain/nura-persona";

/**
 * The update Nura writes FOR the circle.
 *
 * Everything here is built from the same circle-safe facts a watcher may already read - the
 * plan, its roadmap, check-in status and recent observations. It never touches nura_messages
 * or nura_source_contexts, and the prompt tells the model who the reader is, so the text is
 * written for a family member rather than leaked from the owner's private conversation. The
 * owner reads the identical text: there is no "what my family is told" they can't see.
 */

/** A manual refresh reuses an update younger than this rather than calling the model again. */
export const CIRCLE_UPDATE_REUSE_HOURS = 24;
/** The scheduled job writes a fresh update once the latest is at least this old. */
export const CIRCLE_UPDATE_SCHEDULE_DAYS = 7;
/** How far back check-ins and observations are gathered. */
const FACTS_WINDOW_DAYS = 7;

export type CircleUpdate = {
  id: string;
  body: string;
  createdAt: string;
  requestedBy: "owner" | "member" | "schedule";
};

export type CircleFacts = {
  ownerFirstName: string;
  planTitle: string;
  why: string;
  focus: string;
  nextStep: string;
  category: string;
  milestones: { title: string; status: string; stepsDone: number; stepsTotal: number }[];
  currentMilestone: string | null;
  stepsDone: number;
  stepsTotal: number;
  checkInsDone: number;
  checkInsMissed: number;
  nextCheckIn: string | null;
  observations: { when: string; label: string; value: string }[];
  periodStart: string;
  periodEnd: string;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const MISSED_STATUSES = new Set(["missed_stale", "missed_consolidated", "failed"]);

/**
 * Gathers only what the circle is allowed to know. Run it with the reader's own session client
 * when a watcher asks for an update and RLS guarantees the same boundary a second time.
 */
export async function collectCircleFacts(supabase: SupabaseClient, planId: string): Promise<CircleFacts | null> {
  const now = new Date();
  const since = new Date(now.getTime() - FACTS_WINDOW_DAYS * 24 * 60 * 60_000);

  const { data: plan } = await supabase
    .from("nura_plans")
    .select("id, title, why_this_exists, current_focus, next_step, category, owner_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;

  const [{ data: ownerName }, { data: milestones }, { data: steps }, { data: recentCheckIns }, { data: upcoming }, { data: observations }] =
    await Promise.all([
      supabase.rpc("nura_circle_owner_name", { target_plan: planId }),
      supabase.from("nura_plan_milestones").select("id, title, status, order_index").eq("plan_id", planId).order("order_index"),
      supabase.from("nura_plan_steps").select("milestone_id, status").eq("plan_id", planId),
      supabase
        .from("nura_check_ins")
        .select("scheduled_for, completed_at, call_status")
        .eq("plan_id", planId)
        .gte("scheduled_for", since.toISOString())
        .lte("scheduled_for", now.toISOString()),
      supabase
        .from("nura_check_ins")
        .select("scheduled_for")
        .eq("plan_id", planId)
        .is("completed_at", null)
        .gt("scheduled_for", now.toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("nura_observations")
        .select("label, value, recorded_at")
        .eq("plan_id", planId)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(6),
    ]);

  const stepRows = steps ?? [];
  const milestoneFacts = (milestones ?? []).map((m) => {
    const mine = stepRows.filter((s) => s.milestone_id === m.id);
    return {
      title: m.title as string,
      status: (m.status as string) || "pending",
      stepsDone: mine.filter((s) => s.status === "done").length,
      stepsTotal: mine.length,
    };
  });
  const current = milestoneFacts.find((m) => m.status === "active") ?? milestoneFacts.find((m) => m.status !== "done") ?? null;

  let done = 0;
  let missed = 0;
  for (const row of recentCheckIns ?? []) {
    if (row.completed_at) done += 1;
    else if (MISSED_STATUSES.has((row.call_status as string) || "")) missed += 1;
  }

  return {
    ownerFirstName: ((ownerName as string | null) ?? "").trim().split(/\s+/)[0] || "They",
    planTitle: plan.title as string,
    why: ((plan.why_this_exists as string) || "").trim(),
    focus: ((plan.current_focus as string) || "").trim(),
    nextStep: ((plan.next_step as string) || "").trim(),
    category: (plan.category as string) || "general_health",
    milestones: milestoneFacts,
    currentMilestone: current?.title ?? null,
    stepsDone: stepRows.filter((s) => s.status === "done").length,
    stepsTotal: stepRows.length,
    checkInsDone: done,
    checkInsMissed: missed,
    nextCheckIn: upcoming?.scheduled_for ? formatWhen(upcoming.scheduled_for as string) : null,
    observations: (observations ?? []).map((o) => ({
      when: formatDay(o.recorded_at as string),
      label: o.label as string,
      value: String(o.value ?? "").slice(0, 120),
    })),
    periodStart: since.toISOString(),
    periodEnd: now.toISOString(),
  };
}

function fallbackUpdate(f: CircleFacts) {
  const name = f.ownerFirstName;
  const parts = [`${name} is working on "${f.planTitle}".`];
  if (f.focus) parts.push(`The focus right now is: ${f.focus}`);
  if (f.stepsTotal > 0) parts.push(`${f.stepsDone} of ${f.stepsTotal} steps on the roadmap are done.`);
  if (f.checkInsDone + f.checkInsMissed > 0) {
    parts.push(`This week ${name} did ${f.checkInsDone} check-in${f.checkInsDone === 1 ? "" : "s"}${f.checkInsMissed > 0 ? ` and missed ${f.checkInsMissed}` : ""}.`);
  } else {
    parts.push("It has been a quiet week for check-ins, and that's okay.");
  }
  if (f.nextCheckIn) parts.push(`Nura's next check-in is ${f.nextCheckIn}.`);
  parts.push(`A short message asking how it's going would mean a lot.`);
  return parts.join(" ");
}

/** Asks Nura to write the update for a family member; falls back to a plain summary if she can't. */
export async function composeCircleUpdate(facts: CircleFacts): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = fallbackUpdate(facts);
  if (!apiKey) return fallback;

  const factsText = [
    `Owner first name: ${facts.ownerFirstName}`,
    `Care plan: ${facts.planTitle}`,
    facts.why && `Why it exists: ${facts.why}`,
    facts.focus && `Current focus: ${facts.focus}`,
    facts.nextStep && `Next step: ${facts.nextStep}`,
    `Roadmap: ${facts.stepsDone} of ${facts.stepsTotal} steps done` +
      (facts.currentMilestone ? `; current milestone "${facts.currentMilestone}"` : ""),
    ...facts.milestones.map((m) => `- Milestone "${m.title}": ${m.status}, ${m.stepsDone}/${m.stepsTotal} steps`),
    `Check-ins in the last 7 days: ${facts.checkInsDone} done, ${facts.checkInsMissed} missed`,
    `Next check-in: ${facts.nextCheckIn ?? "none scheduled"}`,
    facts.observations.length > 0
      ? `Recent notes ${facts.ownerFirstName} logged:\n` + facts.observations.map((o) => `- ${o.when} · ${o.label}: ${o.value}`).join("\n")
      : "Recent notes: none this week",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 350,
      system:
        NURA_CORE_IDENTITY +
        ` You are writing a short update FOR A FAMILY MEMBER, FRIEND OR CARER in ${facts.ownerFirstName}'s Care circle - the reader is NOT ${facts.ownerFirstName}. ` +
        "Audience rules, none negotiable: you know only the facts you are given - never invent, never hint at anything from private conversations, never mention messages or chats at all. " +
        "No medical advice, no diagnosis, no medication instructions, no clinical detail beyond what the facts say. " +
        `Refer to ${facts.ownerFirstName} by first name and with they/them. ` +
        "Warm, plain, human British English; three to five short sentences in one paragraph, no headings, no bullet points, no sign-off. " +
        "If check-ins were missed, say so gently and without alarm. If there is little to report, say it has been a quiet week and that this is fine. " +
        `Finish with ONE gentle, concrete way the reader could support ${facts.ownerFirstName} this week - a message, a call, doing part of the plan together - never a list of tasks and never pressure.`,
      messages: [{ role: "user", content: `${factsText}\n\nWrite the circle update now.` }],
    });
    const block = message.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    return text || fallback;
  } catch (error) {
    console.error("[circle-update] compose failed", error);
    return fallback;
  }
}

export async function getLatestCircleUpdate(supabase: SupabaseClient, planId: string): Promise<CircleUpdate | null> {
  const { data } = await supabase
    .from("nura_plan_circle_updates")
    .select("id, body, created_at, requested_by")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, body: data.body as string, createdAt: data.created_at as string, requestedBy: data.requested_by as CircleUpdate["requestedBy"] };
}

export function isOlderThanHours(iso: string, hours: number) {
  return Date.now() - new Date(iso).getTime() > hours * 60 * 60_000;
}

/**
 * Writes a new update. `readClient` gathers the facts (use the requester's own session so RLS
 * bounds what can be said); `writeClient` inserts the row (the owner's session, or the service
 * role when a watcher or the schedule asked - watchers cannot insert here themselves).
 */
export async function writeCircleUpdate(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
  planId: string,
  requestedBy: CircleUpdate["requestedBy"],
): Promise<CircleUpdate | null> {
  const facts = await collectCircleFacts(readClient, planId);
  if (!facts) return null;
  const body = await composeCircleUpdate(facts);
  const { data, error } = await writeClient
    .from("nura_plan_circle_updates")
    .insert({ plan_id: planId, body, period_start: facts.periodStart, period_end: facts.periodEnd, requested_by: requestedBy })
    .select("id, body, created_at, requested_by")
    .single();
  if (error || !data) throw new Error(error?.message ?? "could not store circle update");
  return { id: data.id as string, body: data.body as string, createdAt: data.created_at as string, requestedBy };
}
