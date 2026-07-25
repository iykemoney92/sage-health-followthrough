import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { placeOutboundCall, isElevenLabsCallingConfigured } from "@/lib/integrations/elevenlabs";
import { buildVoiceCheckinContext } from "@/lib/domain/voice-checkin-context";

function toE164(digits: string) {
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data: dueCheckIns, error: dueError } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, prompt, scheduled_for, nura_plans(title)")
    .is("completed_at", null)
    .is("triggered_at", null)
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(5);

  if (dueError) {
    return NextResponse.json({ ok: false, error: dueError.message }, { status: 500 });
  }

  if (!dueCheckIns || dueCheckIns.length === 0) {
    return NextResponse.json({ ok: true, triggered: [] });
  }

  if (!isElevenLabsCallingConfigured()) {
    return NextResponse.json({ ok: false, error: "ElevenLabs outbound calling is not configured." }, { status: 503 });
  }

  const results = [];

  for (const checkIn of dueCheckIns) {
    const ownerId = checkIn.owner_id as string;
    const planId = checkIn.plan_id as string;
    const planTitle = (checkIn as { nura_plans?: { title?: string } }).nura_plans?.title ?? "your Thread";

    const [{ data: link }, { data: profile }] = await Promise.all([
      supabase
        .from("nura_channel_links")
        .select("channel_identifier")
        .eq("owner_id", ownerId)
        .eq("provider", "whatsapp")
        .eq("status", "active")
        .maybeSingle(),
      supabase.from("nura_profiles").select("display_name").eq("id", ownerId).maybeSingle(),
    ]);

    const phone = link?.channel_identifier as string | undefined;

    if (!phone) {
      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: now, call_status: "skipped_no_phone" })
        .eq("id", checkIn.id);
      results.push({ checkInId: checkIn.id, planTitle, status: "skipped_no_phone" });
      continue;
    }

    const displayName = typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
    const firstName = displayName.split(" ").filter(Boolean)[0] || "there";
    const toNumber = toE164(phone);

    try {
      const context = await buildVoiceCheckinContext(supabase, ownerId, planId, firstName);
      const dynamicVariables = {
        ...(context?.dynamicVariables ?? { user_name: firstName, user_id: ownerId, plan_id: planId, thread_title: planTitle, thread_context: "", checkin_goal: checkIn.prompt as string }),
        checkin_goal: (checkIn.prompt as string) ?? context?.dynamicVariables.checkin_goal ?? "",
      };

      const call = await placeOutboundCall({ toNumber, dynamicVariables });

      await supabase
        .from("nura_check_ins")
        .update({
          triggered_at: now,
          call_status: "placed",
          call_conversation_id: call.conversation_id ?? null,
        })
        .eq("id", checkIn.id);

      results.push({ checkInId: checkIn.id, planTitle, toNumber, status: "placed", conversationId: call.conversation_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Outbound call failed.";
      await supabase
        .from("nura_check_ins")
        .update({ triggered_at: now, call_status: "failed", call_error: message })
        .eq("id", checkIn.id);
      results.push({ checkInId: checkIn.id, planTitle, toNumber, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, triggered: results });
}
