import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the Nura account for an ElevenLabs / agent tool call.
 * Prefer explicit ownerId; otherwise match phone on profile or WhatsApp link.
 */
export async function resolveAgentOwnerId(
  supabase: SupabaseClient,
  options: { ownerId?: string | null; callerPhoneDigits?: string | null },
): Promise<{ ownerId: string | null; via: "ownerId" | "profile_phone" | "whatsapp_link" | null }> {
  if (options.ownerId) {
    return { ownerId: options.ownerId, via: "ownerId" };
  }

  const phone = options.callerPhoneDigits?.replace(/[^\d]/g, "") || null;
  if (!phone) return { ownerId: null, via: null };

  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (profile?.id) {
    return { ownerId: profile.id as string, via: "profile_phone" };
  }

  const { data: link } = await supabase
    .from("nura_channel_links")
    .select("owner_id")
    .eq("provider", "whatsapp")
    .eq("channel_identifier", phone)
    .eq("status", "active")
    .maybeSingle();

  if (link?.owner_id) {
    return { ownerId: link.owner_id as string, via: "whatsapp_link" };
  }

  return { ownerId: null, via: null };
}
