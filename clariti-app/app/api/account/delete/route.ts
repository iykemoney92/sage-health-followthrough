import { NextResponse } from "next/server";
import { getSupabaseAdminClient, hasSupabaseServiceRole } from "@/lib/auth/supabase-admin";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";

const STORAGE_BUCKETS = ["clariti-documents", "clariti-videos"] as const;

/** Storage paths nest one level under the owner folder (`<uid>/<job id>/scene-0.mp4`). */
const MAX_STORAGE_DEPTH = 3;
const STORAGE_PAGE_SIZE = 1000;

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // A session client cannot finish this. clariti_follow_ups has no DELETE policy, and the
  // RevenueCat ledger and rate-limit counters have RLS on with no policies at all — under
  // RLS a delete that matches nothing succeeds silently, so the analysis payloads on those
  // follow-up rows would quietly survive a "permanent" deletion. Removing the auth user is
  // service-role-only besides. Refuse rather than half-delete.
  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({
      ok: false,
      error: "Account deletion is unavailable right now. Please contact support and we will delete your account for you.",
    }, { status: 503 });
  }

  const admin = getSupabaseAdminClient();
  const ownerId = user.id;

  const { data: profile } = await admin
    .from("clariti_profiles")
    .select("revenuecat_app_user_id, revenuecat_original_app_user_id")
    .eq("id", ownerId)
    .maybeSingle();

  const { data: sessionRows, error: sessionsError } = await admin
    .from("clariti_sessions")
    .select("id")
    .eq("owner_id", ownerId);

  if (sessionsError) {
    return deletionFailed("read sessions", sessionsError.message);
  }

  const sessionIds = (sessionRows ?? []).map((row) => row.id as string);

  // Files first. A failure here aborts before any row is touched, which keeps the worst
  // outcome "nothing was deleted, try again" rather than "the rows pointing at your
  // uploaded bill are gone but the bill is still in the bucket".
  let storageObjectsRemoved = 0;
  for (const bucket of STORAGE_BUCKETS) {
    try {
      storageObjectsRemoved += await removeOwnerFolder(admin, bucket, ownerId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown storage error";
      console.error(`[account/delete] could not empty ${bucket}: ${detail}`);
      return NextResponse.json({
        ok: false,
        error: "Clariti could not remove your uploaded files, so it stopped before deleting anything. Please try again, or contact support if it keeps happening.",
      }, { status: 500 });
    }
  }

  const deleted: Record<string, number> = {};

  if (sessionIds.length > 0) {
    // clariti_session_documents is keyed on (session_id, document_id) and has no id column,
    // so the deleted-row echo has to name a column that actually exists on each table.
    //
    // clariti_follow_ups is swept twice: owner_id is nullable and rows written before
    // accounts existed have none, but they still carry analysis_payload — the whole
    // analysis — and the contact address in phone_number. The session pass reaches those.
    const children = [
      { table: "clariti_messages", idColumn: "id" },
      { table: "clariti_artifacts", idColumn: "id" },
      { table: "clariti_session_documents", idColumn: "session_id" },
      { table: "clariti_follow_ups", idColumn: "id" },
    ] as const;

    for (const { table, idColumn } of children) {
      const result = await deleteWhereIn(admin, table, "session_id", sessionIds, idColumn);
      if (result.error) {
        return deletionFailed(`delete ${table}`, result.error);
      }
      deleted[table] = (deleted[table] ?? 0) + result.count;
    }
  }

  for (const table of ["clariti_video_generations", "clariti_follow_ups", "clariti_sessions", "clariti_documents"] as const) {
    const { data, error } = await admin.from(table).delete().eq("owner_id", ownerId).select("id");
    if (error) {
      return deletionFailed(`delete ${table}`, error.message);
    }
    deleted[table] = (deleted[table] ?? 0) + (data?.length ?? 0);
  }

  // The rate-limit counters hold no medical content, but they are keyed on the user id and
  // nothing cascades them, so leaving them behind means the account id outlives the account.
  const { error: rateLimitError } = await admin.from("clariti_rate_limits").delete().eq("owner_id", ownerId);
  if (rateLimitError && !/does not exist/i.test(rateLimitError.message)) {
    return deletionFailed("delete clariti_rate_limits", rateLimitError.message);
  }

  const { data: profileRows, error: profileError } = await admin
    .from("clariti_profiles")
    .delete()
    .eq("id", ownerId)
    .select("id");
  if (profileError) {
    return deletionFailed("delete clariti_profiles", profileError.message);
  }
  deleted.clariti_profiles = profileRows?.length ?? 0;

  // The webhook ledger is keyed by RevenueCat's app user id, which is normally the Supabase
  // user id but can differ after an anonymous purchase is aliased to a real account.
  const billingIds = [ownerId, profile?.revenuecat_app_user_id, profile?.revenuecat_original_app_user_id]
    .filter((value): value is string => Boolean(value));
  const uniqueBillingIds = Array.from(new Set(billingIds));
  const billingEvents = await deleteWhereIn(admin, "clariti_revenuecat_webhook_events", "app_user_id", uniqueBillingIds, "event_id");
  // This ledger arrived with the billing migration and holds no medical content, so a
  // database that predates it should not block someone from deleting their account.
  if (billingEvents.error && !/does not exist/i.test(billingEvents.error)) {
    return deletionFailed("delete clariti_revenuecat_webhook_events", billingEvents.error);
  }
  deleted.clariti_revenuecat_webhook_events = billingEvents.count;

  const { error: authError } = await admin.auth.admin.deleteUser(ownerId);

  return NextResponse.json({
    ok: true,
    deleted,
    storageObjectsRemoved,
    authAccountDeleted: !authError,
    message: authError
      ? "Everything you uploaded and everything Clariti generated has been permanently deleted. Your sign-in record could not be removed automatically — contact support and we will clear it."
      : "Your account and everything in it has been permanently deleted.",
  });
}

