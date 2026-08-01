import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { sendPushToOwner } from "@/lib/integrations/push";

const requestSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.from("nura_push_subscriptions").upsert(
    {
      owner_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent") || null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const test = await sendPushToOwner(user.id, {
    title: "Notifications on",
    body: "Nura will check in here when something needs your attention.",
    url: "/today",
  }, { bypassRateLimit: true });

  return NextResponse.json({
    ok: true,
    testSent: test.sent,
    testSkipped: test.skipped ?? null,
  });
}
