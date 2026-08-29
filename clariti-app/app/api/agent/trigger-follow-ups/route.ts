import { NextRequest, NextResponse } from "next/server";
import { checkInEmailHtml, checkInEmailText, sendAuthEmail } from "@/lib/integrations/resend";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";

export const runtime = "nodejs";

// Each due row costs a Resend call plus several Supabase round trips, all sequential, and one
// tick can carry 25 of them — comfortably past the default function budget. That matters more
// now that the batch is claimed up front: a run killed mid-loop leaves its tail claimed as
// "processing" with nothing left running to release it, so the whole batch has to fit.
export const maxDuration = 300;

const STALE_THRESHOLD_MINUTES = 60 * 24 * 3; // email check-ins stay valid for a few days

type DueFollowUp = {
  id: string;
  session_id: string;
  owner_id: string;
  channel: string | null;
  phone_number: string | null;
  action: string;
  document_title: string;
  document_kind: string;
  call_prompt: string;
  safety_note: string;
  scheduled_for: string;
  analysis_payload?: unknown;
};

export async function POST(request: NextRequest) {
  return triggerDueFollowUps(request, "agent");
}

export async function GET(request: NextRequest) {
  return triggerDueFollowUps(request, "cron");
}

function isAuthorizedTrigger(request: NextRequest) {
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (agentSecret && request.headers.get("x-agent-secret") === agentSecret) return true;

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

async function triggerDueFollowUps(request: NextRequest, mode: "agent" | "cron") {
  // Either secret is enough to run: the manual script sends x-agent-secret, Vercel Cron sends
  // the bearer. Neither configured means nothing could ever authenticate, so refuse rather than
  // leave an unauthenticated endpoint that emails users on demand.
  if (!process.env.AGENT_TOOL_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  if (!isAuthorizedTrigger(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getOptionalSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service role is not configured." }, { status: 503 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from("clariti_follow_ups")
    .select("id, session_id, owner_id, channel, phone_number, action, document_title, document_kind, call_prompt, safety_note, scheduled_for, analysis_payload")
    .is("triggered_at", null)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const selected = (data ?? []) as DueFollowUp[];
  if (selected.length === 0) return NextResponse.json({ ok: true, mode, triggered: [] });

  // Claim the whole batch before sending anything. triggered_at used to be written only after
  // the email went out, so a second overlapping invocation — an overlapping cron tick, a retry,
  // the manual script run alongside the schedule — could select the same rows and email the
  // same person twice. `.is("triggered_at", null)` means only rows nobody has claimed yet are
  // updated, and `.select()` returns exactly those, so rows a concurrent run already took are
  // dropped from this one.
  const { data: claimed, error: claimError } = await supabase
    .from("clariti_follow_ups")
    .update({ triggered_at: nowIso, call_status: "processing" })
    .in("id", selected.map((followUp) => followUp.id))
    .is("triggered_at", null)
    .select("id");

  if (claimError) {
    console.error("[agent/trigger-follow-ups] claim failed", { mode, error: claimError.message });
    return NextResponse.json({ ok: false, error: claimError.message }, { status: 500 });
  }

  const claimedIds = new Set((claimed ?? []).map((row) => row.id as string));
  const due = selected.filter((followUp) => claimedIds.has(followUp.id));
  if (due.length === 0) return NextResponse.json({ ok: true, mode, triggered: [] });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://useclariti.app").replace(/\/$/, "");
  const results: Record<string, unknown>[] = [];

  for (const followUp of due) {
    const channel = (followUp.channel || "email").toLowerCase();
    const contact = (followUp.phone_number || "").trim();

    // Phone follow-ups are disabled for now — skip legacy phone rows.
    if (channel === "phone" || looksLikePhone(contact)) {
      await supabase
        .from("clariti_follow_ups")
        .update({ call_status: "skipped_phone_disabled" })
        .eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "skipped_phone_disabled" });
      continue;
    }

    const email = looksLikeEmail(contact) ? contact.toLowerCase() : await resolveOwnerEmail(supabase, followUp.owner_id);
    if (!email) {
      await supabase
        .from("clariti_follow_ups")
        .update({ call_status: "skipped_no_email" })
        .eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "skipped_no_email" });
      continue;
    }

    const minutesOverdue = (now.getTime() - new Date(followUp.scheduled_for).getTime()) / 60_000;
    if (minutesOverdue > STALE_THRESHOLD_MINUTES) {
      await supabase.from("clariti_follow_ups").update({ call_status: "missed_stale" }).eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "missed_stale" });
      continue;
    }

    const workspaceUrl = `${appUrl}/workspace?sessionId=${encodeURIComponent(followUp.session_id)}`;
    try {
      const sent = await sendAuthEmail({
        to: email,
        subject: `Clariti check-in: ${followUp.document_title}`,
        html: checkInEmailHtml({
          documentTitle: followUp.document_title,
          action: followUp.action,
          workspaceUrl,
        }),
        text: checkInEmailText({
          documentTitle: followUp.document_title,
          action: followUp.action,
          workspaceUrl,
        }),
        idempotencyKey: `clariti-checkin/${followUp.id}`,
      });

      if (!sent.ok) throw new Error(sent.error);

      await supabase
        .from("clariti_follow_ups")
        .update({
          call_status: "email_sent",
          call_error: null,
        })
        .eq("id", followUp.id);

      await supabase.from("clariti_messages").insert({
        session_id: followUp.session_id,
        role: "assistant",
        content:
          `I sent your email check-in about “${followUp.document_title}”. ` +
          "Open Clariti if anything changed or you want further analysis.",
      });

      results.push({ followUpId: followUp.id, status: "email_sent", emailId: sent.id });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Check-in email failed.";
      // Releasing the claim is what makes a transient Resend outage recoverable: a failed send
      // used to keep triggered_at set, so the check-in was silently never sent again. The stale
      // sweep above bounds the retries, and every send carries the same idempotencyKey, so a
      // row that actually reached Resend before erroring cannot be delivered twice.
      await supabase
        .from("clariti_follow_ups")
        .update({ triggered_at: null, call_status: "failed", call_error: message })
        .eq("id", followUp.id);
      console.error("[agent/trigger-follow-ups] check-in email failed", {
        mode,
        followUpId: followUp.id,
        ownerId: followUp.owner_id,
        sessionId: followUp.session_id,
        scheduledFor: followUp.scheduled_for,
        error: message,
      });
      results.push({ followUpId: followUp.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, mode, triggered: results });
}

async function resolveOwnerEmail(
  supabase: NonNullable<ReturnType<typeof getOptionalSupabaseServiceClient>>,
  ownerId: string,
) {
  const { data, error } = await supabase.auth.admin.getUserById(ownerId);
  if (error) return null;
  return data.user?.email?.trim().toLowerCase() || null;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikePhone(value: string) {
  if (!value || looksLikeEmail(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7;
}
