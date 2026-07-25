import { NextResponse } from "next/server";
import { getSessionUser, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

export async function GET() {
  const configured = hasSupabaseBrowserConfig();
  const user = await getSessionUser();

  return NextResponse.json({
    ok: true,
    configured,
    authenticated: Boolean(user),
    user: user ? { id: user.id, email: user.email, name: user.user_metadata?.display_name } : null,
  });
}
