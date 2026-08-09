import { NextResponse } from "next/server";
import { ensureClaritiProfile } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

export async function GET() {
  const configured = hasSupabaseBrowserConfig();
  const user = await getSessionUser();

  if (user) {
    const supabase = await getSupabaseSessionClient();
    void ensureClaritiProfile(supabase, user.id, (user.user_metadata?.display_name as string | undefined) ?? null);
  }

  return NextResponse.json({
    ok: true,
    configured,
    authenticated: Boolean(user),
    user: user ? { id: user.id, email: user.email, name: user.user_metadata?.display_name } : null,
  });
}
