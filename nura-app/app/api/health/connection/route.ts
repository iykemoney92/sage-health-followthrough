import { NextResponse } from "next/server";
import { z } from "zod";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";
import { deleteHealthData, getActiveHealthConnection } from "@/lib/health/health-store";
import { HEALTH_CONSENT_VERSION, HEALTH_METRICS, HEALTH_PLATFORMS } from "@/lib/health/metrics";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

/** The signed-in person's health connection, if any. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const connection = await getActiveHealthConnection(supabase, user.id);
  return NextResponse.json({
    ok: true,
    connection: connection
      ? {
          platform: connection.platform,
          metrics: connection.metrics,
          connected_at: connection.consented_at,
          last_synced_at: connection.last_synced_at,
          last_sync_status: connection.last_sync_status,
        }
      : null,
  });
}

const consentSchema = z.object({
  platform: z.enum(HEALTH_PLATFORMS),
  metrics: z.array(z.enum(HEALTH_METRICS)).min(1),
  consent_version: z.literal(HEALTH_CONSENT_VERSION),
});

/**
 * Records agreement on Nura's health consent screen, before the OS permission sheet.
 * The timestamp is minted here, not taken from the body.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  // Health data only ever exists to reach the model, so the AI consent comes first.
  if (!hasAiConsent(user)) return aiConsentRequiredResponse();

  const parsed = consentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.from("nura_health_connections").upsert(
    {
      owner_id: user.id,
      platform: parsed.data.platform,
      consented_at: new Date().toISOString(),
      consent_version: parsed.data.consent_version,
      metrics: parsed.data.metrics,
      revoked_at: null,
      last_synced_at: null,
      last_sync_status: null,
    },
    { onConflict: "owner_id,platform" },
  );
  if (error) return NextResponse.json({ ok: false, error: "not_saved" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Disconnect: revoke every connection and delete all stored health data straight away. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase
    .from("nura_health_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("owner_id", user.id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ ok: false, error: "not_saved" }, { status: 500 });

  try {
    await deleteHealthData(supabase, user.id);
  } catch (deleteError) {
    console.error("[health-disconnect]", user.id, deleteError);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
