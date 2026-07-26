import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { buildClaritiCallContext } from "@/lib/domain/clariti-call-context";

const requestSchema = z.object({
  sessionId: z.string().default("clariti-session"),
  userName: z.string().optional(),
  analysis: claritiAnalysisSchema,
});

export async function POST(request: NextRequest) {
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
