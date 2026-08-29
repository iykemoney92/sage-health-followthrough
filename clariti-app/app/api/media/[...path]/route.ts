import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

// The signed URL is minted per request and must never be cached by a CDN, or one
// user's short-lived URL would be served to the next.
export const dynamic = "force-dynamic";

/** Long enough to play a two-minute explainer without a mid-playback 403. */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

/**
 * Serves generated explainer videos and illustrations, which used to live in a
 * public bucket.
 *
 * These files are derived from someone's medical bill or radiology report, so a
 * guessable public URL was the wrong shape for them entirely. The bucket is now
 * private (migration 0006) and everything is reached through here: the caller
 * must have a session, the object must sit under their own `<user id>/` prefix,
 * and what they get back is a signed URL that expires.
 *
 * The ownership check is done here rather than left to storage RLS alone because
 * the redirect target is a signed URL — once minted it works for anyone holding
 * it, so it must only ever be minted for the owner.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const objectPath = path.map(decodeURIComponent).join("/");

  // The first segment is the owner id the uploader wrote the file under. A
  // request for someone else's prefix is a 404 rather than a 403: whether a
  // given object exists is itself information the caller has no right to.
  if (path[0] !== user.id || objectPath.includes("..")) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase.storage
    .from("clariti-videos")
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
