import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyMilestone } from "@/lib/domain/plan-journey";

/**
 * Care circle: who else may see a Care plan.
 *
 * Every helper here runs through the caller's session client, so Postgres RLS is the thing
 * deciding what comes back - these functions only interpret the result. A revoked member
 * gets an empty plan lookup from the database, not from a check in this file.
 */

export type PlanRole = "owner" | "watcher";

export type PlanAccess = {
  plan: Record<string, unknown>;
  role: PlanRole;
  /** Set for watchers: the owner's display name for the "shared with you by" banner. */
  ownerName: string | null;
};

/** Loads a plan the caller may see and says in what capacity. Null means "not for you". */
export async function getPlanAccess(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
): Promise<PlanAccess | null> {
  const { data: plan } = await supabase.from("nura_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return null;

  if ((plan.owner_id as string) === userId) {
    return { plan, role: "owner", ownerName: null };
  }

  const { data: ownerName } = await supabase.rpc("nura_circle_owner_name", { target_plan: planId });
  return { plan, role: "watcher", ownerName: (ownerName as string | null) ?? null };
}

type StepStatus = JourneyMilestone["steps"][number]["status"];

function asStatus(value: unknown): StepStatus {
  return value === "active" || value === "done" ? value : "pending";
}

/**
 * The journey exactly as stored - for watchers. ensureJourney() drafts milestones when a plan
 * has none, which is an owner-only side effect a read-only viewer must never trigger.
 */
export async function readJourney(supabase: SupabaseClient, planId: string): Promise<JourneyMilestone[]> {
  const { data: milestones } = await supabase
    .from("nura_plan_milestones")
    .select("id, title, description, status, order_index")
    .eq("plan_id", planId)
    .order("order_index", { ascending: true });
  if (!milestones || milestones.length === 0) return [];

  const { data: steps } = await supabase
    .from("nura_plan_steps")
    .select("id, milestone_id, title, context_prompt, status, order_index")
    .in("milestone_id", milestones.map((m) => m.id as string))
    .order("order_index", { ascending: true });

  return milestones.map((milestone) => ({
    id: milestone.id as string,
    title: milestone.title as string,
    description: (milestone.description as string | null) ?? null,
    status: asStatus(milestone.status),
    orderIndex: (milestone.order_index as number) ?? 0,
    steps: (steps ?? [])
      .filter((step) => step.milestone_id === milestone.id)
      .map((step) => ({
        id: step.id as string,
        title: step.title as string,
        contextPrompt: (step.context_prompt as string) ?? "",
        status: asStatus(step.status),
        orderIndex: (step.order_index as number) ?? 0,
      })),
  }));
}

export type CircleMember = {
  memberId: string;
  displayName: string;
  email: string | null;
  acceptedAt: string;
};

/** Everyone currently watching a plan. The database returns rows only to the plan's owner. */
export async function listCircleMembers(supabase: SupabaseClient, planId: string): Promise<CircleMember[]> {
  const { data } = await supabase.rpc("nura_circle_members", { target_plan: planId });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    memberId: row.member_id as string,
    displayName: (row.display_name as string) || "Someone",
    email: (row.email as string | null) ?? null,
    acceptedAt: row.accepted_at as string,
  }));
}

export type SharedPlanSummary = {
  id: string;
  title: string;
  category: string;
  status: string;
  updatedAt: string;
  ownerName: string;
};

/** Plans other people have shared with the caller. */
export async function listSharedWithMe(supabase: SupabaseClient, userId: string): Promise<SharedPlanSummary[]> {
  const { data: memberships } = await supabase
    .from("nura_plan_members")
    .select("plan_id")
    .eq("member_id", userId)
    .is("revoked_at", null);
  const planIds = (memberships ?? []).map((row) => row.plan_id as string);
  if (planIds.length === 0) return [];

  const { data: plans } = await supabase
    .from("nura_plans")
    .select("id, title, category, status, updated_at")
    .in("id", planIds)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (!plans || plans.length === 0) return [];

  const named = await Promise.all(
    plans.map(async (plan) => {
      const { data: ownerName } = await supabase.rpc("nura_circle_owner_name", { target_plan: plan.id as string });
      return {
        id: plan.id as string,
        title: plan.title as string,
        category: (plan.category as string) || "general_health",
        status: (plan.status as string) || "active",
        updatedAt: plan.updated_at as string,
        ownerName: (ownerName as string | null) || "Someone",
      };
    }),
  );
  return named;
}

// ---------------------------------------------------------------------------------------------
// Invites (owner side). Acceptance lives in lib/care-circle-admin.ts because the person
// accepting is, by definition, not yet allowed to read anything about the plan.
// ---------------------------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;
/** Cookie that remembers which invite a visitor opened before they had an account. */
export const PENDING_INVITE_COOKIE = "nura_pending_invite";
/** What a raw invite token looks like: 24 random bytes, base64url. */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,64}$/;

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/join/${token}`;
}

/** A wa.me link with no recipient: WhatsApp asks the sender who to send it to. */
export function whatsappShareUrl(planTitle: string, url: string) {
  const text =
    `Hi — I'm using Nura to keep on top of "${planTitle}". ` +
    `I'd like you to be able to see how it's going. Tap to join my Care circle: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type CreatedInvite = { token: string; expiresAt: string };

/**
 * Mints a single-use invite for a plan the caller owns. Only the hash is stored; the raw token
 * exists in the link and nowhere else. The insert runs under owner_manages_invites, so a
 * caller who doesn't own the plan gets an RLS error rather than an invite.
 */
export async function createInvite(supabase: SupabaseClient, userId: string, planId: string): Promise<CreatedInvite> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60_000).toISOString();
  const { error } = await supabase.from("nura_plan_invites").insert({
    plan_id: planId,
    token_hash: hashInviteToken(token),
    created_by: userId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}
