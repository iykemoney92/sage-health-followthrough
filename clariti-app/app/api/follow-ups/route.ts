import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { getSubscriptionAccess, type PlusFeature } from "@/lib/billing/subscription";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSessionUser, getSupabaseSessionClient, hasSupabaseBrowserConfig } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  sessionId: z.string().default("clariti-session"),
  channel: z.enum(["email", "in_app"]).default("email"),
  scheduledFor: z.string().datetime(),
  action: z.string().min(1),
  email: z.string().trim().email().optional(),
  analysis: claritiAnalysisSchema,
});

/**
 * How many check-ins a free reader gets, for the life of the account.
 *
 * THIS IS THE PRICING DECISION FOR THIS ROUTE. Change the number, change
 * nothing else.
 *
 * Check-ins used to be behind a hard Plus gate. That was backwards: one check-in
 * is one Resend email — fractions of a cent — and a check-in is one of only two
 * things in Clariti that bring a reader back at all. Gating it meant nobody ever
 * received one.
 *
 * Three matches FREE_DOCUMENT_LIMIT in lib/billing/subscription.ts on purpose:
 * a free reader gets one check-in per free document, so every document they can
 * hold can have a reminder attached to it. Lifetime rather than per-period,
 * which is the shape the free document and video limits already use — the point
 * of the ceiling is that a reader who has felt three of these has felt the thing
 * that is worth paying for.
 */
const FREE_CHECK_IN_LIMIT = 3;

/**
 * Check-ins this account has ever scheduled.
 *
 * Derived from the rows themselves, the way lib/billing/subscription.ts counts
 * documents and videos, rather than from a counter a client could write.
 * clariti_follow_ups has no DELETE policy — app/api/account/delete/route.ts
 * needs the service role to clear it — so this tally cannot be wound back from a
 * browser.
 *
 * `known` is false when the count could not be read. A check-in spends no
 * provider money worth protecting, so an unreadable count lets the request
 * through rather than locking a reader out of a free feature over a database
 * hiccup — the same asymmetry lib/rate-limit.ts draws, where only the routes
 * that spend real money fail closed. The per-window ceiling below still applies
 * either way.
 */
async function countScheduledCheckIns(supabase: SupabaseClient, ownerId: string) {
  const { count, error } = await supabase
    .from("clariti_follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  if (error) {
    console.error("[follow-ups] free allowance count failed:", error.message);
    return { known: false, used: 0 };
  }

  return { known: true, used: count ?? 0 };
}

/**
 * The refusal a free reader who has already set three check-ins should get.
 *
 * The body is deliberately the one plusRequiredResponse sends — error
 * "plus_required", feature, upgradeUrl, message — because app/workspace/page.tsx
 * matches on exactly that shape, and that match is what fires
 * track("plus_upgrade_redirect"). Changing the shape would silently drop the
 * funnel event. Only the words differ, and they name what the reader has already
 * had rather than telling them the feature was never theirs.
 */
function freeCheckInLimitResponse(used: number) {
  return NextResponse.json(
    {
      ok: false,
      error: "plus_required",
      feature: "follow_ups" satisfies PlusFeature,
      upgradeUrl: "/billing",
      message:
        `You have set ${used} check-ins, which is the ${FREE_CHECK_IN_LIMIT} a free account gets. `
        + "Clariti Plus lifts the cap: a check-in for every result you are waiting on, each one arriving "
        + "with what the document actually said, so nothing you meant to follow up on quietly slides.",
    },
    { status: 402 },
  );
}

