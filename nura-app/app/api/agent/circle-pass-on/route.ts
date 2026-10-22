import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import {
  CIRCLE_NOTE_MAX_CHARS,
  createCircleNote,
  listActiveMemberIds,
  planOwnerFirstName,
  pushCircleNote,
} from "@/lib/care-circle-notes";
import { logger } from "@/lib/logger";
import { loadRecipientForPlan } from "@/lib/care-recipient";
import { sendPushToOwner } from "@/lib/integrations/push";

export const runtime = "nodejs";

const requestSchema = z.object({
  message: z.string().min(1).max(CIRCLE_NOTE_MAX_CHARS * 2),
  // Filled by ElevenLabs from dynamic variables, never by the model.
  conversation_id: z.string().optional(),
  plan_id: z.string().optional(),
  user_id: z.string().optional(),
});

/**
 * The voice agent's `pass_on_to_circle` tool. Nura calls it only after asking "anything you'd
 * like me to pass on?", reading the message back, and hearing a clear yes - see circlePassOnBrief
 * in voice-checkin-context. The plan is resolved from the live call's conversation id where
 * possible, so the model can't aim a note at some other plan.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { message, conversation_id: conversationId, plan_id: planIdHint, user_id: userIdHint } = parsed.data;

  const supabase = getSupabaseServerClient();

  let planId: string | null = null;
  let checkInId: string | null = null;
  if (conversationId) {
    const { data: checkIn } = await supabase
      .from("nura_check_ins")
      .select("id, plan_id")
      .eq("call_conversation_id", conversationId)
      .maybeSingle();
    if (checkIn) {
      planId = checkIn.plan_id as string;
      checkInId = checkIn.id as string;
    }
  }
  if (!planId && planIdHint && userIdHint) {
    // Same trust as the other agent tools: the secret plus the ids ElevenLabs was given for this call.
    const { data: plan } = await supabase.from("nura_plans").select("id").eq("id", planIdHint).eq("owner_id", userIdHint).maybeSingle();
    planId = (plan?.id as string | undefined) ?? null;
  }
  if (!planId) {
    return NextResponse.json({
      ok: false,
      error: "plan_not_found",
      message: "Tell the user, kindly, that you couldn't pass that on just now and they can add it on their Care plan page in the app.",
    }, { status: 404 });
  }

  // On a call to someone the owner cares for, the owner is who they're passing it on to - that
  // works whether or not anyone else is in the circle.
  const recipient = await loadRecipientForPlan(supabase, planId);

  if (!recipient && (await listActiveMemberIds(supabase, planId)).length === 0) {
    return NextResponse.json({
      ok: false,
      error: "no_circle",
      message: "Nobody is in this Care plan's circle, so there is no one to pass it on to. Tell the user gently.",
    }, { status: 409 });
  }

  const result = await createCircleNote(supabase, { planId, body: message, source: "voice_call", checkInId });
  if (!result.ok) {
    logger.warn("circle_pass_on.rejected", { planId, error: result.error });
    return NextResponse.json({
      ok: false,
      error: result.error,
      message:
        result.error === "limit"
          ? "A few messages have already been passed on today. Tell the user they can add more on their Care plan page."
          : "Tell the user, kindly, that you couldn't pass that on just now and they can add it on their Care plan page in the app.",
    }, { status: result.error === "limit" ? 429 : 400 });
  }

  const senderFirstName = recipient ? recipient.first_name : await planOwnerFirstName(supabase, planId);
  if (!result.duplicate) {
    await pushCircleNote(supabase, planId, senderFirstName, result.note).catch((error) =>
      logger.error("circle_pass_on.push_failed", { message: error instanceof Error ? error.message : String(error) }),
    );
    if (recipient) {
      await sendPushToOwner(recipient.owner_id, {
        title: `A message from ${recipient.first_name}`,
        body: result.note.body.slice(0, 160),
        url: `/plans/${planId}`,
      }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Passed on. Confirm to the user in one short, warm sentence that you've sent it, then continue wrapping up the call.",
  });
}
