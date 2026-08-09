import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getSubscriptionAccess, isSubscriptionLockedOut } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { sendWhatsappText } from "@/lib/integrations/whatsapp";
import { extractWhatsappLinkCode } from "@/lib/whatsapp-link";
import { logger } from "@/lib/logger";
import {
  resolveDecision,
  applyPlanDecision,
  applyNextCheckIn,
  insertConversationTurn,
  type PlanSummary,
  type PlanContext,
  type HistoryTurn,
  type MessageAttachment,
} from "@/lib/domain/message-intake";
import { evaluateAndAdvanceJourney, ensureJourney, type PlanForJourney } from "@/lib/domain/plan-journey";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";

export const runtime = "nodejs";
/** Claude + WhatsApp send can exceed Meta's webhook patience; we ack first then finish here. */
export const maxDuration = 60;

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // Fail closed outside local development — never accept unsigned webhook traffic in prod.
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[whatsapp/webhook] WHATSAPP_APP_SECRET unset — allowing unsigned requests in development only");
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const left = Buffer.from(provided, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: "verification failed" }, { status: 403 });
}

const inboundSchema = z.object({
  id: z.string().optional(),
  from: z.string().min(5),
  text: z.string().default(""),
  media: z.array(z.object({
    kind: z.enum(["image", "audio", "document", "file"]).default("file"),
    name: z.string().default("WhatsApp attachment"),
    type: z.string().default("application/octet-stream"),
    summary: z.string().default("Shared through WhatsApp."),
  })).optional().default([]),
});

function extractInboundMessage(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const message = (raw as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
  })?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || typeof message !== "object") return null;

  const id = typeof message.id === "string" ? message.id : undefined;
  const from = typeof message.from === "string" ? message.from : "";
  const media: Array<{ kind: string; name: string; type: string; summary: string }> = [];
  let text = "";
  const type = typeof message.type === "string" ? message.type : "";

  switch (type) {
    case "text":
      text = (message.text as { body?: string } | undefined)?.body ?? "";
      break;
    case "image": {
      const image = message.image as { mime_type?: string; caption?: string } | undefined;
      media.push({
        kind: "image",
        name: "Photo",
        type: image?.mime_type ?? "image/jpeg",
        summary: "Shared through WhatsApp.",
      });
      text = image?.caption ?? "";
      break;
    }
    case "audio": {
      const audio = message.audio as { mime_type?: string } | undefined;
      media.push({
        kind: "audio",
        name: "Voice note",
        type: audio?.mime_type ?? "audio/ogg",
        summary: "Shared through WhatsApp.",
      });
      break;
    }
    case "document": {
      const document = message.document as { filename?: string; mime_type?: string; caption?: string } | undefined;
      media.push({
        kind: "document",
        name: document?.filename ?? "Document",
        type: document?.mime_type ?? "application/octet-stream",
        summary: "Shared through WhatsApp.",
      });
      text = document?.caption ?? "";
      break;
    }
    default:
      text = (message.text as { body?: string } | undefined)?.body ?? "";
  }

  return { id, from, text, media };
}

