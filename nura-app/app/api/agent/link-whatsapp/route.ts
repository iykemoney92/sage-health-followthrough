import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { extractWhatsappLinkCode } from "@/lib/whatsapp-link";

const requestSchema = z.object({
  linkCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rawCallerPhone = request.headers.get("x-caller-phone");
  const phone = rawCallerPhone ? rawCallerPhone.replace(/[^\d]/g, "") : null;
  if (!phone) {
    return NextResponse.json({ ok: false, error: "missing caller phone" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const code = extractWhatsappLinkCode(parsed.data.linkCode);
  if (!code) {
    return NextResponse.json({ ok: false, error: "Could not find a valid NURA- link code in that text." }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data: pendingLink, error: pendingError } = await supabase
    .from("nura_channel_links")
    .select("id, owner_id")
    .eq("provider", "whatsapp")
    .eq("link_code", code)
    .eq("status", "pending")
    .gt("expires_at", now)
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json({ ok: false, error: pendingError.message }, { status: 500 });
  }

  if (!pendingLink) {
    return NextResponse.json({ ok: false, linked: false, error: "That link code wasn't found or has expired. Ask the user to open the Connect WhatsApp button in Nura again for a fresh code." }, { status: 404 });
  }

  await supabase
    .from("nura_channel_links")
    .update({ status: "inactive" })
    .eq("provider", "whatsapp")
    .eq("channel_identifier", phone)
    .eq("status", "active");

  await supabase
    .from("nura_channel_links")
    .update({ status: "expired" })
    .eq("owner_id", pendingLink.owner_id)
    .eq("provider", "whatsapp")
    .eq("status", "pending")
    .neq("id", pendingLink.id);

  const { data: channelLink, error } = await supabase
    .from("nura_channel_links")
    .update({
      channel_identifier: phone,
      status: "active",
      linked_at: now,
    })
    .eq("id", pendingLink.id)
    .select("owner_id")
    .maybeSingle();

  if (error || !channelLink) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Link code not found or expired." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("display_name")
    .eq("id", channelLink.owner_id)
    .maybeSingle();

  const displayName = typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  const firstName = displayName.split(" ").filter(Boolean)[0] || "there";

  return NextResponse.json({
    ok: true,
    linked: true,
    ownerId: channelLink.owner_id,
    message: `Linked. Greet ${firstName} by name and confirm their Nura account is now connected on WhatsApp.`,
  });
}
