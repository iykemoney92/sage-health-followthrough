import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { processAttachments } from "@/lib/ai/attachments";
import { enforceThreadLimit } from "@/lib/billing/subscription";
import { primaryCheckinChannel } from "@/lib/domain/checkin-channel";
import { draftPlanFromIntake } from "@/lib/domain/draft-plan-from-intake";
import {
  draftFirstCheckInFromIntake,
  formatCheckInWhenForCopy,
} from "@/lib/domain/journey-create";
import { inferJourneyDraft, isPlanCategory } from "@/lib/domain/journey-naming";
import { ensureJourney } from "@/lib/domain/plan-journey";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const MAX_ATTACHMENT_BASE64_CHARS = 6_000_000;

const requestSchema = z.object({
  interests: z.array(z.string()).default([]),
  intake: z.string().default(""),
  checkinChannels: z.array(z.enum(["whatsapp", "in_app", "voice"])).optional(),
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
});

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 4500) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Start an additional Care plan from a guided intake (post-onboarding).
 * Reuses the same agent draft + check-in + roadmap path as onboarding.
 */
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

  const { intake, attachments, checkinChannels: requestedChannels } = parsed.data;
  if (!intake.trim() && attachments.length === 0) {
    return NextResponse.json({ ok: false, error: "intake_required" }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();

  const { count: existingCount } = await supabase
    .from("nura_plans")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .neq("status", "archived");

  const limitResponse = await enforceThreadLimit(supabase, user.id, existingCount ?? 0, true);
  if (limitResponse) return limitResponse;

  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("phone, preferred_checkin_channel, preferred_checkin_channels")
    .eq("id", user.id)
    .maybeSingle();

  const profileChannels = ((profile?.preferred_checkin_channels as string[] | null) ?? []).filter(
    (c): c is "whatsapp" | "in_app" | "voice" => c === "whatsapp" || c === "in_app" || c === "voice",
  );
  const allowedChannels: Array<"whatsapp" | "in_app" | "voice"> =
    requestedChannels && requestedChannels.length > 0
      ? requestedChannels
      : profileChannels.length > 0
        ? profileChannels
        : ["in_app"];

  const preferredRaw = (profile?.preferred_checkin_channel as string | null) ?? null;
  const preferredCheckInForDraft = primaryCheckinChannel(allowedChannels, preferredRaw);

  const normalizedPhone = profile?.phone ? String(profile.phone).replace(/[^\d]/g, "") : "";
  const needsPhone = allowedChannels.includes("whatsapp") || allowedChannels.includes("voice");
  if (needsPhone && normalizedPhone.length < 10) {
    return NextResponse.json(
      {
        ok: false,
        error: "phone_required",
        message: "Add a phone number in Me → Channels before scheduling WhatsApp or call check-ins.",
      },
      { status: 400 },
    );
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
        return NextResponse.json(
          { ok: false, error: retry.error?.message ?? "Could not create Care plan" },
          { status: 500 },
        );
      }
      createdPlan = retry.data;
    } else {
      return NextResponse.json(
        { ok: false, error: first.error?.message ?? "Could not create Care plan" },
        { status: 500 },
      );
    }
  }

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
            kind:
              file.kind === "image"
                ? "document_upload"
                : file.kind === "audio"
                  ? "conversation"
                  : "document_upload",
            title: file.name,
            summary: file.text
              ? `${file.kind} shared when starting a Care plan: ${file.text.slice(0, 500)}`
              : `${file.kind} shared when starting a Care plan (${file.type}).`,
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
      contact_phone:
        followUpChannel === "voice" || followUpChannel === "whatsapp" ? normalizedPhone || null : null,
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

  return NextResponse.json({
    ok: true,
    planId: createdPlan.id,
    plan: {
      title: plan.title,
      why_this_exists: plan.why_this_exists,
      current_focus: plan.current_focus,
      next_step: plan.next_step,
    },
    checkInWhen: firstCheckIn.when,
  });
}
