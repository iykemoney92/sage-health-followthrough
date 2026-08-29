import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { buildClaritiCallContext } from "@/lib/domain/clariti-call-context";

// node:crypto for the constant-time compare.
export const runtime = "nodejs";

const requestSchema = z.object({
  sessionId: z.string().default("clariti-session"),
  userName: z.string().optional(),
  analysis: claritiAnalysisSchema,
});

/**
 * Called by the ElevenLabs conversational agent, not by the browser, so it
 * authenticates with a shared secret rather than a session.
 *
 * It fails closed when AGENT_TOOL_SECRET is unset. That is deliberate even
 * though the route only reshapes data the caller already sent: an unauthenticated
 * POST endpoint on a health domain is something to be able to say does not
 * exist, and outbound calling is currently disabled anyway
 * (app/api/calls/outbound/route.ts), so nothing legitimate calls this today.
 */
function isAuthorised(request: NextRequest) {
  const expected = process.env.AGENT_TOOL_SECRET?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-agent-secret")?.trim();
  return Boolean(provided) && timingSafeEqualString(provided!, expected);
}

function timingSafeEqualString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { analysis, sessionId, userName } = parsed.data;
  const elevenLabs = buildClaritiCallContext({ analysis, sessionId, userName });

  return NextResponse.json({
    ok: true,
    elevenLabs,
  });
}