/**
 * PostgREST failures name tables and columns. That belongs in the server log, not in a
 * dialog someone is reading while deleting their medical records.
 */
function deletionFailed(stage: string, detail: string) {
  console.error(`[account/delete] could not ${stage}: ${detail}`);
  return NextResponse.json({
    ok: false,
    error: "Clariti could not finish deleting your account, and stopped rather than leaving it half done. Please try again, or contact support if it keeps happening.",
  }, { status: 500 });
}

/**
 * PostgREST puts `in` filters in the query string, so a heavy account's session list would
 * blow the URL length limit in one request.
 */
async function deleteWhereIn(
  admin: AdminClient,
  table: string,
  column: string,
  values: string[],
  idColumn = "id",
) {
  let count = 0;
  for (let index = 0; index < values.length; index += 100) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .in(column, values.slice(index, index + 100))
      .select(idColumn);
    if (error) return { count, error: error.message };
    count += data?.length ?? 0;
  }
  return { count, error: null as string | null };
}

async function removeOwnerFolder(admin: AdminClient, bucket: string, ownerId: string) {
  const paths = await listStoragePaths(admin, bucket, ownerId, 1);
  let removed = 0;

  for (let index = 0; index < paths.length; index += STORAGE_PAGE_SIZE) {
    const batch = paths.slice(index, index + STORAGE_PAGE_SIZE);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) throw new Error(error.message);
    removed += batch.length;
  }

  return removed;
}

async function listStoragePaths(admin: AdminClient, bucket: string, prefix: string, depth: number): Promise<string[]> {
  if (depth > MAX_STORAGE_DEPTH) return [];

  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: STORAGE_PAGE_SIZE, offset });
    if (error) throw new Error(error.message);
    const entries = data ?? [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      // A listing row with no id is a synthesised folder rather than a real object.
      if (entry.id === null) paths.push(...await listStoragePaths(admin, bucket, path, depth + 1));
      else paths.push(path);
    }

    if (entries.length < STORAGE_PAGE_SIZE) break;
    offset += entries.length;
  }

  return paths;
}
