import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { enforceThreadLimit } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { resolveDecision, applyPlanDecision, applyNextCheckIn, insertConversationTurn, extractPhoneNumber, type PlanContext, type HistoryTurn, type MissedCheckIn } from "@/lib/domain/message-intake";
import { processAttachments } from "@/lib/ai/attachments";
import { evaluateAndAdvanceJourney, ensureJourney } from "@/lib/domain/plan-journey";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MISSED_STATUSES = ["missed_stale", "missed_consolidated", "failed"];
const MAX_ATTACHMENT_BASE64_CHARS = 6_000_000; // ~4.5MB raw per file, base64-encoded

const requestSchema = z.object({
  content: z.string().min(1),
  planId: z.string().uuid().optional().nullable(),
  attachments: z.array(z.object({
    name: z.string().min(1),
    type: z.string().default("application/octet-stream"),
    kind: z.enum(["image", "audio", "document", "file"]).default("file"),
    text: z.string().optional().default(""),
    base64: z.string().max(MAX_ATTACHMENT_BASE64_CHARS).optional(),
  })).optional().default([]),
});

type MessageAttachment = z.infer<typeof requestSchema>["attachments"][number];

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const [{ data, error }, { data: activePlan }] = await Promise.all([
    supabase
    .from("nura_messages")
    .select("id, plan_id, role, content, created_at, attachments")
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
    // Pre-migration DBs may not have attachments yet — fall back so chat still loads.
    if (/attachments/i.test(error.message)) {
      const { data: legacy, error: legacyError } = await supabase
        .from("nura_messages")
        .select("id, plan_id, role, content, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (legacyError) {
        return NextResponse.json({ ok: false, error: legacyError.message }, { status: 500 });
      }
      const messages = (legacy ?? []).sort((a, b) => {
        const byTime = new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
        if (byTime !== 0) return byTime;
        if (a.role === b.role) return 0;
        return a.role === "user" ? -1 : 1;
      });
      return NextResponse.json({ ok: true, messages, activePlan });
    }
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

  const rateLimit = await checkRateLimit(supabase, user.id, "messages", 20, 300);
  if (rateLimit.limited) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const { data: plans, error: plansError } = await supabase
    .from("nura_plans")
    .select("id, title, current_focus, why_this_exists, next_step, category")
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

  const { data: recentMessages } = await supabase
    .from("nura_messages")
    .select("role, content, plan_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(16);

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

  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("phone, preferred_checkin_channels")
    .eq("id", user.id)
    .maybeSingle();

  const existingPhone = (profile?.phone as string | null) ?? null;
  const mentionedPhone = extractPhoneNumber(content);
  if (mentionedPhone && mentionedPhone !== existingPhone) {
    await supabase.from("nura_profiles").upsert({ id: user.id, phone: mentionedPhone });
  }
  const phoneOnFile = existingPhone || mentionedPhone || null;
  const allowedChannels = ((profile?.preferred_checkin_channels as string[] | null) ?? ["in_app"]) as ("voice" | "whatsapp" | "in_app")[];

  const { data: missedRows } = await supabase
    .from("nura_check_ins")
    .select("prompt, scheduled_for, call_status, plan_id")
    .eq("owner_id", user.id)
    .is("completed_at", null)
    .in("call_status", MISSED_STATUSES)
    .order("scheduled_for", { ascending: false })
    .limit(5);

  const missed: MissedCheckIn[] = (missedRows ?? []).map((row) => ({
    plan_title: planTitleById.get(row.plan_id as string) ?? "a Care plan",
    prompt: row.prompt as string,
    scheduled_for: new Date(row.scheduled_for as string).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    reason: row.call_status === "failed" ? "the call failed" : "no answer / too much time passed",
  }));

  const requestedPlan = requestedPlanId ? plans?.find((plan) => plan.id === requestedPlanId) ?? null : null;
  const { attachments: sanitizedAttachments, blocks: attachmentBlocks } = await processAttachments(attachments as MessageAttachment[]);
  const decision = await resolveDecision(content, plans ?? [], sanitizedAttachments, (contexts ?? []) as PlanContext[], requestedPlan, history, phoneOnFile, missed, attachmentBlocks, "in_app", allowedChannels);
  const threadLimit = await enforceThreadLimit(supabase, user.id, plans?.length ?? 0, decision.action === "new_plan");
  if (threadLimit) return threadLimit;

  const { planId, planTitle, createdPlan, error: planError } = await applyPlanDecision(supabase, user.id, decision, plans ?? []);
  if (planError) {
    return NextResponse.json({ ok: false, error: planError }, { status: 500 });
  }

  const { error: conversationError } = await insertConversationTurn(
    supabase,
    user.id,
    planId,
    content,
    decision.reply,
    sanitizedAttachments.map((file) => ({
      name: file.name,
      kind: file.kind === "image" || file.kind === "audio" || file.kind === "document" ? file.kind : "file",
    })),
  );
  if (conversationError) {
    return NextResponse.json({ ok: false, error: conversationError }, { status: 500 });
  }

  if (planId) {
    if (sanitizedAttachments.length > 0) {
      await supabase.from("nura_source_contexts").insert(sanitizedAttachments.map((file) => ({
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

    if (decision.next_check_in) {
      await applyNextCheckIn(supabase, user.id, planId, decision.next_check_in);
    }

    const planForJourney = plans?.find((plan) => plan.id === planId);
    if (createdPlan) {
      // Draft the roadmap as soon as a Journey is born — don't wait for the plan page.
      after(() => ensureJourney(supabase, user.id, createdPlan));
    } else if (planForJourney) {
      // Runs after the response is sent - journey bookkeeping should never delay the visible chat reply.
      after(() => evaluateAndAdvanceJourney(supabase, user.id, planForJourney as never, content, decision.reply));
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
