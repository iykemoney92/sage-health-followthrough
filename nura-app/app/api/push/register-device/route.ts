import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { sendPushToOwner } from "@/lib/integrations/push";

const requestSchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().min(1),
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
  const { error } = await supabase.from("nura_native_push_tokens").upsert(
    {
      owner_id: user.id,
      platform: parsed.data.platform,
      token: parsed.data.token,
    },
    { onConflict: "token" },
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
