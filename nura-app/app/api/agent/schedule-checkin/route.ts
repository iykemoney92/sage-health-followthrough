import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractAgentPhoneHeaders, resolveAgentOwnerId } from "@/lib/agent/resolve-owner";
import { enforceThreadLimit, requirePlusAccess } from "@/lib/billing/subscription";
import { rerouteChannel, type CheckinChannel } from "@/lib/domain/checkin-channel";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { wallTimeInTimeZoneToUtcIso } from "@/lib/timezone";

const requestSchema = z
  .object({
    // Explicit ids (preferred). ElevenLabs dynamic vars often arrive as user_id / plan_id.
    ownerId: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    plan_id: z.string().uuid().optional(),
    planTitle: z.string().min(1).optional(),
    channel: z.enum(["whatsapp", "in_app", "voice"]).default("voice"),
    prompt: z.string().min(1),
    scheduledFor: z.string().datetime(),
  })
  .refine((value) => value.planId || value.plan_id || value.planTitle, {
    message: "Provide planId or planTitle.",
  });

const DEMO_OWNER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    ownerId: bodyOwnerId,
    user_id: bodyUserId,
    planId: bodyPlanId,
    plan_id: bodyPlanIdSnake,
    planTitle,
    channel,
    prompt,
    scheduledFor,
  } = parsed.data;
  const requestedPlanId = bodyPlanId ?? bodyPlanIdSnake;
  const { callerPhoneDigits, calledPhoneDigits } = extractAgentPhoneHeaders(request);

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" },
      { status: 503 },
    );
  }

  const resolved = await resolveAgentOwnerId(supabase, {
    ownerId: bodyOwnerId ?? bodyUserId ?? null,
    callerPhoneDigits,
    calledPhoneDigits,
    planTitle: planTitle ?? null,
  });

  let effectiveOwnerId = resolved.ownerId;
  const contactPhone = resolved.matchedPhone || calledPhoneDigits || null;

  // If the tool only sent planId, trust the plan's owner.
  if (!effectiveOwnerId && requestedPlanId) {
    const { data: byId } = await supabase
      .from("nura_plans")
      .select("id, title, owner_id")
      .eq("id", requestedPlanId)
      .maybeSingle();
    if (byId?.owner_id) {
      effectiveOwnerId = byId.owner_id as string;
    }
  }

  if (!effectiveOwnerId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not identify the caller - no matching account for this phone number.",
        message:
          "I couldn’t save that check-in because I couldn’t match this call to a Nura account. Ask them to confirm the follow-up inside the app.",
        debug: {
          callerPhoneDigits,
          calledPhoneDigits,
          via: resolved.via,
        },
      },
      { status: 404 },
    );
  }

  const planQuery = supabase.from("nura_plans").select("id, title, owner_id");
  const { data: plan, error: planError } = requestedPlanId
    ? await planQuery.eq("id", requestedPlanId).maybeSingle()
    : await planQuery.eq("owner_id", effectiveOwnerId).ilike("title", planTitle!).maybeSingle();

  if (planError) {
    return NextResponse.json({ ok: false, error: planError.message }, { status: 500 });
  }

  if (requestedPlanId && !plan) {
    return NextResponse.json({ ok: false, error: "Care plan not found" }, { status: 404 });
  }

  let planId = plan?.id as string | undefined;
  let resolvedTitle = plan?.title ?? planTitle!;
  const resolvedOwnerId = (plan?.owner_id as string | undefined) ?? effectiveOwnerId;
  if (!resolvedOwnerId) {
    return NextResponse.json({ ok: false, error: "Could not identify the caller for this Care plan." }, { status: 404 });
  }
  const paywall = await requirePlusAccess(supabase, resolvedOwnerId, channel === "voice" ? "voice" : "whatsapp");
  if (paywall) return paywall;

  const timeZone = await resolveUserTimeZone(supabase, resolvedOwnerId, {
    phoneDigits: contactPhone,
  });
  const scheduledForUtc = wallTimeInTimeZoneToUtcIso(scheduledFor, timeZone);

  if (!planId) {
    const { count } = await supabase
      .from("nura_plans")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", resolvedOwnerId);
    const threadLimit = await enforceThreadLimit(supabase, resolvedOwnerId, count ?? 0, true);
    if (threadLimit) return threadLimit;

    const { data: created, error: createError } = await supabase
      .from("nura_plans")
      .insert({
        owner_id: resolvedOwnerId,
        title: planTitle!,
        status: "active",
        why_this_exists: "Created from a proactive call by Nura.",
        current_focus: prompt,
        next_step: "Follow up at the scheduled check-in.",
      })
      .select("id, title")
      .single();

    if (createError || !created) {
      return NextResponse.json({ ok: false, error: createError?.message ?? "Could not create plan" }, { status: 500 });
    }
    planId = created.id;
    resolvedTitle = created.title;
  }

  // Honour the user's current channel preferences at write time rather than trusting whatever
  // the calling agent asked for - trigger-check-ins reroutes again at dispatch in case
  // preferences change later, but the stored channel should reflect reality from the start.
  const { data: ownerProfile } = await supabase
    .from("nura_profiles")
    .select("preferred_checkin_channels")
    .eq("id", resolvedOwnerId)
    .maybeSingle();
  const allowedChannels = (ownerProfile?.preferred_checkin_channels as CheckinChannel[] | null) ?? [
    "voice",
    "whatsapp",
    "in_app",
  ];
  const effectiveChannel = rerouteChannel(channel, allowedChannels);

  const { data: checkIn, error: checkInError } = await supabase
    .from("nura_check_ins")
    .insert({
      owner_id: resolvedOwnerId,
      plan_id: planId,
      channel: effectiveChannel,
      prompt,
      scheduled_for: scheduledForUtc,
      contact_phone: contactPhone,
    })
    .select("id, plan_id, channel, prompt, scheduled_for, created_at, contact_phone")
    .single();

  if (checkInError || !checkIn) {
    return NextResponse.json({ ok: false, error: checkInError?.message ?? "Could not schedule check-in" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Check-in scheduled for the ${resolvedTitle} Care plan on ${scheduledForUtc} via ${effectiveChannel}.`,
    checkIn: { ...checkIn, planTitle: resolvedTitle },
    resolvedVia: resolved.via ?? "planId",
    timeZone,
  });
}

export async function GET() {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("nura_check_ins")
    .select("id, channel, prompt, scheduled_for, created_at, nura_plans(title)")
    .eq("owner_id", DEMO_OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checkIns: data });
}
