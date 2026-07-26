import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { resolveDecision, applyPlanDecision, applyNextCheckIn, insertConversationTurn, extractPhoneNumber, type PlanContext, type HistoryTurn, type MissedCheckIn } from "@/lib/domain/message-intake";

const MISSED_STATUSES = ["missed_stale", "missed_consolidated", "failed"];

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
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  const existingPhone = (profile?.phone as string | null) ?? null;
  const mentionedPhone = extractPhoneNumber(content);
  if (mentionedPhone && mentionedPhone !== existingPhone) {
    await supabase.from("nura_profiles").upsert({ id: user.id, phone: mentionedPhone });
  }
  const phoneOnFile = existingPhone || mentionedPhone || null;

  const { data: missedRows } = await supabase
    .from("nura_check_ins")
    .select("prompt, scheduled_for, call_status, plan_id")
    .eq("owner_id", user.id)
    .is("completed_at", null)
    .in("call_status", MISSED_STATUSES)
    .order("scheduled_for", { ascending: false })
    .limit(5);

  const missed: MissedCheckIn[] = (missedRows ?? []).map((row) => ({
    plan_title: planTitleById.get(row.plan_id as string) ?? "a Thread",
    prompt: row.prompt as string,
    scheduled_for: new Date(row.scheduled_for as string).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    reason: row.call_status === "failed" ? "the call failed" : "no answer / too much time passed",
  }));

  const requestedPlan = requestedPlanId ? plans?.find((plan) => plan.id === requestedPlanId) ?? null : null;
  const decision = await resolveDecision(content, plans ?? [], attachments as MessageAttachment[], (contexts ?? []) as PlanContext[], requestedPlan, history, phoneOnFile, missed);

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

    if (decision.next_check_in) {
      await applyNextCheckIn(supabase, user.id, planId, decision.next_check_in);
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
