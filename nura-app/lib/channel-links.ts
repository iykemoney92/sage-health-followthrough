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

/** Read-only WhatsApp link state — does not create a pending code. */
export async function getWhatsappConnectionStatus(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ linked: boolean; pendingCode: string | null; expiresAt: string | null }> {
  const now = new Date().toISOString();

  const { data: active } = await supabase
    .from("nura_channel_links")
    .select("channel_identifier")
    .eq("owner_id", ownerId)
    .eq("provider", "whatsapp")
    .eq("status", "active")
    .order("linked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active?.channel_identifier) {
    return { linked: true, pendingCode: null, expiresAt: null };
  }

  const { data: pending } = await supabase
    .from("nura_channel_links")
    .select("link_code, expires_at")
    .eq("owner_id", ownerId)
    .eq("provider", "whatsapp")
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    linked: false,
    pendingCode: (pending?.link_code as string | undefined) ?? null,
    expiresAt: (pending?.expires_at as string | undefined) ?? null,
  };
}

export async function disconnectWhatsapp(supabase: SupabaseClient, ownerId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("nura_channel_links")
    .update({ status: "revoked", expires_at: now })
    .eq("owner_id", ownerId)
    .eq("provider", "whatsapp")
    .in("status", ["active", "pending"]);

  return { ok: !error, error: error?.message ?? null };
}

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
      // Never hand the user a code that wasn't persisted — WhatsApp would look
      // linked in the chat composer but the webhook couldn't verify it.
      return {
        code: null,
        expiresAt: null,
        linked: false,
        linkSaved: false,
        note: error.message || "Could not save a WhatsApp link code. Try again in a moment.",
      };
    }
  }

  return {
    code: null,
    expiresAt: null,
    linked: false,
    linkSaved: false,
    note: "Could not reserve a unique link code. Try again.",
  };
}
