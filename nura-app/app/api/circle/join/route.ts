import { NextResponse } from "next/server";
import { z } from "zod";
import { INVITE_TOKEN_PATTERN, PENDING_INVITE_COOKIE } from "@/lib/care-circle";
import { acceptInvite } from "@/lib/care-circle-admin";
import { getSessionUser } from "@/lib/integrations/supabase-server";

const bodySchema = z.object({ token: z.string().regex(INVITE_TOKEN_PATTERN) });

function clearPending(response: NextResponse) {
  response.cookies.set(PENDING_INVITE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/** Accepts an invite for the signed-in user. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });

  const result = await acceptInvite(parsed.data.token, user.id);
  if (!result.ok) {
    const status = result.reason === "owner" ? 409 : 410;
    return clearPending(NextResponse.json({ ok: false, error: result.reason }, { status }));
  }
  return clearPending(NextResponse.json({ ok: true, planId: result.planId }));
}

/** "Not now": forget the pending invite so the app stops steering the user back to it. */
export async function DELETE() {
  return clearPending(NextResponse.json({ ok: true }));
}
