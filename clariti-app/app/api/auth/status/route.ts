import { NextResponse } from "next/server";
import { hasAiConsent } from "@/lib/ai-consent";
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
    // Lets the upload screen route a signed-in user to the consent gate instead
    // of posting their document to the extractor and collecting a 403.
    aiConsent: hasAiConsent(user),
    user: user ? { id: user.id, email: user.email, name: user.user_metadata?.display_name } : null,
  });
}
