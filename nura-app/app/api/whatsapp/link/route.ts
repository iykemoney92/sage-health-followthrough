import { NextRequest, NextResponse } from "next/server";
import {
  disconnectWhatsapp,
  getOrCreateWhatsappLink,
  getWhatsappConnectionStatus,
} from "@/lib/channel-links";
import { createWhatsappHref } from "@/lib/whatsapp-link";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const statusOnly = request.nextUrl.searchParams.get("status") === "1";

  if (statusOnly) {
    const status = await getWhatsappConnectionStatus(supabase, user.id);
    return NextResponse.json({
      ok: true,
      linked: status.linked,
      code: status.pendingCode,
      expiresAt: status.expiresAt,
    });
  }

  // Linking a number is setup; proactive WhatsApp check-ins stay Plus-gated elsewhere.
  const link = await getOrCreateWhatsappLink(supabase, user.id);
  const code = link.linked ? null : link.code;
  const message = request.nextUrl.searchParams.get("message");
  const href = createWhatsappHref(code, message);

  if (!href) {
    const configured = process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") ?? "";
    const looksFake = /^1555\d{7}$/.test(configured) || /^1\d{3}555\d{4}$/.test(configured) || /^555\d{4}$/.test(configured);
    return NextResponse.json({
      ok: false,
      error: looksFake
        ? "Nura’s WhatsApp number looks like a placeholder (555). Set NEXT_PUBLIC_NURA_WHATSAPP_NUMBER to the real display number from Meta → WhatsApp → API Setup."
        : "WhatsApp number is not configured.",
    }, { status: 503 });
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

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const result = await disconnectWhatsapp(supabase, user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Could not disconnect WhatsApp." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linked: false });
}
