import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { resolveDecision, applyPlanDecision, insertConversationTurn, type PlanContext } from "@/lib/domain/message-intake";

const requestSchema = z.object({
  content: z.string().min(1),
  planId: z.string().uuid().optional().nullable(),
  attachments: z.array(z.object({
    name: z.string().min(1),
    type: z.string().default("application/octet-stream"),
    kind: z.enum(["image", "audio", "document", "file"]).default("file"),
    text: z.string().optional().default(""),
  })).optional().default([]),
});

type MessageAttachment = z.infer<typeof requestSchema>["attachments"][number];

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

function inferredCheckIn(content: string, planTitle: string | null) {
  const normalized = content.toLowerCase();
  const scheduledFor = new Date();
  let label = "tomorrow evening";
  let explicit = false;
  const requestedMinutes = relativeMinuteRequest(normalized);

  if (requestedMinutes && requestedMinutes > 0) {
    scheduledFor.setTime(Date.now() + requestedMinutes * 60_000);
    label = `in ${requestedMinutes} minute${requestedMinutes === 1 ? "" : "s"}`;
    explicit = true;
  } else if (/\btonight\b|\bthis evening\b/.test(normalized)) {
    scheduledFor.setHours(19, 30, 0, 0);
    if (scheduledFor.getTime() <= Date.now()) scheduledFor.setDate(scheduledFor.getDate() + 1);
    label = "this evening";
    explicit = true;
  } else if (/\btomorrow\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(19, 30, 0, 0);
    explicit = true;
  } else if (/\b(two|2)\s+weeks?\b|\bfortnight\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 14);
    scheduledFor.setHours(9, 0, 0, 0);
    label = "in two weeks";
    explicit = true;
  } else if (/\b(next week|one week|1 week)\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 7);
    scheduledFor.setHours(9, 0, 0, 0);
    label = "next week";
    explicit = true;
  } else if (/\b(few days|couple of days|every few days)\b/.test(normalized)) {
    scheduledFor.setDate(scheduledFor.getDate() + 3);
    scheduledFor.setHours(19, 30, 0, 0);
    label = "in a few days";
    explicit = true;
  } else {
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(19, 30, 0, 0);
  }

  const topic = planTitle ? `your ${planTitle} Thread` : "what you shared";
  return {
    scheduledFor,
    label,
    explicit,
    prompt: `Quick check-in on ${topic}: how have things been since you told Nura about this?`,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const [{ data, error }, { data: activePlan }] = await Promise.all([
    supabase
    .from("nura_messages")
    .select("id, plan_id, role, content, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("nura_plans")
      .select("id, title")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).sort((a, b) => {
    const byTime = new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
    if (byTime !== 0) return byTime;
    if (a.role === b.role) return 0;
    return a.role === "user" ? -1 : 1;
  });

  return NextResponse.json({ ok: true, messages, activePlan });
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

  const { content, attachments, planId: requestedPlanId } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const { data: plans, error: plansError } = await supabase
    .from("nura_plans")
    .select("id, title, current_focus")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (plansError) {
    return NextResponse.json({ ok: false, error: plansError.message }, { status: 500 });
  }

  const { data: contexts } = await supabase
    .from("nura_source_contexts")
    .select("plan_id, title, summary, kind, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const requestedPlan = requestedPlanId ? plans?.find((plan) => plan.id === requestedPlanId) ?? null : null;
  const decision = await resolveDecision(content, plans ?? [], attachments as MessageAttachment[], (contexts ?? []) as PlanContext[], requestedPlan);

  const { planId, planTitle, error: planError } = await applyPlanDecision(supabase, user.id, decision, plans ?? []);
  if (planError) {
    return NextResponse.json({ ok: false, error: planError }, { status: 500 });
  }

  const { error: conversationError } = await insertConversationTurn(supabase, user.id, planId, content, decision.reply);
  if (conversationError) {
    return NextResponse.json({ ok: false, error: conversationError }, { status: 500 });
  }

  if (planId) {
    if (attachments.length > 0) {
      await supabase.from("nura_source_contexts").insert(attachments.map((file) => ({
        owner_id: user.id,
        plan_id: planId,
        kind: file.kind === "image" ? "document_upload" : file.kind === "audio" ? "conversation" : "document_upload",
        title: file.name,
        summary: file.text
          ? `${file.kind} shared in conversation: ${file.text.slice(0, 500)}`
          : `${file.kind} shared in conversation (${file.type}).`,
        requires_user_confirmation: file.kind === "document",
      })));
    }

    const { data: openCheckIn } = await supabase
      .from("nura_check_ins")
      .select("id")
      .eq("owner_id", user.id)
      .eq("plan_id", planId)
      .is("completed_at", null)
      .limit(1)
      .maybeSingle();

    const checkIn = inferredCheckIn(content, planTitle);

    if (openCheckIn && checkIn.explicit) {
      await supabase
        .from("nura_check_ins")
        .update({
          prompt: checkIn.prompt,
          scheduled_for: checkIn.scheduledFor.toISOString(),
          triggered_at: null,
          call_status: null,
          call_error: null,
        })
        .eq("id", openCheckIn.id)
        .eq("owner_id", user.id);

      await supabase
        .from("nura_plans")
        .update({ next_step: `Nura will check in ${checkIn.label}.` })
        .eq("id", planId)
        .eq("owner_id", user.id);
    } else if (!openCheckIn) {
      await supabase.from("nura_check_ins").insert({
        owner_id: user.id,
        plan_id: planId,
        channel: "whatsapp",
        prompt: checkIn.prompt,
        scheduled_for: checkIn.scheduledFor.toISOString(),
      });

      await supabase
        .from("nura_plans")
        .update({ next_step: `Nura will check in ${checkIn.label}.` })
        .eq("id", planId)
        .eq("owner_id", user.id);
    }

    const { error: updateError } = await supabase
      .from("nura_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("owner_id", user.id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, reply: decision.reply, planId, planTitle });
}
