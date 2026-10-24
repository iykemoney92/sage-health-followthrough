import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Referrals, phase 1. Everyone gets a personal link (usenura.app/r/<code>); a friend who signs
 * up through it gets 30 days of Nura Plus with no card, through the same service-role
 * complimentary grant the founder and App Review accounts use. Nothing goes to the person who
 * shared the link yet - phase 2 adds their reward once the friend completes a check-in.
 *
 * All of this runs with the service role (both tables are RLS-on, no policies), so each
 * function decides for itself what a caller may learn: a code reveals only the sharer's first
 * name, and the sharer only ever sees how many people joined, never who.
 */

/** Cookie that remembers which invite link a visitor opened before they had an account. */
export const REFERRAL_COOKIE = "nura_ref";
export const REFERRAL_COOKIE_DAYS = 30;
export const FRIEND_PLUS_DAYS = 30;
/** Only brand-new accounts can take the gift - an existing free user can't loop back through a link. */
export const NEW_ACCOUNT_WINDOW_DAYS = 14;
/** A link posted somewhere public stops handing out free months after this many in 30 days. */
export const REFERRER_MONTHLY_LIMIT = 20;
export const REFERRAL_REASON = "referral";

// No 0/O or 1/I: codes get read aloud and typed from screenshots.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
export const REFERRAL_CODE_PATTERN = /^[A-Z2-9]{8}$/;

const DAY_MS = 24 * 60 * 60_000;

export function generateReferralCode() {
  const bytes = randomBytes(CODE_LENGTH);
  // 32 symbols, so the low five bits of each byte pick one without bias.
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join("");
}

/** Accepts what people actually paste: lower case, stray spaces, a trailing slash. */
export function normalizeReferralCode(raw: string | null | undefined) {
  const code = (raw ?? "").trim().replace(/\/+$/, "").toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export function referralUrl(origin: string, code: string) {
  return `${origin.replace(/\/$/, "")}/r/${code}`;
}

export type FriendProfile = {
  trial_started_at?: string | null;
  subscription_status?: string | null;
  complimentary_plus_until?: string | null;
} | null;

export type IneligibleReason = "self" | "existing_account" | "already_had_plus" | "referrer_limit";

/**
 * Whether a new account may take the friend gift. Pure, so the rules are tested on their own:
 * not your own link, a genuinely new account, never had a trial, subscription or grant before,
 * and the link hasn't already handed out its monthly share.
 */
export function friendEligibility(input: {
  referrerId: string;
  refereeId: string;
  refereeCreatedAt: string | null | undefined;
  profile: FriendProfile;
  referrerRewardsLast30Days: number;
  now?: Date;
}): { ok: true } | { ok: false; reason: IneligibleReason } {
  const now = input.now ?? new Date();
  if (input.referrerId === input.refereeId) return { ok: false, reason: "self" };

  const createdAt = input.refereeCreatedAt ? new Date(input.refereeCreatedAt).getTime() : Number.NaN;
  if (Number.isNaN(createdAt) || now.getTime() - createdAt > NEW_ACCOUNT_WINDOW_DAYS * DAY_MS) {
    return { ok: false, reason: "existing_account" };
  }

  const profile = input.profile;
  if (profile) {
    const hadSubscription = ["trialing", "active", "grace_period", "cancelled", "expired"].includes(
      profile.subscription_status ?? "",
    );
    if (profile.trial_started_at || hadSubscription || profile.complimentary_plus_until) {
      return { ok: false, reason: "already_had_plus" };
    }
  }

  if (input.referrerRewardsLast30Days >= REFERRER_MONTHLY_LIMIT) return { ok: false, reason: "referrer_limit" };
  return { ok: true };
}

function firstNameOf(value: unknown) {
  return (typeof value === "string" ? value : "").trim().split(/\s+/)[0] || "";
}

/** The caller's code, minted on first use. A unique-key race just means reading the winner's. */
export async function getOrCreateReferralCode(admin: SupabaseClient, ownerId: string) {
  const { data: existing } = await admin.from("nura_referral_codes").select("code").eq("owner_id", ownerId).maybeSingle();
  if (existing?.code) return existing.code as string;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    const { error } = await admin.from("nura_referral_codes").insert({ owner_id: ownerId, code });
    if (!error) return code;
    // 23505 = unique violation: either this person raced themselves (owner_id) or the code is taken.
    if (error.code !== "23505") throw new Error(error.message);
    const { data: raced } = await admin.from("nura_referral_codes").select("code").eq("owner_id", ownerId).maybeSingle();
    if (raced?.code) return raced.code as string;
  }
  throw new Error("Could not mint a referral code");
}

