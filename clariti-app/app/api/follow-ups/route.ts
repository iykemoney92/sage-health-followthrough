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

  if (user) {
    const supabase = await getSupabaseSessionClient();
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
    };
    const { data, error } = await supabase
      .from("clariti_follow_ups")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (error && /phone_number/i.test(error.message)) {
      const { phone_number: phoneNumberForNewerSchema, ...fallbackPayload } = insertPayload;
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
  });
}
