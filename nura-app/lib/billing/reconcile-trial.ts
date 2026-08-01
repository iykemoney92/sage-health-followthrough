import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ProfileTrialRow = {
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_current_period_ends_at?: string | null;
};

/**
 * If a profile is mid-trial with a shorter end than CARD_TRIAL_DAYS, stretch
 * our records to the promised 14-day trial. Stripe extension is handled by
 * the RevenueCat webhook path when a secret key is present.
 */
export async function reconcileShortCardTrial(
  supabase: SupabaseClient,
  ownerId: string,
) {
  const { data } = await supabase
    .from("nura_profiles")
    .select("subscription_status, trial_started_at, trial_ends_at, subscription_current_period_ends_at")
    .eq("id", ownerId)
    .maybeSingle();

  const profile = (data ?? {}) as ProfileTrialRow;
  if (profile.subscription_status !== "trialing" || !profile.trial_started_at) {
    return { updated: false as const };
  }

  const startedAt = new Date(profile.trial_started_at);
  if (Number.isNaN(startedAt.getTime())) return { updated: false as const };

  const promisedEnd = new Date(startedAt.getTime() + CARD_TRIAL_DAYS * MS_PER_DAY);
  const currentEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  if (currentEnd && !Number.isNaN(currentEnd.getTime()) && currentEnd.getTime() >= promisedEnd.getTime() - 12 * 60 * 60 * 1000) {
    return { updated: false as const };
  }

  const trialEndsAt = promisedEnd.toISOString();
  const { error } = await supabase
    .from("nura_profiles")
    .update({
      trial_ends_at: trialEndsAt,
      subscription_current_period_ends_at: trialEndsAt,
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  if (error) return { updated: false as const, error: error.message };
  return { updated: true as const, trialEndsAt };
}
