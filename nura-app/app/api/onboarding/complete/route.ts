import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { processAttachments } from "@/lib/ai/attachments";
import { draftPlanFromIntake } from "@/lib/domain/draft-plan-from-intake";
import { isPlanCategory, inferJourneyDraft } from "@/lib/domain/journey-naming";
import {
  draftFirstCheckInFromIntake,
  formatCheckInWhenForCopy,
} from "@/lib/domain/journey-create";
import { ensureJourney } from "@/lib/domain/plan-journey";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { isValidTimeZone } from "@/lib/timezone";
// Trial starts on the post-onboarding paywall (card 14-day or soft 7-day), not here.

const MAX_ATTACHMENT_BASE64_CHARS = 6_000_000;

const requestSchema = z.object({
  interests: z.array(z.string()).default([]),
  channel: z.string().default("WhatsApp"),
  checkinChannel: z.string().optional(),
  checkinChannels: z.array(z.string()).optional(),
  phone: z.string().trim().optional().default(""),
  intake: z.string().default(""),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().default("application/octet-stream"),
        kind: z.enum(["image", "audio", "document", "file"]).default("file"),
        text: z.string().optional().default(""),
        base64: z.string().max(MAX_ATTACHMENT_BASE64_CHARS).optional(),
      }),
    )
    .optional()
    .default([]),
  /** Skip intake only (channels still required). */
  skip: z.boolean().optional().default(false),
  /** Skip the whole setup — defaults to in-app channels and empty intake. */
  skipSetup: z.boolean().optional().default(false),
  /** Browser IANA timezone so check-ins land on the user's wall clock. */
  timezone: z.string().min(1).max(64).optional(),
});

const CHAT_CHANNEL_MAP: Record<string, string> = {
  WhatsApp: "whatsapp",
  "In the app": "in_app",
  Both: "both",
};

const CHECKIN_CHANNEL_MAP: Record<string, string> = {
  WhatsApp: "whatsapp",
  "In the app": "in_app",
  "Phone call": "voice",
};

function resolveCheckinChannels(labels: string[] | undefined, legacy?: string) {
  const fromLabels = (labels ?? [])
    .map((label) => CHECKIN_CHANNEL_MAP[label])
    .filter((value): value is string => Boolean(value));
  if (fromLabels.length > 0) return [...new Set(fromLabels)];
  if (legacy && CHECKIN_CHANNEL_MAP[legacy]) return [CHECKIN_CHANNEL_MAP[legacy]];
  return ["in_app"];
}

function primaryCheckin(channels: string[]) {
  if (channels.includes("voice")) return "voice";
  if (channels.includes("whatsapp")) return "whatsapp";
  return "in_app";
}

