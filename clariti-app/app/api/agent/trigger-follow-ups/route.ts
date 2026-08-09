import { NextRequest, NextResponse } from "next/server";
import { checkInEmailHtml, checkInEmailText, sendAuthEmail } from "@/lib/integrations/resend";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";

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

async function triggerDueFollowUps(request: NextRequest, mode: "agent" | "cron") {
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "agent tool is not configured" }, { status: 503 });
  }
  const cronSecret = process.env.CRON_SECRET || secret;
  const isAgentAuthorized = request.headers.get("x-agent-secret") === secret;
  const isCronAuthorized = request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isAgentAuthorized && !isCronAuthorized) {
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

  const due = (data ?? []) as DueFollowUp[];
  if (due.length === 0) return NextResponse.json({ ok: true, triggered: [] });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://useclariti.app").replace(/\/$/, "");
  const results: Record<string, unknown>[] = [];

  for (const followUp of due) {
    const channel = (followUp.channel || "email").toLowerCase();
    const contact = (followUp.phone_number || "").trim();

    // Phone follow-ups are disabled for now — skip legacy phone rows.
    if (channel === "phone" || looksLikePhone(contact)) {
      await supabase
        .from("clariti_follow_ups")
        .update({ triggered_at: nowIso, call_status: "skipped_phone_disabled" })
        .eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "skipped_phone_disabled" });
      continue;
    }

    const email = looksLikeEmail(contact) ? contact.toLowerCase() : await resolveOwnerEmail(supabase, followUp.owner_id);
    if (!email) {
      await supabase
        .from("clariti_follow_ups")
        .update({ triggered_at: nowIso, call_status: "skipped_no_email" })
        .eq("id", followUp.id);
      results.push({ followUpId: followUp.id, status: "skipped_no_email" });
      continue;
    }

    const minutesOverdue = (now.getTime() - new Date(followUp.scheduled_for).getTime()) / 60_000;
    if (minutesOverdue > STALE_THRESHOLD_MINUTES) {
      await supabase.from("clariti_follow_ups").update({ triggered_at: nowIso, call_status: "missed_stale" }).eq("id", followUp.id);
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
          triggered_at: nowIso,
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
      await supabase
        .from("clariti_follow_ups")
        .update({ triggered_at: nowIso, call_status: "failed", call_error: message })
        .eq("id", followUp.id);
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
