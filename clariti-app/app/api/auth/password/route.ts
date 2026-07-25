import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const authSchema = z.object({
  mode: z.enum(["signin", "signup"]),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = authSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email and password." }, { status: 400 });
  }

  const { mode, email, password, name } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const result = mode === "signin"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error.message }, { status: 401 });
  }

  let session = result.data.session;
  let user = result.data.user;

  if (mode === "signup" && !session) {
    const signInResult = await supabase.auth.signInWithPassword({ email, password });
    if (signInResult.error) {
      return NextResponse.json({ ok: false, error: signInResult.error.message }, { status: 401 });
    }
    session = signInResult.data.session;
    user = signInResult.data.user;
  }

  if (!session || !user) {
    return NextResponse.json({ ok: false, error: "Check your email to confirm your account, then sign in." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.user_metadata?.display_name },
  });
}
