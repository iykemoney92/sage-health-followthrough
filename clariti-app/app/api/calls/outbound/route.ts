import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { buildClaritiCallContext } from "@/lib/domain/clariti-call-context";
import { isClaritiElevenLabsAgentConfigured, isElevenLabsCallingConfigured, placeOutboundCall, toE164 } from "@/lib/integrations/elevenlabs";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  phoneNumber: z.string().trim().min(7),
  action: z.string().trim().min(1).optional(),
  analysis: claritiAnalysisSchema,
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "Supabase auth is required to place calls." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  if (!isElevenLabsCallingConfigured()) {
    return NextResponse.json({ ok: false, error: "ElevenLabs outbound calling is not configured." }, { status: 503 });
  }
  if (!isClaritiElevenLabsAgentConfigured()) {
    return NextResponse.json({ ok: false, error: "Clariti needs a Clariti-specific ElevenLabs agent. Set CLARITI_ELEVENLABS_AGENT_ID so calls cannot use a shared template." }, { status: 503 });
  }

  const { action, analysis, phoneNumber, sessionId } = parsed.data;
  const supabase = await getSupabaseSessionClient();
  const { data: session, error: sessionError } = await supabase
    .from("clariti_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ ok: false, error: "Clariti could not find this saved analysis." }, { status: 404 });
  }

  const originalDocumentText = await fetchSessionDocumentText(supabase, sessionId, user.id);
  const callGoal = action ?? `Talk through ${analysis.title} and help the user decide what to ask next.`;
  const elevenLabs = buildClaritiCallContext({
    analysis,
    goal: callGoal,
    originalDocumentText,
    sessionId,
    userId: user.id,
    userName: (user.user_metadata?.display_name as string | undefined) ?? user.email ?? undefined,
  });

  try {
    const call = await placeOutboundCall({
      toNumber: toE164(phoneNumber),
      dynamicVariables: elevenLabs.dynamicVariables,
      conversationConfigOverride: elevenLabs.conversationConfigOverride,
    });
    const confirmation = `Calling now. Clariti will focus on: ${callGoal}.`;
    await supabase.from("clariti_follow_ups").insert({
      session_id: sessionId,
      owner_id: user.id,
      channel: "phone",
      phone_number: toE164(phoneNumber),
      action: "Call Clariti now",
      document_title: analysis.title,
      document_kind: analysis.kind,
      call_prompt: elevenLabs.systemPrompt,
      safety_note: analysis.safetyNote,
      scheduled_for: new Date().toISOString(),
      analysis_payload: analysis,
      triggered_at: new Date().toISOString(),
      call_status: "placed",
      call_conversation_id: call.conversation_id ?? null,
      call_error: null,
    });
    const { data: message } = await supabase
      .from("clariti_messages")
      .insert({ session_id: sessionId, role: "assistant", content: confirmation })
      .select("id, role, content, created_at")
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      call: {
        status: "placed",
        toNumber: toE164(phoneNumber),
        conversationId: call.conversation_id ?? null,
        callSid: call.callSid ?? null,
      },
      message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clariti could not place the call.";
    await supabase.from("clariti_follow_ups").insert({
      session_id: sessionId,
      owner_id: user.id,
      channel: "phone",
      phone_number: toE164(phoneNumber),
      action: "Call Clariti now",
      document_title: analysis.title,
      document_kind: analysis.kind,
      call_prompt: elevenLabs.systemPrompt,
      safety_note: analysis.safetyNote,
      scheduled_for: new Date().toISOString(),
      analysis_payload: analysis,
      triggered_at: new Date().toISOString(),
      call_status: "failed",
      call_error: message,
    });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}

async function fetchSessionDocumentText(supabase: SupabaseClient, sessionId: string, ownerId: string) {
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
