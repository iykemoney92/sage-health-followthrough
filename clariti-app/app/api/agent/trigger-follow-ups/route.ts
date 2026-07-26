import { NextRequest, NextResponse } from "next/server";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { buildClaritiCallContext } from "@/lib/domain/clariti-call-context";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { isElevenLabsCallingConfigured, placeOutboundCall, toE164 } from "@/lib/integrations/elevenlabs";

const STALE_THRESHOLD_MINUTES = 60;

type DueFollowUp = {
  id: string;
  session_id: string;
  owner_id: string;
  phone_number: string | null;
  action: string;
  document_title: string;
  document_kind: string;
  call_prompt: string;
  safety_note: string;
  scheduled_for: string;
  analysis_payload?: unknown;
};

export async function POST(request: NextRequest) {
  return triggerDueFollowUps(request, "agent");
}

export async function GET(request: NextRequest) {
  return triggerDueFollowUps(request, "cron");
}

async function triggerDueFollowUps(request: NextRequest, mode: "agent" | "cron") {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  const cronSecret = process.env.CRON_SECRET || secret;
  const isAgentAuthorized = request.headers.get("x-agent-secret") === secret;
  const isCronAuthorized = request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isAgentAuthorized && !isCronAuthorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getOptionalSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service role is not configured." }, { status: 503 });
  }

  if (!isElevenLabsCallingConfigured()) {
    return NextResponse.json({ ok: false, error: "ElevenLabs outbound calling is not configured." }, { status: 503 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from("clariti_follow_ups")
    .select("id, session_id, owner_id, phone_number, action, document_title, document_kind, call_prompt, safety_note, scheduled_for, analysis_payload")
    .is("triggered_at", null)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const due = (data ?? []) as DueFollowUp[];
  if (due.length === 0) return NextResponse.json({ ok: true, triggered: [] });

  const results: Record<string, unknown>[] = [];
  for (const followUp of due) {
    if (!followUp.phone_number) {
      await supabase.from("clariti_follow_ups").update({ triggered_at: nowIso, call_status: "skipped_no_phone" }).eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "skipped_no_phone" });
      continue;
    }

    const minutesOverdue = (now.getTime() - new Date(followUp.scheduled_for).getTime()) / 60_000;
    if (minutesOverdue > STALE_THRESHOLD_MINUTES) {
      await supabase.from("clariti_follow_ups").update({ triggered_at: nowIso, call_status: "missed_stale" }).eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "missed_stale" });
      continue;
    }

    const parsedAnalysis = claritiAnalysisSchema.safeParse(followUp.analysis_payload);
    const dynamicVariables = parsedAnalysis.success
      ? buildClaritiCallContext({
          analysis: parsedAnalysis.data,
          goal: followUp.call_prompt,
          sessionId: followUp.session_id,
          userId: followUp.owner_id,
        }).dynamicVariables
      : {
          user_name: "there",
          user_id: followUp.owner_id,
          session_id: followUp.session_id,
          plan_id: followUp.session_id,
          thread_title: followUp.document_title,
          document_kind: followUp.document_kind,
          document_title: followUp.document_title,
          report_context: `${followUp.document_title}\n\n${followUp.call_prompt}\n\nSafety boundary: ${followUp.safety_note}`,
          thread_context: `${followUp.document_title}\n\n${followUp.call_prompt}\n\nSafety boundary: ${followUp.safety_note}`,
          call_goal: followUp.call_prompt,
          checkin_goal: followUp.call_prompt,
          safety_boundary: followUp.safety_note,
        };

    try {
      const call = await placeOutboundCall({ toNumber: toE164(followUp.phone_number), dynamicVariables });
      await supabase
        .from("clariti_follow_ups")
        .update({
          triggered_at: nowIso,
          call_status: "placed",
          call_conversation_id: call.conversation_id ?? null,
          call_error: null,
        })
        .eq("id", followUp.id);
      await supabase.from("clariti_messages").insert({
        session_id: followUp.session_id,
        role: "assistant",
        content: `Placed the scheduled follow-up call for: ${followUp.action}.`,
      });
      results.push({ followUpId: followUp.id, status: "placed", conversationId: call.conversation_id ?? null });
    } catch (callError) {
      const message = callError instanceof Error ? callError.message : "Outbound call failed.";
      await supabase
        .from("clariti_follow_ups")
        .update({ triggered_at: nowIso, call_status: "failed", call_error: message })
        .eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, mode, triggered: results });
}
