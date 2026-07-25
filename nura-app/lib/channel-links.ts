import type { SupabaseClient } from "@supabase/supabase-js";
import { createWhatsappLinkCode } from "@/lib/whatsapp-link";

const LINK_TTL_MINUTES = 15;

type ChannelLinkResult = {
  code: string | null;
  expiresAt: string | null;
  linked: boolean;
  linkSaved: boolean;
  note: string | null;
};

export async function getOrCreateWhatsappLink(supabase: SupabaseClient, ownerId: string): Promise<ChannelLinkResult> {
  const now = new Date().toISOString();

  const { data: active } = await supabase
    .from("nura_channel_links")
    .select("channel_identifier, linked_at")
    .eq("owner_id", ownerId)
    .eq("provider", "whatsapp")
    .eq("status", "active")
    .order("linked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active?.channel_identifier) {
    return {
      code: null,
      expiresAt: null,
      linked: true,
      linkSaved: true,
      note: null,
    };
  }

  const { data: existing } = await supabase
    .from("nura_channel_links")
    .select("link_code, expires_at")
    .eq("owner_id", ownerId)
    .eq("provider", "whatsapp")
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.link_code && existing?.expires_at) {
    return {
      code: existing.link_code as string,
      expiresAt: existing.expires_at as string,
      linked: false,
      linkSaved: true,
      note: null,
    };
  }

  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createWhatsappLinkCode();
    const { error } = await supabase.from("nura_channel_links").insert({
      owner_id: ownerId,
      provider: "whatsapp",
      link_code: code,
      status: "pending",
      expires_at: expiresAt,
    });

    if (!error) {
      return { code, expiresAt, linked: false, linkSaved: true, note: null };
    }

    if (error.code !== "23505") {
      return {
        code,
        expiresAt,
        linked: false,
        linkSaved: false,
        note: "Link code generated. Apply the channel-link migration to persist phone linking.",
      };
    }
  }

  return {
    code: createWhatsappLinkCode(),
    expiresAt,
    linked: false,
    linkSaved: false,
    note: "Could not reserve a unique link code. Try again.",
  };
}
