import { NextRequest, NextResponse } from "next/server";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getOrCreateWhatsappLink } from "@/lib/channel-links";
import { createWhatsappHref } from "@/lib/whatsapp-link";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const paywall = await requirePlusAccess(supabase, user.id, "whatsapp");
  if (paywall) return paywall;

  const link = await getOrCreateWhatsappLink(supabase, user.id);
  const code = link.linked ? null : link.code;
  const message = request.nextUrl.searchParams.get("message");
  const href = createWhatsappHref(code, message);

  if (!href) {
    return NextResponse.json({ ok: false, error: "WhatsApp number is not configured." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    href,
    code,
    linked: link.linked,
    expiresAt: link.expiresAt,
    linkSaved: link.linkSaved,
    note: link.note,
  });
}
