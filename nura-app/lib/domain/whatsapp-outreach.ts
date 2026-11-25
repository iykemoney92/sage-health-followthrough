import type { SupabaseClient } from "@supabase/supabase-js";
import { placeOutboundCall, placeWhatsappCall } from "@/lib/integrations/elevenlabs";
import {
  callPermissionTemplateName,
  checkinTemplateName,
  getWhatsappCallPermission,
  META_OUTSIDE_WINDOW_ERROR,
  metaErrorCode,
  sendWhatsappTemplate,
  sendWhatsappText,
  templateParam,
  whatsappPhoneNumberId,
  whatsappTemplateLanguage,
} from "@/lib/integrations/whatsapp";
import { logger } from "@/lib/logger";

/**
 * WhatsApp messages and calls Nura starts herself (check-ins, missed-call follow-ups).
 *
 * Messages: a free-form text only reaches someone who wrote to Nura in the last 24 hours. Outside
 * that window Meta accepts the send and drops it, so Nura sends the approved check-in template
 * instead; the person's reply reopens the window and the conversation carries on as normal.
 *
 * Calls: Nura rings on WhatsApp when the person has allowed it, otherwise on their phone line as
 * before, and asks once (then at most every 30 days) whether she may call on WhatsApp.
 */

/** Meta's window is 24h; stop an hour early so a send near the edge isn't silently dropped. */
const SERVICE_WINDOW_MS = 23 * 60 * 60 * 1000;
/** Don't ask again for a month if they ignored or declined the call-permission request. */
const CALL_PERMISSION_ASK_GAP_MS = 30 * 24 * 60 * 60 * 1000;

export function isWithinServiceWindow(lastInboundAt: string | null | undefined, now = Date.now()) {
  if (!lastInboundAt) return false;
  const at = Date.parse(lastInboundAt);
  return Number.isFinite(at) && now - at < SERVICE_WINDOW_MS;
}

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d]/g, "");
}

type WhatsappLink = { id: string; last_inbound_at: string | null; call_permission_requested_at: string | null };

