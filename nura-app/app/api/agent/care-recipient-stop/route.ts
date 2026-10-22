import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stopCallsFromCall } from "@/lib/care-recipient-admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const requestSchema = z.object({
  // Filled by ElevenLabs from dynamic variables, never by the model.
  conversation_id: z.string().optional(),
  plan_id: z.string().optional(),
});

/**
 * The voice agent's `stop_calls` tool, used on calls to someone an owner cares for when they say
 * they don't want these calls. The plan comes from the live call's conversation id where
 * possible, so a call can only stop calls about itself. Stopping is immediate: their agreement
 * is marked revoked, anything still scheduled is cancelled, and the owner is told.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const result = await stopCallsFromCall(parsed.data.conversation_id ?? null, parsed.data.plan_id ?? null);
  if (!result.ok) {
    logger.warn("care_recipient_stop.not_found", { conversationId: parsed.data.conversation_id ?? null });
    return NextResponse.json({
      ok: false,
      error: result.reason,
      message: "Tell them kindly that you've noted it and won't call again, then end the call.",
    }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: `Done - no more calls. Tell ${result.recipientFirstName} in one short, warm sentence that you won't call again and you'll let the person who set this up know, then end the call.`,
  });
}
