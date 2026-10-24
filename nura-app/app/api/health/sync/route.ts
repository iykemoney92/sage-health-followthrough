import { NextResponse } from "next/server";
import { z } from "zod";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";
import { addDays, localDay } from "@/lib/health/health-brief";
import { HEALTH_RETENTION_DAYS } from "@/lib/health/health-store";
import { HEALTH_METRICS, HEALTH_PLATFORMS, isPlausibleHealthValue } from "@/lib/health/metrics";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const daySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metric: z.enum(HEALTH_METRICS),
  value: z.number().finite(),
  value_secondary: z.number().finite().nullable(),
  sample_count: z.number().int().min(1).max(500).optional(),
});

const syncSchema = z.object({
  platform: z.enum(HEALTH_PLATFORMS),
  days: z.array(daySchema).max(HEALTH_RETENTION_DAYS * HEALTH_METRICS.length),
});

/**
 * Daily summaries from the device. Only for a connection the person consented to on
 * this platform, and only metrics they were asked about; implausible values and days
 * outside the retention window are dropped rather than stored.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasAiConsent(user)) return aiConsentRequiredResponse();

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  const { platform, days } = parsed.data;

  const supabase = await getSupabaseSessionClient();
  const { data: connection } = await supabase
    .from("nura_health_connections")
    .select("id, metrics")
    .eq("owner_id", user.id)
    .eq("platform", platform)
    .is("revoked_at", null)
    .maybeSingle();
  if (!connection) return NextResponse.json({ ok: false, error: "not_connected" }, { status: 409 });

  const allowed = new Set((connection.metrics as string[]) ?? []);
  // A day of slack either side of "today" covers devices in a different timezone to the server.
  const today = localDay(new Date(), "UTC");
  const oldest = addDays(today, -HEALTH_RETENTION_DAYS);
  const newest = addDays(today, 1);
  const syncedAt = new Date().toISOString();

  const rows = days
    .filter((d) => allowed.has(d.metric) && d.day >= oldest && d.day <= newest)
    .filter((d) => isPlausibleHealthValue(d.metric, d.value, d.value_secondary))
    .map((d) => ({
      owner_id: user.id,
      day: d.day,
      metric: d.metric,
      value: d.value,
      value_secondary: d.metric === "blood_pressure" ? d.value_secondary : null,
      sample_count: d.sample_count ?? 1,
      platform,
      synced_at: syncedAt,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("nura_health_daily").upsert(rows, { onConflict: "owner_id,day,metric" });
    if (error) {
      await supabase
        .from("nura_health_connections")
        .update({ last_sync_status: "error" })
        .eq("id", connection.id);
      return NextResponse.json({ ok: false, error: "not_saved" }, { status: 500 });
    }
  }

  // Retention: anything past the window goes on every sync, so no separate purge job is needed.
  await supabase.from("nura_health_daily").delete().eq("owner_id", user.id).lt("day", oldest);

  await supabase
    .from("nura_health_connections")
    .update({ last_synced_at: syncedAt, last_sync_status: rows.length > 0 ? "ok" : "no_data" })
    .eq("id", connection.id);

  return NextResponse.json({ ok: true, stored: rows.length });
}
