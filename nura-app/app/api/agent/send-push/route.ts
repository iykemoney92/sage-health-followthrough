import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveAgentOwnerId } from "@/lib/agent/resolve-owner";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { isPushConfigured, sanitizePushUrl, sendPushToOwner } from "@/lib/integrations/push";

/**
 * ElevenLabs / agent webhook tool: send a browser push to the identified user.
 *
 * Auth: `x-agent-secret: $AGENT_TOOL_SECRET`
 * Identify user: body.ownerId and/or `x-caller-phone`
 *
 * Register in ElevenLabs as a webhook tool pointing at:
 *   POST https://usenura.app/api/agent/send-push
 */
const requestSchema = z.object({
  ownerId: z.string().uuid().optional(),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(180),
  url: z.string().max(200).optional(),
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (request.headers.get("x-agent-secret") !== secret) {
    return unauthorized();
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        sent: 0,
        skipped: "not_configured",
        error: "Browser push is not configured on the server (missing VAPID keys).",
        message: "Could not send a browser notification — push isn’t set up. Ask the user to check in inside the Nura app instead.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const rawCallerPhone = request.headers.get("x-caller-phone");
  const callerPhone = rawCallerPhone ? rawCallerPhone.replace(/[^\d]/g, "") : null;

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { ownerId, via } = await resolveAgentOwnerId(supabase, {
    ownerId: parsed.data.ownerId,
    callerPhoneDigits: callerPhone,
  });

  if (!ownerId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not identify the user — provide ownerId or a known caller phone.",
        message: "I couldn’t find which account to notify. Ask them to open Nura in the browser.",
      },
      { status: 404 },
    );
  }

  const result = await sendPushToOwner(ownerId, {
    title: parsed.data.title,
    body: parsed.data.body,
    url: sanitizePushUrl(parsed.data.url),
  });

  if (result.skipped === "no_subscriptions" || result.sent === 0) {
    return NextResponse.json({
      ok: false,
      ...result,
      ownerId,
      identifiedVia: via,
      message:
        result.skipped === "no_subscriptions"
          ? "This person hasn’t enabled browser notifications yet. Ask them to turn on notifications in Nura → Me → Preferences, or message them another way."
          : result.error
            || "Push didn’t reach any device. Ask them to open Nura in the browser or try WhatsApp.",
    });
  }

  return NextResponse.json({
    ok: true,
    ...result,
    ownerId,
    identifiedVia: via,
    message: `Browser notification sent (${result.sent} device${result.sent === 1 ? "" : "s"}).`,
  });
}
