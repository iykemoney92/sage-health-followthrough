import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { buildInboundCallContext, unknownCallerContext, type InboundCallContext } from "@/lib/domain/inbound-call-context";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
/** ElevenLabs waits on this before the call can start - keep it quick. */
export const maxDuration = 10;
/** ElevenLabs gives up fast: a 1.9s reply dropped the call on 21 Nov. */
const BUILD_TIMEOUT_MS = 1500;

/**
 * ElevenLabs conversation-initiation webhook for calls INTO Nura (WhatsApp calling).
 * Body: { caller_id, agent_id, called_number, call_sid?, conversation_id? }. On WhatsApp,
 * caller_id is the caller's WhatsApp number (digits) and called_number is Nura's phone number ID.
 *
 * It always answers 200 with every variable filled: an error or a timeout here would drop the
 * call, which is the bug this exists to fix. Lookups that fail fall back to the generic welcome.
 */
function toResponse(context: InboundCallContext) {
  return NextResponse.json({
    type: "conversation_initiation_client_data",
    dynamic_variables: context.dynamicVariables,
    conversation_config_override: { agent: { first_message: context.firstMessage } },
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret || request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { caller_id?: unknown; called_number?: unknown } | null;
  const callerId = typeof body?.caller_id === "string" ? body.caller_id : null;

  const startedAt = Date.now();
  try {
    const supabase = getSupabaseServerClient();
    const context = await Promise.race([
      buildInboundCallContext(supabase, callerId),
      new Promise<InboundCallContext>((resolve) => setTimeout(() => resolve(unknownCallerContext()), BUILD_TIMEOUT_MS)),
    ]);
    logger.info("voice_inbound.context", { matched: context.matched, ms: Date.now() - startedAt });
    return toResponse(context);
  } catch (error) {
    logger.error("voice_inbound.context_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return toResponse(unknownCallerContext());
  }
}
