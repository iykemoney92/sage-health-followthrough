import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  sessionId: z.string().default("clariti-session"),
  channel: z.enum(["phone", "in_app"]).default("phone"),
  scheduledFor: z.string().datetime(),
  action: z.string().min(1),
  phoneNumber: z.string().trim().min(7).optional(),
  analysis: claritiAnalysisSchema,
});

export async function GET() {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ ok: true, followUps: [] });
  }

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_follow_ups")
    .select("id, session_id, channel, action, document_title, document_kind, phone_number, scheduled_for, call_status, triggered_at, created_at")
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, followUps: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, analysis, channel, phoneNumber, scheduledFor, sessionId } = parsed.data;
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const callPrompt =
    `Follow up about "${analysis.title}". Focus on this action: ${action}. ` +
    `${phoneNumber ? `Call the user on ${phoneNumber}. ` : ""}` +
    `Use only the stored Clariti analysis and remind the user to confirm clinical, billing, or coverage decisions with the right professional.`;

  let persistedId: string | null = null;
  let persistedMessage: { id: string; role: string; content: string; created_at: string } | null = null;

  if (user) {
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

    const insertPayload = {
      session_id: sessionId,
      owner_id: user.id,
      channel,
      action,
      document_title: analysis.title,
      document_kind: analysis.kind,
      call_prompt: callPrompt,
      phone_number: phoneNumber,
      safety_note: analysis.safetyNote,
      scheduled_for: scheduledFor,
      analysis_payload: analysis,
    };
    const { data, error } = await supabase
      .from("clariti_follow_ups")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (error && /phone_number|analysis_payload/i.test(error.message)) {
      const { analysis_payload: analysisPayloadForNewerSchema, phone_number: phoneNumberForNewerSchema, ...fallbackPayload } = insertPayload;
      void analysisPayloadForNewerSchema;
      void phoneNumberForNewerSchema;
      const { data: fallbackData } = await supabase
        .from("clariti_follow_ups")
        .insert(fallbackPayload)
        .select("id")
        .maybeSingle();
      persistedId = (fallbackData?.id as string | undefined) ?? null;
    } else {
      persistedId = (data?.id as string | undefined) ?? null;
    }

    const confirmation = `Done. I saved ${phoneNumber ?? "the phone number"} for ${new Date(scheduledFor).toLocaleString()}. Purpose: ${action}.`;
    const { data: messageData } = await supabase
      .from("clariti_messages")
      .insert({ session_id: sessionId, role: "assistant", content: confirmation })
      .select("id, role, content, created_at")
      .maybeSingle();
    persistedMessage = (messageData as typeof persistedMessage) ?? null;
  }

  return NextResponse.json({
    ok: true,
    followUp: {
      id: persistedId ?? `clariti-followup-${Date.now()}`,
      sessionId,
      channel,
      scheduledFor,
      phoneNumber,
      action,
      documentTitle: analysis.title,
      callPrompt,
      persisted: Boolean(persistedId),
      safetyNote: analysis.safetyNote,
    },
    message: persistedMessage,
  });
}