async function loadActiveLink(supabase: SupabaseClient, phoneDigits: string): Promise<WhatsappLink | null> {
  try {
    const { data, error } = await supabase
      .from("nura_channel_links")
      .select("id, last_inbound_at, call_permission_requested_at")
      .eq("provider", "whatsapp")
      .eq("channel_identifier", phoneDigits)
      .eq("status", "active")
      .limit(1);
    if (error) return null;
    return ((data ?? [])[0] as WhatsappLink | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Called by the WhatsApp webhook whenever the person writes: this is what opens the 24h window. */
export async function recordWhatsappInbound(supabase: SupabaseClient, phone: string) {
  const digits = digitsOnly(phone);
  if (!digits) return;
  try {
    await supabase
      .from("nura_channel_links")
      .update({ last_inbound_at: new Date().toISOString() })
      .eq("provider", "whatsapp")
      .eq("channel_identifier", digits)
      .eq("status", "active");
  } catch {
    // Non-blocking: worst case the next proactive message goes out as a template.
  }
}

export type ProactiveWhatsappResult =
  | { skipped: true; error?: undefined; via?: undefined }
  | { skipped: false; error: string; via?: undefined }
  | { skipped: false; error?: undefined; via: "text" | "template" };

/**
 * Sends a message Nura starts. `body` is the full text, used when the 24h window is open.
 * `template` fills the approved check-in template used when it isn't:
 * "Hi {{1}}, it's Nura. It's time for your check-in about {{2}}. Reply here whenever you're ready."
 */
export async function sendProactiveWhatsapp(
  supabase: SupabaseClient,
  phone: string,
  body: string,
  template: { firstName: string | null | undefined; topic: string | null | undefined },
): Promise<ProactiveWhatsappResult> {
  const to = digitsOnly(phone);
  const link = await loadActiveLink(supabase, to);

  if (isWithinServiceWindow(link?.last_inbound_at)) {
    const text = await sendWhatsappText(to, body);
    if (text.skipped) return { skipped: true };
    if (!text.error) return { skipped: false, via: "text" };
    // Only the "window closed" refusal is worth a second try as a template.
    if (metaErrorCode(text.error) !== META_OUTSIDE_WINDOW_ERROR) return { skipped: false, error: text.error };
  }

  const sent = await sendWhatsappTemplate(to, checkinTemplateName(), [
    templateParam(template.firstName, "there", 40),
    templateParam(template.topic, "how you've been", 80),
  ]);
  if (sent.skipped) return { skipped: true };
  if (sent.error) return { skipped: false, error: sent.error };
  return { skipped: false, via: "template" };
}

export function whatsappCallsEnabled() {
  return (
    process.env.NURA_WHATSAPP_CALLS?.trim().toLowerCase() !== "off" &&
    Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && whatsappPhoneNumberId() && process.env.ELEVENLABS_API_KEY?.trim())
  );
}

type CheckinCallInput = {
  toNumber: string;
  dynamicVariables: Record<string, string>;
  agentId?: string;
  firstMessage?: string;
  /** False for calls to someone the owner cares for: they have no WhatsApp link with Nura. */
  allowWhatsapp: boolean;
  /** First name for the permission request, if one has to be sent. */
  firstName?: string | null;
};

/**
 * Places a check-in call: on WhatsApp when the number being called is the person's linked
 * WhatsApp number and they've allowed calls, otherwise on the phone line. A WhatsApp call that
 * fails to start falls back to the phone line in the same attempt, so this only throws when the
 * phone call can't start either. Redials always use the phone line.
 */
export async function placeCheckinCall(
  supabase: SupabaseClient,
  input: CheckinCallInput,
): Promise<{ conversation_id?: string; via: "whatsapp" | "phone" }> {
  const phoneCall = async () => {
    const call = await placeOutboundCall({
      toNumber: input.toNumber,
      dynamicVariables: input.dynamicVariables,
      agentId: input.agentId,
      firstMessage: input.firstMessage,
    });
    return { conversation_id: call.conversation_id, via: "phone" as const };
  };

  const phoneNumberId = whatsappPhoneNumberId();
  if (!input.allowWhatsapp || !whatsappCallsEnabled() || !phoneNumberId) return phoneCall();

  const userWaId = digitsOnly(input.toNumber);
  const link = await loadActiveLink(supabase, userWaId);
  if (!link) return phoneCall();

  const permission = await getWhatsappCallPermission(userWaId);
  if (permission?.canStartCall) {
    try {
      const call = await placeWhatsappCall({
        whatsappUserId: userWaId,
        whatsappPhoneNumberId: phoneNumberId,
        permissionTemplateName: callPermissionTemplateName(),
        permissionTemplateLanguage: whatsappTemplateLanguage(),
        dynamicVariables: input.dynamicVariables,
        agentId: input.agentId,
        firstMessage: input.firstMessage,
      });
      logger.info("whatsapp.call.placed", { toSuffix: userWaId.slice(-4) });
      return { conversation_id: call.conversation_id ?? undefined, via: "whatsapp" };
    } catch (error) {
      logger.warn("whatsapp.call.start_failed_using_phone", {
        toSuffix: userWaId.slice(-4),
        message: error instanceof Error ? error.message : String(error),
      });
      return phoneCall();
    }
  }

  // Not allowed yet: ring the phone line now, and ask (rarely) whether WhatsApp calls are OK.
  const askedAt = link.call_permission_requested_at ? Date.parse(link.call_permission_requested_at) : NaN;
  const askedRecently = Number.isFinite(askedAt) && Date.now() - askedAt < CALL_PERMISSION_ASK_GAP_MS;
  if (permission?.canRequest && !askedRecently) {
    void askWhatsappCallPermission(supabase, link.id, userWaId, input.firstName);
  }
  return phoneCall();
}

async function askWhatsappCallPermission(
  supabase: SupabaseClient,
  linkId: string,
  userWaId: string,
  firstName: string | null | undefined,
) {
  try {
    // Stamp first so a slow or failed send can't turn into a request on every check-in.
    await supabase.from("nura_channel_links").update({ call_permission_requested_at: new Date().toISOString() }).eq("id", linkId);
    const sent = await sendWhatsappTemplate(userWaId, callPermissionTemplateName(), [templateParam(firstName, "there", 40)]);
    logger.info("whatsapp.call_permission.requested", {
      toSuffix: userWaId.slice(-4),
      ok: !sent.skipped && !sent.error,
    });
  } catch (error) {
    logger.warn("whatsapp.call_permission.request_error", { message: error instanceof Error ? error.message : String(error) });
  }
}
