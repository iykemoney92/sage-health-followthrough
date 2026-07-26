import { NextRequest, NextResponse } from "next/server";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { buildClaritiCallContext } from "@/lib/domain/clariti-call-context";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";
import { isClaritiElevenLabsAgentConfigured, isElevenLabsCallingConfigured, placeOutboundCall, toE164 } from "@/lib/integrations/elevenlabs";

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
  if (!isClaritiElevenLabsAgentConfigured()) {
    return NextResponse.json({ ok: false, error: "Clariti needs CLARITI_ELEVENLABS_AGENT_ID before scheduled calls can run." }, { status: 503 });
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

    const originalDocumentText = await fetchSessionDocumentText(supabase, followUp.session_id, followUp.owner_id);
    const parsedAnalysis = claritiAnalysisSchema.safeParse(followUp.analysis_payload);
    const callContext = parsedAnalysis.success
      ? buildClaritiCallContext({
          analysis: parsedAnalysis.data,
          goal: followUp.call_prompt,
          originalDocumentText,
          sessionId: followUp.session_id,
          userId: followUp.owner_id,
        })
      : {
          dynamicVariables: buildFallbackDynamicVariables(followUp, originalDocumentText),
          conversationConfigOverride: buildFallbackConversationOverride(followUp, originalDocumentText),
        };

    try {
      const call = await placeOutboundCall({
        toNumber: toE164(followUp.phone_number),
        dynamicVariables: callContext.dynamicVariables,
        conversationConfigOverride: callContext.conversationConfigOverride,
      });
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

async function fetchSessionDocumentText(supabase: NonNullable<ReturnType<typeof getOptionalSupabaseServiceClient>>, sessionId: string, ownerId: string) {
  const { data: link } = await supabase
    .from("clariti_session_documents")
    .select("document_id")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  const documentId = (link?.document_id as string | undefined) ?? null;
  if (!documentId) return null;

  const { data: document } = await supabase
    .from("clariti_documents")
    .select("extracted_text")
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return (document?.extracted_text as string | null | undefined) ?? null;
}

function buildFallbackDynamicVariables(followUp: DueFollowUp, originalDocumentText: string | null) {
  const documentTypeLabel = fallbackDocumentKindLabel(followUp.document_kind);
  const context = [
    `Document type: ${documentTypeLabel}`,
    `Document title: ${followUp.document_title}`,
    `Scheduled follow-up goal: ${followUp.call_prompt}`,
    originalDocumentText ? `Original extracted document excerpt: ${redactExcerpt(originalDocumentText)}` : "",
    `Safety boundary: ${followUp.safety_note}`,
  ].filter(Boolean).join("\n\n");
  const systemPrompt = [
    "You are Clariti, a careful consumer health document copilot on a scheduled phone follow-up.",
    "Always introduce yourself as Clariti. Never say Nura or any other product name.",
    `This call is about a ${documentTypeLabel}. Do not switch document types.`,
    "Use only the context below. If something is not in the context, say you do not see it and turn it into a safe question.",
    "Keep responses concise and ask one useful next question at a time.",
    "Do not diagnose, prescribe, decide urgency, decide insurance coverage, or say the user definitely owes money.",
    "Clariti context:",
    context,
  ].join("\n\n");
  const firstMessage = `Hi, this is Clariti. I’m calling for your scheduled follow-up about your ${documentTypeLabel}, “${followUp.document_title}”.`;

  return {
    user_name: "there",
    user_id: followUp.owner_id,
    session_id: followUp.session_id,
    plan_id: followUp.session_id,
    thread_title: followUp.document_title,
    document_kind: followUp.document_kind,
    document_type_label: documentTypeLabel,
    document_title: followUp.document_title,
    report_context: context,
    thread_context: context,
    original_document_excerpt: originalDocumentText ? redactExcerpt(originalDocumentText) : "",
    call_goal: followUp.call_prompt,
    checkin_goal: followUp.call_prompt,
    safety_boundary: followUp.safety_note,
    agent_name: "Clariti",
    assistant_name: "Clariti",
    product_name: "Clariti",
    brand_name: "Clariti",
    clariti_agent_instructions: systemPrompt,
    clariti_first_message: firstMessage,
    clariti_system_prompt: systemPrompt,
  };
}

function buildFallbackConversationOverride(followUp: DueFollowUp, originalDocumentText: string | null) {
  const dynamicVariables = buildFallbackDynamicVariables(followUp, originalDocumentText);
  return {
    agent: {
      first_message: dynamicVariables.clariti_first_message,
      prompt: {
        prompt: dynamicVariables.clariti_system_prompt,
      },
    },
  };
}

function fallbackDocumentKindLabel(kind: string) {
  if (kind === "radiology_report") return "radiology report";
  if (kind === "insurance_eob") return "insurance EOB";
  if (kind === "medical_bill") return "medical bill";
  return "health document";
}

function redactExcerpt(value: string) {
  return value
    .replace(/\b(MRN|Patient ID|PID|DOB|Date of Birth)\s*[:#]?\s*[A-Za-z0-9/_-]+/gi, "$1: [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}
