import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  displayName: z.string().trim().min(1),
  avatarUrl: z.string().max(900_000).optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, avatarUrl, phone } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      display_name: displayName,
      avatar_url: avatarUrl || undefined,
    },
  });

  if (authError) {
    return NextResponse.json({ ok: false, error: authError.message }, { status: 500 });
  }

  const normalizedPhone = phone ? phone.replace(/[^\d]/g, "") : "";
  const { error: profileError } = await supabase.from("nura_profiles").upsert({
    id: user.id,
    display_name: displayName,
    phone: normalizedPhone || null,
  });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
