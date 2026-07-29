import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { extractWhatsappLinkCode } from "@/lib/whatsapp-link";
import { logger } from "@/lib/logger";

// Meta signs every webhook delivery with x-hub-signature-256 (sha256 HMAC over the raw
// body, keyed with the app secret). Verified only when the secret is configured, so local/
// demo testing without it keeps working exactly as before - but once WHATSAPP_APP_SECRET is
// set (required for real Meta traffic), anything unsigned or mismatched is rejected outright.
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
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
  from: z.string().min(5),
  text: z.string().default(""),
  media: z.array(z.object({
    kind: z.enum(["image", "audio", "document", "file"]).default("file"),
    name: z.string().default("WhatsApp attachment"),
    type: z.string().default("application/octet-stream"),
    summary: z.string().default("Shared through WhatsApp."),
  })).optional().default([]),
});

async function sendWhatsappText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return { skipped: true };

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body,
      },
    }),
  });

  if (!response.ok) {
    return { skipped: false, error: await response.text().catch(() => "Could not send WhatsApp reply.") };
  }

  return { skipped: false };
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
  return `Hi ${firstName}, you're verified to be contacted here. How can I help you today? You can send a message, voice note, image, or file.`;
}

function alreadyLinkedReply(firstName: string) {
  return `Hi ${firstName}, you're already verified here. How can I help you today?`;
}

function threadReply(firstName: string, threadTitle: string | null, checkInLabel: string | null) {
  const threadCopy = threadTitle ? `I’ve added this to your ${threadTitle} Thread` : "I’ve saved this as context";
  const greeting = firstName === "there" ? "Thanks for sharing." : `Thanks, ${firstName}.`;
  const followUp = checkInLabel
    ? `I’ll check in ${checkInLabel}.`
    : "I’ll use it to keep track of what matters and check in when it’s useful.";
  return `${greeting} ${threadCopy} so it’s not lost between appointments.\n\n${followUp}`;
}

function relativeMinuteRequest(normalized: string) {
  const numberMatch = normalized.match(/\b(?:in\s*)?(\d{1,2})\s*(?:minutes?|mins?|min)\b/);
  if (numberMatch) return Number(numberMatch[1]);

  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const wordMatch = normalized.match(/\b(?:in\s*)?(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:minutes?|mins?|min)\b/);
  return wordMatch ? words[wordMatch[1]] : null;
}

function inferredCheckIn(text: string, planTitle: string) {
  const normalized = text.toLowerCase();
  const scheduledFor = new Date();
  let label = "tomorrow evening";
  let explicit = false;
  const requestedMinutes = relativeMinuteRequest(normalized);

  if (requestedMinutes && requestedMinutes > 0) {
    scheduledFor.setTime(Date.now() + requestedMinutes * 60_000);
    label = `in ${requestedMinutes} minute${requestedMinutes === 1 ? "" : "s"}`;
    explicit = true;
  } else if (/\b(two|2)\s+weeks?\b|\bfortnight\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 14);
    scheduledFor.setHours(9, 0, 0, 0);
    label = "in two weeks";
    explicit = true;
  } else if (/\b(few days|couple of days|every few days)\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 3);
    scheduledFor.setHours(19, 30, 0, 0);
    label = "in a few days";
    explicit = true;
  } else if (/\btomorrow\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(19, 30, 0, 0);
    explicit = true;
  } else {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(19, 30, 0, 0);
  }

  return {
    scheduledFor,
    label,
    explicit,
    prompt: `WhatsApp check-in on your ${planTitle} Thread: how have things been since you shared this?`,
  };
}

async function resolveWhatsappThread(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  ownerId: string,
  text: string,
) {
  const normalized = text.toLowerCase();
  const { data: plans } = await supabase
    .from("nura_plans")
    .select("id, title")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(10);

  const findPlan = (patterns: RegExp[]) => plans?.find((plan) => patterns.some((pattern) => pattern.test((plan.title as string).toLowerCase())));
  const medicationLike = /\b(amlodipine|medication|medicine|dose|side effect|dizziness|blood pressure|bp check|bp)\b/.test(normalized);
  const headacheLike = /\b(headache|migraine)\b/.test(normalized);

  const existing = medicationLike
    ? findPlan([/medication/, /blood pressure/, /bp/, /amlodipine/])
    : headacheLike
      ? findPlan([/headache/, /migraine/])
      : plans?.[0];

  if (existing) return { id: existing.id as string, title: existing.title as string };

  const title = medicationLike ? "Medication Follow-Up" : headacheLike ? "Headache Follow-Through" : "WhatsApp Follow-Up";
  const { data: plan } = await supabase
    .from("nura_plans")
    .insert({
      owner_id: ownerId,
      title,
      category: medicationLike ? "medication_follow_through" : "general_health",
      status: "active",
      why_this_exists: "Created from a WhatsApp conversation with Nura.",
      current_focus: text.slice(0, 180),
      next_step: "Nura will check in when it is useful.",
    })
    .select("id, title")
    .single();

  return plan ? { id: plan.id as string, title: plan.title as string } : null;
}