/** Who a code belongs to, and the only thing about them a stranger with the link may see. */
export async function lookupReferralCode(admin: SupabaseClient, rawCode: string | null | undefined) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const { data: row } = await admin.from("nura_referral_codes").select("owner_id").eq("code", code).maybeSingle();
  if (!row?.owner_id) return null;

  const ownerId = row.owner_id as string;
  const { data: profile } = await admin.from("nura_profiles").select("display_name").eq("id", ownerId).maybeSingle();
  let firstName = firstNameOf(profile?.display_name);
  if (!firstName) {
    const { data } = await admin.auth.admin.getUserById(ownerId);
    firstName = firstNameOf(data.user?.user_metadata?.display_name);
  }
  return { code, ownerId, firstName: firstName || "A friend" };
}

export type ClaimResult =
  | { status: "rewarded"; until: string; referrerFirstName: string }
  | { status: "already_claimed" }
  | { status: "invalid_code" }
  | { status: "not_eligible"; reason: IneligibleReason };

/**
 * Records that `refereeId` arrived through `rawCode` and, if they qualify, switches on Plus for
 * FRIEND_PLUS_DAYS. Safe to call from every place an account can first appear (email sign-up,
 * Google/Apple via onboarding): the unique referee_id means only the first call does anything.
 */
export async function claimReferral(
  admin: SupabaseClient,
  input: { refereeId: string; rawCode: string | null | undefined; source: string; now?: Date },
): Promise<ClaimResult> {
  const now = input.now ?? new Date();
  const { data: prior } = await admin.from("nura_referrals").select("id").eq("referee_id", input.refereeId).maybeSingle();
  if (prior) return { status: "already_claimed" };

  const owner = await lookupReferralCode(admin, input.rawCode);
  if (!owner) return { status: "invalid_code" };

  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const [{ data: authUser }, { data: profile }, { count: recentRewards }] = await Promise.all([
    admin.auth.admin.getUserById(input.refereeId),
    admin
      .from("nura_profiles")
      .select("trial_started_at, subscription_status, complimentary_plus_until")
      .eq("id", input.refereeId)
      .maybeSingle(),
    admin
      .from("nura_referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", owner.ownerId)
      .eq("status", "rewarded")
      .gte("created_at", since),
  ]);

  const verdict = friendEligibility({
    referrerId: owner.ownerId,
    refereeId: input.refereeId,
    refereeCreatedAt: authUser.user?.created_at,
    profile: (profile ?? null) as FriendProfile,
    referrerRewardsLast30Days: recentRewards ?? 0,
    now,
  });

  if (!verdict.ok) {
    // Self-referral leaves no row: there's no "who referred me" to remember.
    if (verdict.reason !== "self") {
      await admin.from("nura_referrals").insert({
        referrer_id: owner.ownerId,
        referee_id: input.refereeId,
        code: owner.code,
        status: "not_eligible",
        not_eligible_reason: verdict.reason,
        source: input.source,
      });
    }
    return { status: "not_eligible", reason: verdict.reason };
  }

  const until = new Date(now.getTime() + FRIEND_PLUS_DAYS * DAY_MS).toISOString();
  // The row goes in first so a second, simultaneous claim loses on the unique key before it
  // can grant anything.
  const { error: insertError } = await admin.from("nura_referrals").insert({
    referrer_id: owner.ownerId,
    referee_id: input.refereeId,
    code: owner.code,
    status: "rewarded",
    friend_plus_until: until,
    source: input.source,
  });
  if (insertError) {
    if (insertError.code === "23505") return { status: "already_claimed" };
    throw new Error(insertError.message);
  }

  // Upsert, not update: an email sign-up has no profile row until onboarding writes one, and
  // onboarding's own upsert can't clear these columns (the protect trigger keeps them).
  const { error: grantError } = await admin
    .from("nura_profiles")
    .upsert(
      { id: input.refereeId, complimentary_plus_until: until, complimentary_plus_reason: REFERRAL_REASON },
      { onConflict: "id" },
    );
  if (grantError) {
    await admin
      .from("nura_referrals")
      .update({ status: "not_eligible", not_eligible_reason: "grant_failed", friend_plus_until: null })
      .eq("referee_id", input.refereeId);
    throw new Error(grantError.message);
  }

  return { status: "rewarded", until, referrerFirstName: owner.firstName };
}

/** The gift a person is currently enjoying, for onboarding to swap the card screen out. */
export async function getActiveFriendGift(admin: SupabaseClient, refereeId: string, now = new Date()) {
  const { data } = await admin
    .from("nura_referrals")
    .select("referrer_id, friend_plus_until")
    .eq("referee_id", refereeId)
    .eq("status", "rewarded")
    .maybeSingle();
  const until = data?.friend_plus_until as string | undefined;
  if (!data || !until || new Date(until).getTime() <= now.getTime()) return null;

  const { data: profile } = await admin
    .from("nura_profiles")
    .select("display_name")
    .eq("id", data.referrer_id as string)
    .maybeSingle();
  return { until, referrerFirstName: firstNameOf(profile?.display_name) || "A friend" };
}

/** How many people have joined through someone's link. A count only - never who. */
export async function countFriendsJoined(admin: SupabaseClient, referrerId: string) {
  const { count } = await admin
    .from("nura_referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId);
  return count ?? 0;
}
