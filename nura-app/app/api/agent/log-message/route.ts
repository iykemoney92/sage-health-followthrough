import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { resolveDecision, applyPlanDecision, insertConversationTurn, type PlanContext } from "@/lib/domain/message-intake";

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

  const decision = await resolveDecision(content, plans ?? [], [], (contexts ?? []) as PlanContext[], null);

  const { planId, planTitle, error: planError } = await applyPlanDecision(supabase, ownerId, decision, plans ?? []);
  if (planError) {
    return NextResponse.json({ ok: false, error: planError }, { status: 500 });
  }

  const { error: conversationError } = await insertConversationTurn(supabase, ownerId, planId, content, decision.reply);
  if (conversationError) {
    return NextResponse.json({ ok: false, error: conversationError }, { status: 500 });
  }

  if (planId) {
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