async function markReadAndTyping(messageId: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;

  try {
    await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch (error) {
    logger.warn("whatsapp_webhook.read_receipt_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getFirstName(supabase: ReturnType<typeof getSupabaseServerClient>, ownerId: string) {
  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("display_name")
    .eq("id", ownerId)
    .maybeSingle();

  const displayName = typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  const firstName = displayName.split(" ").filter(Boolean)[0] || "";
  if (!firstName || /^(whatsapp|nura|user|demo)$/i.test(firstName)) return "there";
  return firstName;
}

function linkedReply(firstName: string) {
  return `Hi ${firstName}, you're verified to be contacted here. Head back to the Nura app to continue where you left off — or send a message, voice note, image, or file right here anytime.`;
}

function alreadyLinkedReply(firstName: string) {
  return `Hi ${firstName}, you're already verified here. Head back to the Nura app to continue, or how can I help you today?`;
}

async function resolveOwnerForPhone(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  phone: string,
): Promise<{ ownerId: string; healed: boolean } | null> {
  const { data: channelLink, error: linkError } = await supabase
    .from("nura_channel_links")
    .select("owner_id")
    .eq("provider", "whatsapp")
    .eq("channel_identifier", phone)
    .eq("status", "active")
    .maybeSingle();

  if (linkError) {
    logger.error("whatsapp_webhook.link_lookup_failed", { message: linkError.message });
    return null;
  }

  if (channelLink?.owner_id) {
    return { ownerId: channelLink.owner_id as string, healed: false };
  }

  // Heal: profile has this phone but the active channel link was lost.
  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!profile?.id) return null;

  const ownerId = profile.id as string;
  const now = new Date().toISOString();
  const { error: healError } = await supabase.from("nura_channel_links").insert({
    owner_id: ownerId,
    provider: "whatsapp",
    channel_identifier: phone,
    link_code: `HEAL-${phone.slice(-8)}`,
    status: "active",
    linked_at: now,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (healError) {
    // Unique conflict on active identifier — treat as linked anyway.
    logger.warn("whatsapp_webhook.link_heal_failed", { message: healError.message });
  }

  return { ownerId, healed: true };
}

async function activatePendingLink(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  pendingId: string,
  ownerId: string,
  phone: string,
) {
  const now = new Date().toISOString();

  await supabase
    .from("nura_channel_links")
    .update({ status: "inactive" })
    .eq("provider", "whatsapp")
    .eq("channel_identifier", phone)
    .eq("status", "active");

  await supabase
    .from("nura_channel_links")
    .update({ status: "expired" })
    .eq("owner_id", ownerId)
    .eq("provider", "whatsapp")
    .eq("status", "pending")
    .neq("id", pendingId);

  const { data: channelLink, error } = await supabase
    .from("nura_channel_links")
    .update({
      channel_identifier: phone,
      status: "active",
      linked_at: now,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", pendingId)
    .select("owner_id")
    .maybeSingle();

  if (error || !channelLink) {
    return { ok: false as const, error: error?.message ?? "Link code not found or expired." };
  }

  await supabase.from("nura_profiles").upsert({ id: ownerId, phone });
  return { ok: true as const, ownerId };
}

async function handleInboundMessage(parsed: z.infer<typeof inboundSchema>) {
  const { id: messageId, from, text, media } = parsed;
  const phone = from.replace(/[^\d]/g, "");
  const code = extractWhatsappLinkCode(text);
  const supabase = getSupabaseServerClient();

  if (messageId) {
    void markReadAndTyping(messageId);
  }

  if (code) {
    const now = new Date().toISOString();
    const { data: pendingLink, error: pendingError } = await supabase
      .from("nura_channel_links")
      .select("id, owner_id")
      .eq("provider", "whatsapp")
      .eq("link_code", code)
      .eq("status", "pending")
      .gt("expires_at", now)
      .maybeSingle();

    if (pendingError) {
      logger.error("whatsapp_webhook.pending_lookup_failed", { message: pendingError.message });
      await sendWhatsappText(phone, "Something went wrong verifying that code. Please try Connect WhatsApp again from the Nura app.");
      return;
    }

    if (pendingLink) {
      const activated = await activatePendingLink(
        supabase,
        pendingLink.id as string,
        pendingLink.owner_id as string,
        phone,
      );
      if (!activated.ok) {
        logger.error("whatsapp_webhook.activate_failed", { message: activated.error });
        await sendWhatsappText(phone, "I couldn’t finish linking that code. Please open Connect WhatsApp in Nura for a fresh code.");
        return;
      }

      const firstName = await getFirstName(supabase, activated.ownerId);
      const outbound = await sendWhatsappText(phone, linkedReply(firstName));
      if (outbound.error) logger.error("whatsapp_webhook.outbound_failed", { phase: "linked", error: outbound.error });
      return;
    }

    const existing = await resolveOwnerForPhone(supabase, phone);
    if (existing) {
      const firstName = await getFirstName(supabase, existing.ownerId);
      const outbound = await sendWhatsappText(phone, alreadyLinkedReply(firstName));
      if (outbound.error) logger.error("whatsapp_webhook.outbound_failed", { phase: "already_linked", error: outbound.error });
      return;
    }

    await sendWhatsappText(
      phone,
      "I couldn’t verify that link code (it may have expired). Please open WhatsApp again from Nura so I can generate a fresh code.",
    );
    return;
  }

  if (/\blink\s*code\s*:/i.test(text)) {
    await sendWhatsappText(
      phone,
      "I couldn’t verify that link code. Please open WhatsApp again from Nura so I can generate a fresh code for this account.",
    );
    return;
  }

  const resolved = await resolveOwnerForPhone(supabase, phone);
  if (!resolved) {
    // Always reply — silent 404s are what made WhatsApp feel "broken".
    await sendWhatsappText(
      phone,
      "This WhatsApp isn’t linked to a Nura account yet. Open Nura → Me → Preferences (or onboarding), tap Connect WhatsApp, then send the new link code here.",
    );
    return;
  }

  const ownerId = resolved.ownerId;
  // Free users can chat on WhatsApp (same as in-app). Only expired / lapsed
  // subscriptions are blocked — proactive outbound check-ins stay Plus-gated elsewhere.
  const access = await getSubscriptionAccess(supabase, ownerId);
  if (isSubscriptionLockedOut(access)) {
    const firstName = await getFirstName(supabase, ownerId);
    const outbound = await sendWhatsappText(
      phone,
      `Hi ${firstName}, your Nura Plus trial or subscription has ended, so WhatsApp follow-up is paused. Open Nura to renew Plus, then message me here again.`,
    );
    if (outbound.error) logger.error("whatsapp_webhook.outbound_failed", { phase: "plus_gate", error: outbound.error });
    return;
  }

  const content = text || (media.length > 0 ? `Shared ${media.length} WhatsApp attachment${media.length === 1 ? "" : "s"}.` : "");
  if (!content) return;

  const [{ data: plans }, { data: contexts }, { data: recentMessages }, { data: profile }] = await Promise.all([
    supabase
      .from("nura_plans")
      .select("id, title, current_focus, why_this_exists, next_step, category")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("nura_source_contexts")
      .select("plan_id, title, summary, kind, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("nura_messages")
      .select("role, content, plan_id, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(16),
    supabase
      .from("nura_profiles")
      .select("phone, preferred_checkin_channels")
      .eq("id", ownerId)
      .maybeSingle(),
  ]);

  const planTitleById = new Map((plans ?? []).map((p) => [p.id, p.title as string]));
  const history: HistoryTurn[] = (recentMessages ?? [])
    .slice()
    .reverse()
    .map((m) => {
      const title = m.plan_id ? planTitleById.get(m.plan_id as string) : null;
      return {
        role: m.role as "user" | "assistant",
        content: title ? `[${title}] ${m.content as string}` : (m.content as string),
      };
    });

  const existingPhone = (profile?.phone as string | null) ?? null;
  if (!existingPhone) {
    await supabase.from("nura_profiles").upsert({ id: ownerId, phone });
  }
  const phoneOnFile = existingPhone || phone;
  const allowedChannels = ((profile?.preferred_checkin_channels as string[] | null) ?? ["voice", "whatsapp", "in_app"]) as (
    | "voice"
    | "whatsapp"
    | "in_app"
  )[];

  const messageAttachments: MessageAttachment[] = media.map((item) => ({
    name: item.name,
    type: item.type,
    kind: item.kind as MessageAttachment["kind"],
  }));

  const timeZone = await resolveUserTimeZone(supabase, ownerId, {
    phoneDigits: phoneOnFile,
  });

  const decision = await resolveDecision(
    content,
    (plans ?? []) as PlanSummary[],
    messageAttachments,
    (contexts ?? []) as PlanContext[],
    null,
    history,
    phoneOnFile,
    [],
    [],
    "whatsapp",
    allowedChannels,
    timeZone,
  );

  const { planId, createdPlan, error: planError } = await applyPlanDecision(supabase, ownerId, decision, (plans ?? []) as PlanSummary[]);
  if (planError) {
    logger.error("whatsapp_webhook.plan_decision_failed", { message: planError });
  }

  const { error: conversationError } = await insertConversationTurn(
    supabase,
    ownerId,
    planId,
    content,
    decision.reply,
    media.map((item) => ({ name: item.name, kind: item.kind })),
  );
  if (conversationError) {
    logger.error("whatsapp_webhook.conversation_insert_failed", { message: conversationError });
  }

  if (planId) {
    if (media.length > 0) {
      await supabase.from("nura_source_contexts").insert(media.map((item) => ({
        owner_id: ownerId,
        plan_id: planId,
        kind: item.kind === "audio" ? "conversation" : "document_upload",
        title: item.name,
        summary: `${item.kind} shared through WhatsApp: ${item.summary}`,
        requires_user_confirmation: item.kind === "document",
      })));
    }

    if (decision.next_check_in) {
      await applyNextCheckIn(supabase, ownerId, planId, decision.next_check_in, timeZone);
    }

    const planForJourney = (plans ?? []).find((plan) => plan.id === planId);
    if (createdPlan) {
      after(() => ensureJourney(supabase, ownerId, createdPlan));
    } else if (planForJourney) {
      after(() => evaluateAndAdvanceJourney(supabase, ownerId, planForJourney as PlanForJourney, content, decision.reply));
    }

    await supabase
      .from("nura_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("owner_id", ownerId);
  }

  const outbound = await sendWhatsappText(phone, decision.reply);
  if (outbound.error) {
    logger.error("whatsapp_webhook.outbound_failed", { phase: "conversation", error: outbound.error });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      logger.warn("whatsapp_webhook.invalid_signature");
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }

    let body: unknown = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // leave body null
    }

    const inboundMessage = extractInboundMessage(body);
    if (inboundMessage === null) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const parsed = inboundSchema.safeParse(inboundMessage);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    // Ack Meta immediately. Slow Claude replies were causing timeouts and silent drops.
    after(() =>
      handleInboundMessage(parsed.data).catch((error) => {
        logger.error("whatsapp_webhook.background_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }),
    );

    return NextResponse.json({ ok: true, accepted: true });
  } catch (error) {
    logger.error("whatsapp_webhook.unhandled_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    // Still 200 when possible so Meta doesn't disable the webhook endpoint.
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Webhook failed." }, { status: 200 });
  }
}
