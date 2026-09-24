import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { hashInviteToken, INVITE_TOKEN_PATTERN } from "@/lib/care-circle";

/**
 * The service-role half of invites. Everything here runs with RLS bypassed, so each function
 * re-derives what the caller is allowed to learn instead of trusting the request: a preview
 * reveals only what the link itself implies (whose plan, what it's called), and acceptance
 * writes exactly one membership for exactly the signed-in user.
 */

export type InvitePreview =
  | { status: "invalid" }
  | { status: "expired"; planTitle: string; ownerName: string }
  | { status: "used"; planTitle: string; ownerName: string; planId: string; acceptedBy: string | null }
  | { status: "valid"; planTitle: string; ownerName: string; planId: string; ownerId: string };

type InviteRow = {
  id: string;
  plan_id: string;
  owner_id: string;
  created_by: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

async function loadInvite(token: string) {
  if (!INVITE_TOKEN_PATTERN.test(token)) return null;
  const admin = getSupabaseAdminClient();
  const { data: invite } = await admin
    .from("nura_plan_invites")
    .select("id, plan_id, owner_id, created_by, expires_at, accepted_by, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invite || invite.revoked_at) return null;

  const [{ data: plan }, { data: profile }] = await Promise.all([
    admin.from("nura_plans").select("id, title, status").eq("id", invite.plan_id).maybeSingle(),
    admin.from("nura_profiles").select("display_name").eq("id", invite.owner_id).maybeSingle(),
  ]);
  if (!plan) return null;

  const ownerName = ((profile?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Someone";
  return { invite: invite as InviteRow, planTitle: plan.title as string, ownerName };
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const loaded = await loadInvite(token);
  if (!loaded) return { status: "invalid" };
  const { invite, planTitle, ownerName } = loaded;
  if (invite.accepted_at) return { status: "used", planTitle, ownerName, planId: invite.plan_id, acceptedBy: invite.accepted_by };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { status: "expired", planTitle, ownerName };
  return { status: "valid", planTitle, ownerName, planId: invite.plan_id, ownerId: invite.owner_id };
}

export type AcceptResult =
  | { ok: true; planId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "owner" };

/**
 * Turns an invite into a membership for `userId`. Idempotent for the person who already used
 * it (opening the link twice just takes them to the plan); anyone else finds it spent.
 */
export async function acceptInvite(token: string, userId: string): Promise<AcceptResult> {
  const loaded = await loadInvite(token);
  if (!loaded) return { ok: false, reason: "invalid" };
  const { invite } = loaded;

  if (invite.accepted_at) {
    return invite.accepted_by === userId ? { ok: true, planId: invite.plan_id } : { ok: false, reason: "used" };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (invite.owner_id === userId) return { ok: false, reason: "owner" };

  const admin = getSupabaseAdminClient();

  // Someone removed and re-invited keeps a single membership row - revive it.
  const { data: existing } = await admin
    .from("nura_plan_members")
    .select("id")
    .eq("plan_id", invite.plan_id)
    .eq("member_id", userId)
    .maybeSingle();
  const membership = existing
    ? await admin
        .from("nura_plan_members")
        .update({ revoked_at: null, accepted_at: new Date().toISOString(), invited_by: invite.created_by })
        .eq("id", existing.id)
    : await admin
        .from("nura_plan_members")
        .insert({ plan_id: invite.plan_id, member_id: userId, invited_by: invite.created_by });
  if (membership.error) throw new Error(membership.error.message);

  const spent = await admin
    .from("nura_plan_invites")
    .update({ accepted_by: userId, accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null);
  if (spent.error) throw new Error(spent.error.message);

  // A watcher has finished "setting up" the moment they join: sending them through the
  // patient onboarding (which exists to create their first Care plan) would be wrong.
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const metadata = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
  if (metadata.onboarding_complete !== true) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, onboarding_complete: true, joined_via_care_circle: true },
    });
  }

  return { ok: true, planId: invite.plan_id };
}
