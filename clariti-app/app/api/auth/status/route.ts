import { NextResponse } from "next/server";
import { hasAiConsent } from "@/lib/ai-consent";
import { cardFirstApplies, paywallPathFor } from "@/lib/billing/card-first";
import { ensureClaritiProfile, getPlusState } from "@/lib/billing/subscription";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

export async function GET(request: Request) {
  const configured = hasSupabaseBrowserConfig();
  const user = await getSessionUser();

  // Where a signed-in account with no trial or plan has to go before it can use
  // Clariti, or null. The upload screen reads this instead of letting someone
  // pick a document and collect a 402.
  let paywallPath: string | null = null;
  if (user) {
    const supabase = await getSupabaseSessionClient();
    void ensureClaritiProfile(supabase, user.id, (user.user_metadata?.display_name as string | undefined) ?? null);
    if (cardFirstApplies(request.headers.get("user-agent"))) {
      const state = await getPlusState(supabase, user.id).catch(() => null);
      if (state && !state.hasPlus) {
        paywallPath = paywallPathFor(state);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    configured,
    authenticated: Boolean(user),
    // Lets the upload screen route a signed-in user to the consent gate instead
    // of posting their document to the extractor and collecting a 403.
    aiConsent: hasAiConsent(user),
    paywallPath,
    user: user ? { id: user.id, email: user.email, name: user.user_metadata?.display_name } : null,
  });
}
