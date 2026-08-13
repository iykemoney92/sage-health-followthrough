import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceThreadLimit, requirePlusAccess } from "@/lib/billing/subscription";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { resolveDecision, applyPlanDecision, applyNextCheckIn, insertConversationTurn, type PlanContext, type HistoryTurn } from "@/lib/domain/message-intake";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";

const requestSchema = z.object({
  content: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rawCallerPhone = request.headers.get("x-caller-phone");
  const phone = rawCallerPhone ? rawCallerPhone.replace(/[^\d]/g, "") : null;
  if (!phone) {
    return NextResponse.json({ ok: false, error: "missing caller phone" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const { data: link, error: linkError } = await supabase
    .from("nura_channel_links")
    .select("owner_id")
    .eq("provider", "whatsapp")
    .eq("channel_identifier", phone)
    .eq("status", "active")
    .maybeSingle();

  if (linkError) {
    return NextResponse.json({ ok: false, error: linkError.message }, { status: 500 });
  }

  if (!link) {
    return NextResponse.json({
      ok: false,
      error: "not_linked",
      message: "This WhatsApp number isn't linked to a Nura account yet. Ask the user to open the Nura app and tap Connect WhatsApp, then send the link code here.",
    }, { status: 404 });
  }

  const ownerId = link.owner_id as string;
  const { content } = parsed.data;
  const paywall = await requirePlusAccess(supabase, ownerId, "voice");
  if (paywall) return paywall;

  const { data: plans, error: plansError } = await supabase
    .from("nura_plans")
    .select("id, title, current_focus")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (plansError) {
    return NextResponse.json({ ok: false, error: plansError.message }, { status: 500 });
  }

  const { data: contexts } = await supabase
    .from("nura_source_contexts")
    .select("plan_id, title, summary, kind, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: recentMessages } = await supabase
    .from("nura_messages")
    .select("role, content, plan_id, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(16);

  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("preferred_checkin_channels, preferred_checkin_channel")
    .eq("id", ownerId)
    .maybeSingle();
  const allowedChannels = ((profile?.preferred_checkin_channels as string[] | null) ?? ["voice", "whatsapp", "in_app"]) as (
    | "voice"
    | "whatsapp"
    | "in_app"
  )[];
  const preferredChannel = (profile?.preferred_checkin_channel as string | null) ?? null;

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

  // WhatsApp always carries a caller phone, so a voice check-in is always reachable here.
  const timeZone = await resolveUserTimeZone(supabase, ownerId, { phoneDigits: phone });
  const decision = await resolveDecision(content, plans ?? [], [], (contexts ?? []) as PlanContext[], null, history, phone, [], [], "whatsapp", allowedChannels, timeZone, preferredChannel);
  const threadLimit = await enforceThreadLimit(supabase, ownerId, plans?.length ?? 0, decision.action === "new_plan");
  if (threadLimit) return threadLimit;

  const { planId, planTitle, error: planError } = await applyPlanDecision(supabase, ownerId, decision, plans ?? []);
  if (planError) {
    return NextResponse.json({ ok: false, error: planError }, { status: 500 });
  }

  const { error: conversationError } = await insertConversationTurn(supabase, ownerId, planId, content, decision.reply);
  if (conversationError) {
    return NextResponse.json({ ok: false, error: conversationError }, { status: 500 });
  }

  if (planId) {
    if (decision.next_check_in) {
      await applyNextCheckIn(supabase, ownerId, planId, decision.next_check_in, timeZone);
    }

    await supabase
      .from("nura_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("owner_id", ownerId);
  }

  return NextResponse.json({
    ok: true,
    reply: decision.reply,
    planId,
    planTitle,
    message: `Relay this to the user in your own warm, concise words: ${decision.reply}`,
  });
}
