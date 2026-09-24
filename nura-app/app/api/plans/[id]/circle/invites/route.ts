import { NextResponse } from "next/server";
import { appOriginFromRequest } from "@/lib/auth/helpers";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { createInvite, getPlanAccess, inviteUrl, whatsappShareUrl } from "@/lib/care-circle";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/** Mints a single-use invite link for a Care plan the caller owns. Sharing is a Plus feature. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, id);
  if (!access) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (access.role !== "owner") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const paywall = await requirePlusAccess(supabase, user.id, "circle");
  if (paywall) return paywall;

  const rateLimit = await checkRateLimit(supabase, user.id, "circle-invite", 10, 60 * 60);
  if (rateLimit.limited) return rateLimitedResponse(rateLimit.retryAfterSeconds);

  const { token, expiresAt } = await createInvite(supabase, user.id, id);
  const url = inviteUrl(appOriginFromRequest(request), token);
  return NextResponse.json({
    ok: true,
    url,
    whatsappUrl: whatsappShareUrl(access.plan.title as string, url),
    expiresAt,
  });
}
