import { NextResponse } from "next/server";
import { z } from "zod";
import { respondToConsent } from "@/lib/care-recipient-admin";
import { CONSENT_TOKEN_PATTERN } from "@/lib/care-recipient";

const requestSchema = z.object({
  token: z.string().regex(CONSENT_TOKEN_PATTERN),
  decision: z.enum(["yes", "no", "stop"]),
});

/**
 * The answer from the /agree page. Public on purpose - the person answering has no account, and
 * the unguessable link is what proves they were sent it. Everything it can change is scoped to
 * the one person that link belongs to.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const result = await respondToConsent(parsed.data.token, parsed.data.decision, {
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 410 });
  return NextResponse.json({ ok: true, status: result.status });
}