function orderChannels(channels: string[]) {
  const primary = primaryCheckin(channels);
  return [primary, ...channels.filter((c) => c !== primary)];
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 4500) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { interests, channel, checkinChannel, checkinChannels, phone, intake, attachments, skip, skipSetup, timezone } =
    parsed.data;
  const skipIntake = skip || skipSetup;
  if (!skipIntake && !intake.trim() && attachments.length === 0) {
    return NextResponse.json({ ok: false, error: "intake_required" }, { status: 400 });
  }

  // Full setup skip lands on in-app defaults so the paywall can open immediately.
  const effectiveChannel = skipSetup ? "In the app" : channel;
  const effectiveCheckinChannels = skipSetup ? ["In the app"] : checkinChannels;
  const effectiveInterests = skipSetup ? [] : interests;

  const preferredCheckinChannels = orderChannels(
    resolveCheckinChannels(effectiveCheckinChannels, checkinChannel),
  );
  if (preferredCheckinChannels.length === 0) {
    return NextResponse.json({ ok: false, error: "channels_required" }, { status: 400 });
  }

  const chatNeedsPhone = effectiveChannel === "WhatsApp" || effectiveChannel === "Both";
  const checkinNeedsPhone = preferredCheckinChannels.includes("whatsapp") || preferredCheckinChannels.includes("voice");
  const normalizedPhone = skipSetup ? "" : phone ? phone.replace(/[^\d]/g, "") : "";
  if ((chatNeedsPhone || checkinNeedsPhone) && normalizedPhone.length < 10) {
    return NextResponse.json({ ok: false, error: "phone_required" }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();

  const displayName = (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "";
  const preferredChannel = CHAT_CHANNEL_MAP[effectiveChannel] ?? "in_app";
  const preferredCheckinChannel = primaryCheckin(preferredCheckinChannels);
  const resolvedTimezone = isValidTimeZone(timezone) ? timezone.trim() : null;

  const profilePayload: Record<string, unknown> = {
    id: user.id,
    display_name: displayName,
    preferred_channel: preferredChannel,
    preferred_checkin_channel: preferredCheckinChannel,
    preferred_checkin_channels: preferredCheckinChannels,
    interests: effectiveInterests,
    phone: normalizedPhone || null,
  };
  if (resolvedTimezone) profilePayload.timezone = resolvedTimezone;

  let { error: profileError } = await supabase.from("nura_profiles").upsert(profilePayload);

  // Older local DBs may not have newer channel columns yet — still save the rest.
  if (profileError?.message?.includes("preferred_checkin_channels")) {
    const { preferred_checkin_channels: _ignored, ...withoutArray } = profilePayload;
    ({ error: profileError } = await supabase.from("nura_profiles").upsert(withoutArray));
  }
  if (profileError?.message?.includes("preferred_checkin_channel")) {
    const {
      preferred_checkin_channel: _ignoredChannel,
      preferred_checkin_channels: _ignoredChannels,
      ...legacyPayload
    } = profilePayload;
    ({ error: profileError } = await supabase.from("nura_profiles").upsert(legacyPayload));
  }
  if (profileError?.message?.includes("timezone")) {
    const { timezone: _ignoredTz, ...withoutTz } = profilePayload;
    ({ error: profileError } = await supabase.from("nura_profiles").upsert(withoutTz));
  }

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  if (skipIntake) {
    await supabase.auth.updateUser({
      data: {
        onboarding_complete: true,
        ...(resolvedTimezone ? { timezone: resolvedTimezone } : {}),
      },
    });
    return NextResponse.json({ ok: true, skipped: true, skipSetup: Boolean(skipSetup) });
  }

  const { data: existingPlan, error: existingPlanError } = await supabase
    .from("nura_plans")
    .select("id, title, why_this_exists, current_focus, next_step")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingPlanError) {
    return NextResponse.json({ ok: false, error: existingPlanError.message }, { status: 500 });
  }

  if (existingPlan) {
    await supabase.auth.updateUser({
      data: {
        onboarding_complete: true,
        ...(resolvedTimezone ? { timezone: resolvedTimezone } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      plan: {
        title: existingPlan.title,
        why_this_exists: existingPlan.why_this_exists,
        current_focus: existingPlan.current_focus,
        next_step: existingPlan.next_step,
      },
      existing: true,
    });
  }

  const { attachments: sanitizedAttachments } = await processAttachments(attachments);
  const attachmentNotes = sanitizedAttachments.map((file) => {
    const excerpt = file.text?.trim();
    return excerpt ? `${file.name}: ${excerpt.slice(0, 500)}` : file.name;
  });
  const plan = await withTimeout(
    draftPlanFromIntake(intake, attachmentNotes),
    inferJourneyDraft(intake, attachmentNotes),
  );

  let createdPlan: { id: string } | null = null;
  {
    const first = await supabase
      .from("nura_plans")
      .insert({
        owner_id: user.id,
        title: plan.title,
        category: plan.category,
        status: "active",
        why_this_exists: plan.why_this_exists,
        current_focus: plan.current_focus,
        next_step: plan.next_step,
      })
      .select("id")
      .single();

    if (first.data) {
      createdPlan = first.data;
    } else if (first.error && /category/i.test(first.error.message)) {
      const retry = await supabase
        .from("nura_plans")
        .insert({
          owner_id: user.id,
          title: plan.title,
          status: "active",
          why_this_exists: plan.why_this_exists,
          current_focus: plan.current_focus,
          next_step: plan.next_step,
        })
        .select("id")
        .single();
      if (retry.error || !retry.data) {
        return NextResponse.json({ ok: false, error: retry.error?.message ?? "Could not create Care plan" }, { status: 500 });
      }
      createdPlan = retry.data;
    } else {
      return NextResponse.json({ ok: false, error: first.error?.message ?? "Could not create Care plan" }, { status: 500 });
    }
  }

  const checkInChannels = preferredCheckinChannels.filter(
    (c): c is "whatsapp" | "in_app" | "voice" => c === "whatsapp" || c === "in_app" || c === "voice",
  );
  const allowedChannels: Array<"whatsapp" | "in_app" | "voice"> =
    checkInChannels.length > 0 ? checkInChannels : ["whatsapp"];
  const preferredCheckInForDraft: "whatsapp" | "in_app" | "voice" =
    preferredCheckinChannel === "voice" ||
    preferredCheckinChannel === "in_app" ||
    preferredCheckinChannel === "whatsapp"
      ? preferredCheckinChannel
      : "whatsapp";

  const firstCheckIn = await withTimeout(
    draftFirstCheckInFromIntake({
      plan: {
        title: plan.title,
        category: isPlanCategory(plan.category) ? plan.category : "general_health",
        whyThisExists: plan.why_this_exists,
        currentFocus: plan.current_focus,
        nextStep: plan.next_step,
      },
      intake: `${intake.trim()}\n${attachmentNotes.join("\n")}`.trim(),
      allowedChannels,
      preferredChannel: preferredCheckInForDraft,
    }),
    // Soft fallback only — not a product rule of "tomorrow 19:30".
    {
      when: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        d.setHours(18, 20, 0, 0);
        return d.toISOString();
      })(),
      prompt: `How are things going with ${plan.title} — anything Nura should update?`,
      channel: preferredCheckInForDraft,
    },
    5000,
  );

  const followUpChannel = firstCheckIn.channel;
  const whenLabel = formatCheckInWhenForCopy(firstCheckIn.when);
  const assistantCopy =
    `I’ve built a Care plan from what you shared — tailored to you, not a template — and scheduled a check-in for ${whenLabel}. ` +
    `We can change the timing anytime.`;

  const userMessage = (intake.trim() || "I shared some notes/documents for Nura to organise.").trim();
  const messageAttachments = sanitizedAttachments.map((file) => ({
    name: file.name,
    kind: file.kind === "image" || file.kind === "audio" || file.kind === "document" ? file.kind : "file",
  }));

  const userRow = {
    owner_id: user.id,
    plan_id: createdPlan.id,
    role: "user" as const,
    content: userMessage,
    attachments: messageAttachments,
  };
  const assistantRow = {
    owner_id: user.id,
    plan_id: createdPlan.id,
    role: "assistant" as const,
    content: assistantCopy,
    attachments: [] as typeof messageAttachments,
  };

  let messageInsert = await supabase.from("nura_messages").insert([userRow, assistantRow]);
  if (messageInsert.error && /attachments/i.test(messageInsert.error.message)) {
    messageInsert = await supabase.from("nura_messages").insert([
      { owner_id: user.id, plan_id: createdPlan.id, role: "user", content: userMessage },
      {
        owner_id: user.id,
        plan_id: createdPlan.id,
        role: "assistant",
        content: assistantCopy,
      },
    ]);
  }

  await Promise.all([
    Promise.resolve(messageInsert),
    sanitizedAttachments.length > 0
      ? supabase.from("nura_source_contexts").insert(
          sanitizedAttachments.map((file) => ({
            owner_id: user.id,
            plan_id: createdPlan.id,
            kind: file.kind === "image" ? "document_upload" : file.kind === "audio" ? "conversation" : "document_upload",
            title: file.name,
            summary: file.text
              ? `${file.kind} shared during setup: ${file.text.slice(0, 500)}`
              : `${file.kind} shared during setup (${file.type}).`,
            requires_user_confirmation: file.kind === "document",
          })),
        )
      : Promise.resolve({ error: null }),
    supabase.from("nura_check_ins").insert({
      owner_id: user.id,
      plan_id: createdPlan.id,
      channel: followUpChannel,
      prompt: firstCheckIn.prompt,
      scheduled_for: firstCheckIn.when,
      contact_phone: followUpChannel === "voice" || followUpChannel === "whatsapp" ? normalizedPhone || null : null,
    }),
  ]);

  after(() =>
    ensureJourney(supabase, user.id, {
      id: createdPlan.id,
      title: plan.title,
      why_this_exists: plan.why_this_exists,
      current_focus: plan.current_focus,
      next_step: plan.next_step,
    }),
  );

  await supabase.auth.updateUser({
    data: {
      onboarding_complete: true,
      ...(resolvedTimezone ? { timezone: resolvedTimezone } : {}),
    },
  });

  return NextResponse.json({ ok: true, plan });
}
