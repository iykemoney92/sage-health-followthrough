import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_TIME_ZONE,
  guessTimeZoneFromPhoneDigits,
  isValidTimeZone,
  normalizeTimeZone,
} from "@/lib/timezone";

/**
 * Resolve the IANA timezone used for scheduling check-ins / quiet hours.
 * Prefer profile column, then auth metadata, then phone-country guess.
 */
export async function resolveUserTimeZone(
  supabase: SupabaseClient,
  ownerId: string,
  options?: {
    phoneDigits?: string | null;
    authMetadata?: Record<string, unknown> | null;
  },
): Promise<string> {
  let profileTz: string | null = null;
  let profilePhone: string | null = null;

  const withTz = await supabase
    .from("nura_profiles")
    .select("timezone, phone")
    .eq("id", ownerId)
    .maybeSingle();

  if (!withTz.error) {
    profileTz = (withTz.data?.timezone as string | null) ?? null;
    profilePhone = (withTz.data?.phone as string | null) ?? null;
  } else {
    const withoutTz = await supabase
      .from("nura_profiles")
      .select("phone")
      .eq("id", ownerId)
      .maybeSingle();
    profilePhone = (withoutTz.data?.phone as string | null) ?? null;
  }

  if (isValidTimeZone(profileTz)) return normalizeTimeZone(profileTz);

  let metaTz = options?.authMetadata?.timezone;
  if (typeof metaTz !== "string") {
    // Voice / WhatsApp / agent paths often omit metadata — pull it when we can.
    try {
      const { data } = await supabase.auth.admin.getUserById(ownerId);
      metaTz = data?.user?.user_metadata?.timezone;
    } catch {
      // anon clients can't admin-fetch; fall through to phone guess
    }
  }
  if (typeof metaTz === "string" && isValidTimeZone(metaTz)) {
    return normalizeTimeZone(metaTz);
  }

  const guessed =
    guessTimeZoneFromPhoneDigits(options?.phoneDigits || profilePhone) || DEFAULT_TIME_ZONE;
  return normalizeTimeZone(guessed);
}
