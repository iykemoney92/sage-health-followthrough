import { NextResponse } from "next/server";
import { AI_CONSENT_METADATA_KEY, AI_CONSENT_PATH } from "@/lib/ai-consent";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/**
 * Records that the signed-in user agreed to send document contents to the model.
 *
 * Written server-side against the session client so the stored value is a
 * timestamp this route minted, not whatever a caller put in the body.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.auth.updateUser({
    data: { [AI_CONSENT_METADATA_KEY]: new Date().toISOString() },
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "consent_not_saved" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Withdraws it again. GDPR Art. 7(3) requires withdrawal to be as easy as
 * granting, so it clears the same key POST writes rather than routing anyone
 * through support.
 *
 * The caller is left where `proxy.ts` will not follow — the account surface
 * stays reachable without consent — so the response carries the gate path for
 * the UI to send them to once it has confirmed.
 */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.auth.updateUser({
    data: { [AI_CONSENT_METADATA_KEY]: null },
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "consent_not_revoked" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revoked: true, next: AI_CONSENT_PATH });
}