export async function GET() {
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ ok: true, followUps: [] });
  }

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("clariti_follow_ups")
    .select("id, session_id, channel, action, document_title, document_kind, phone_number, scheduled_for, call_status, triggered_at, created_at")
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (error) {
    if (/call_status|triggered_at|phone_number/i.test(error.message)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("clariti_follow_ups")
        .select("id, session_id, channel, action, document_title, document_kind, scheduled_for, created_at")
        .order("scheduled_for", { ascending: true })
        .limit(20);
      if (fallbackError) return NextResponse.json({ ok: false, error: fallbackError.message }, { status: 500 });
      return NextResponse.json({ ok: true, followUps: fallbackData ?? [] });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, followUps: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, analysis, channel, email, scheduledFor, sessionId } = parsed.data;
  const user = await getSessionUser();
  if (hasSupabaseBrowserConfig() && !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: "Supabase auth is required to schedule Clariti check-ins." }, { status: 503 });
  }

  // The destination is the account's own address, never one the caller names. A check-in is
  // Clariti-branded mail from Clariti's sending domain, so accepting a client-supplied address
  // made this a relay anyone with a session could point at a stranger — paid for in Clariti's
  // sender reputation. Supabase has already verified this address at sign-up, which is why
  // matching it is enough and a separate verification round trip is not needed.
  const checkInEmail = (user.email ?? "").trim().toLowerCase();
  if (!checkInEmail || !user.email_confirmed_at) {
    return NextResponse.json({
      ok: false,
      error: "Confirm the email address on your account before scheduling a check-in.",
    }, { status: 400 });
  }

  const requestedEmail = email?.trim().toLowerCase();
  if (requestedEmail && requestedEmail !== checkInEmail) {
    return NextResponse.json({
      ok: false,
      error: "Clariti sends check-ins to the email address on your account. Change your account email to send them somewhere else.",
    }, { status: 400 });
  }

  const callPrompt =
    `Email check-in about "${analysis.title}". Focus on this action: ${action}. ` +
    `Ask whether anything changed, whether they need further analysis or comparison with a newer report, and what they want Clariti to look at next. ` +
    `Use only the stored Clariti analysis and remind the user to confirm clinical, billing, or coverage decisions with the right professional.`;

  let persistedId: string | null = null;
  let persistedMessage: { id: string; role: string; content: string; created_at: string } | null = null;

  const supabase = await getSupabaseSessionClient();

  // This route had no per-window ceiling: the hard Plus gate was the only thing
  // bounding it, and opening it to free readers takes that away. Every row
  // scheduled here becomes a Clariti-branded email from Clariti's own sending
  // domain, so a runaway client spends sender reputation even though it spends
  // almost no money — the same reputation the destination check above exists to
  // protect. `calls` is the window this feature already owns: phone check-ins
  // became email check-ins (the table still says call_prompt), and
  // app/api/calls/outbound/route.ts now returns 410, so nothing else is charged
  // against it.
  const limited = await enforceRateLimit(supabase, "calls");
  if (limited) return limited;

  // Plus is unchanged: no allowance, no count, straight through. Only a free
  // reader is metered.
  const access = await getSubscriptionAccess(supabase, user.id);
  if (!access.hasPlus) {
    const scheduled = await countScheduledCheckIns(supabase, user.id);
    if (scheduled.known && scheduled.used >= FREE_CHECK_IN_LIMIT) {
      return freeCheckInLimitResponse(scheduled.used);
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from("clariti_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ ok: false, error: "Clariti could not find this saved analysis." }, { status: 404 });
  }

  const insertPayload = {
    session_id: sessionId,
    owner_id: user.id,
    channel,
    action,
    document_title: analysis.title,
    document_kind: analysis.kind,
    call_prompt: callPrompt,
    // Reuse phone_number column as contact destination for email check-ins.
    phone_number: checkInEmail,
    safety_note: analysis.safetyNote,
    scheduled_for: scheduledFor,
    analysis_payload: analysis,
  };
  const { data, error } = await supabase
    .from("clariti_follow_ups")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error && /phone_number|analysis_payload/i.test(error.message)) {
    const { analysis_payload: analysisPayloadForNewerSchema, phone_number: phoneNumberForNewerSchema, ...fallbackPayload } = insertPayload;
    void analysisPayloadForNewerSchema;
    void phoneNumberForNewerSchema;
    const { data: fallbackData } = await supabase
      .from("clariti_follow_ups")
      .insert(fallbackPayload)
      .select("id")
      .maybeSingle();
    persistedId = (fallbackData?.id as string | undefined) ?? null;
  } else if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    persistedId = (data?.id as string | undefined) ?? null;
  }

  const confirmation =
    `Done. I’ll email ${checkInEmail} around ${new Date(scheduledFor).toLocaleString()} to check in about: ${action}. ` +
    "Clariti will ask if anything changed or if you need further analysis.";
  const { data: messageData } = await supabase
    .from("clariti_messages")
    .insert({ session_id: sessionId, role: "assistant", content: confirmation })
    .select("id, role, content, created_at")
    .maybeSingle();
  persistedMessage = (messageData as typeof persistedMessage) ?? null;

  return NextResponse.json({
    ok: true,
    followUp: {
      id: persistedId ?? `clariti-followup-${Date.now()}`,
      sessionId,
      channel,
      scheduledFor,
      email: checkInEmail,
      action,
      documentTitle: analysis.title,
      callPrompt,
      persisted: Boolean(persistedId),
      safetyNote: analysis.safetyNote,
    },
    message: persistedMessage,
  });
}
