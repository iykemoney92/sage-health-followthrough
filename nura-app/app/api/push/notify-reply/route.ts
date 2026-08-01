import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { sendPushToOwner } from "@/lib/integrations/push";

const requestSchema = z.object({
  body: z.string().min(1).max(300),
  url: z.string().min(1).default("/today"),
});

// Called by the client only when it received a chat reply while the tab/app was backgrounded -
// the reply already happened, this just makes sure the user actually notices it landed.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await sendPushToOwner(user.id, {
    title: "Nura replied",
    body: parsed.data.body,
    url: parsed.data.url,
  }).catch(() => null);

  return NextResponse.json({ ok: true, sent: result?.sent ?? 0 });
}