async function storeWhatsappContext(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  ownerId: string,
  text: string,
  media: z.infer<typeof inboundSchema>["media"],
) {
  const access = await getSubscriptionAccess(supabase, ownerId);
  if (!access.hasPlus) {
    return { thread: null, checkInLabel: null, gated: true };
  }

  const thread = await resolveWhatsappThread(supabase, ownerId, text);

  await supabase.from("nura_messages").insert({
    owner_id: ownerId,
    plan_id: thread?.id ?? null,
    role: "user",
    content: text || `Shared ${media.length} WhatsApp attachment${media.length === 1 ? "" : "s"}.`,
  });

  if (thread && media.length > 0) {
    await supabase.from("nura_source_contexts").insert(media.map((item) => ({
      owner_id: ownerId,
      plan_id: thread.id,
      kind: item.kind === "audio" ? "conversation" : "document_upload",
      title: item.name,
      summary: `${item.kind} shared through WhatsApp: ${item.summary}`,
      requires_user_confirmation: item.kind === "document",
    })));
  }

  let checkInLabel: string | null = null;

  if (thread) {
    const { data: openCheckIn } = await supabase
      .from("nura_check_ins")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("plan_id", thread.id)
      .is("completed_at", null)
      .limit(1)
      .maybeSingle();

    const checkIn = inferredCheckIn(text, thread.title);
    checkInLabel = checkIn.label;

    if (openCheckIn && checkIn.explicit) {
      await supabase
        .from("nura_check_ins")
        .update({
          prompt: checkIn.prompt,
          scheduled_for: checkIn.scheduledFor.toISOString(),
        })
        .eq("id", openCheckIn.id)
        .eq("owner_id", ownerId);
    } else if (!openCheckIn) {
      await supabase.from("nura_check_ins").insert({
        owner_id: ownerId,
        plan_id: thread.id,
        channel: "whatsapp",
        prompt: checkIn.prompt,
        scheduled_for: checkIn.scheduledFor.toISOString(),
      });
    }

    await supabase
      .from("nura_plans")
      .update({
        next_step: `Nura will check in ${checkIn.label}.`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id)
      .eq("owner_id", ownerId);
  }

  return { thread, checkInLabel, gated: false };
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
      // leave body null - safeParse below will reject it
    }
    const parsed = inboundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const { from, text, media } = parsed.data;
    const phone = from.replace(/[^\d]/g, "");
    const code = extractWhatsappLinkCode(text);
    const supabase = getSupabaseServerClient();

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
        return NextResponse.json({ ok: false, error: pendingError.message }, { status: 500 });
      }

      if (pendingLink) {
        await supabase
          .from("nura_channel_links")
          .update({ status: "inactive" })
          .eq("provider", "whatsapp")
          .eq("channel_identifier", phone)
          .eq("status", "active");

        await supabase
          .from("nura_channel_links")
          .update({ status: "expired" })
          .eq("owner_id", pendingLink.owner_id)
          .eq("provider", "whatsapp")
          .eq("status", "pending")
          .neq("id", pendingLink.id);

        const { data: channelLink, error } = await supabase
          .from("nura_channel_links")
          .update({
            channel_identifier: phone,
            status: "active",
            linked_at: now,
          })
          .eq("id", pendingLink.id)
          .select("owner_id")
          .maybeSingle();

        if (error || !channelLink) {
          return NextResponse.json({ ok: false, error: error?.message ?? "Link code not found or expired." }, { status: 404 });
        }

        const firstName = await getFirstName(supabase, channelLink.owner_id as string);
        const reply = linkedReply(firstName);
        const outbound = await sendWhatsappText(phone, reply);

        return NextResponse.json({ ok: true, linked: true, ownerId: channelLink.owner_id, reply, outbound });
      }

      const { data: activeLink } = await supabase
        .from("nura_channel_links")
        .select("owner_id")
        .eq("provider", "whatsapp")
        .eq("channel_identifier", phone)
        .eq("status", "active")
        .maybeSingle();

      if (activeLink) {
        const firstName = await getFirstName(supabase, activeLink.owner_id as string);
        const reply = alreadyLinkedReply(firstName);
        const outbound = await sendWhatsappText(phone, reply);

        return NextResponse.json({ ok: true, linked: true, alreadyLinked: true, ownerId: activeLink.owner_id, reply, outbound });
      }

      return NextResponse.json({ ok: false, error: "Link code not found or expired." }, { status: 404 });
    }

    if (/\blink\s*code\s*:/i.test(text)) {
      const reply = "I couldn’t verify that link code. Please open WhatsApp again from Nura so I can generate a fresh code for this account.";
      const outbound = await sendWhatsappText(phone, reply);

      return NextResponse.json({ ok: false, error: "Invalid or expired link code.", reply, outbound }, { status: 404 });
    }

    const { data: channelLink, error: linkError } = await supabase
      .from("nura_channel_links")
      .select("owner_id")
      .eq("provider", "whatsapp")
      .eq("channel_identifier", phone)
      .eq("status", "active")
      .maybeSingle();

    if (linkError || !channelLink) {
      return NextResponse.json({ ok: false, error: linkError?.message ?? "WhatsApp number is not linked to a Nura account." }, { status: 404 });
    }

    const { thread, checkInLabel, gated } = await storeWhatsappContext(supabase, channelLink.owner_id as string, text, media);
    const firstName = await getFirstName(supabase, channelLink.owner_id as string);
    if (gated) {
      const reply = `Hi ${firstName}, WhatsApp follow-up is part of Nura Plus. Please open Nura to start or renew Plus, then message me here again.`;
      const outbound = await sendWhatsappText(phone, reply);
      return NextResponse.json({ ok: true, gated: true, error: "plus_required", ownerId: channelLink.owner_id, reply, outbound });
    }

    const reply = threadReply(firstName, thread?.title ?? null, checkInLabel);
    const outbound = await sendWhatsappText(phone, reply);

    return NextResponse.json({ ok: true, linked: false, ownerId: channelLink.owner_id, planId: thread?.id ?? null, planTitle: thread?.title ?? null, reply, outbound });
  } catch (error) {
    logger.error("whatsapp_webhook.unhandled_error", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Webhook failed." }, { status: 500 });
  }
}
