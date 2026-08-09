import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import {
  checkInReminderEmailHtml,
  checkInReminderEmailText,
  nuraEmailLogoAttachment,
  sendAuthEmail,
} from "@/lib/integrations/resend";
import { sendPushToOwner } from "@/lib/integrations/push";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { formatInTimeZone } from "@/lib/timezone";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Minutes before scheduled_for to send the heads-up. */
const REMINDER_MINUTES_BEFORE = Number(process.env.CHECKIN_REMINDER_MINUTES_BEFORE || 60);
/** Catch window so a minute cron reliably hits each check-in once. */
const REMINDER_WINDOW_MINUTES = 8;
const OBSERVATION_LABEL = "checkin_reminder_sent";

type ReminderCheckIn = {
  id: string;
  owner_id: string;
  plan_id: string;
  channel: string;
  prompt: string;
  scheduled_for: string;
  reminder_sent_at?: string | null;
  nura_plans?: { title?: string | null } | null;
};

function isAuthorized(request: NextRequest) {
  const agentSecret = process.env.AGENT_TOOL_SECRET;
  if (agentSecret && request.headers.get("x-agent-secret") === agentSecret) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://usenura.app").replace(
    /\/$/,
    "",
  );
}

function firstNameFrom(displayName: string | null | undefined, email: string | null | undefined) {
  const fromDisplay = displayName?.trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;
  const local = email?.split("@")[0]?.trim();
  return local || undefined;
}

async function alreadyReminded(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  checkIn: ReminderCheckIn,
) {
  if (checkIn.reminder_sent_at) return true;

  const { data } = await supabase
    .from("nura_observations")
    .select("id")
    .eq("owner_id", checkIn.owner_id)
    .eq("plan_id", checkIn.plan_id)
    .eq("label", OBSERVATION_LABEL)
    .eq("value", checkIn.id)
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

async function markReminded(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  checkIn: ReminderCheckIn,
) {
  const nowIso = new Date().toISOString();

  // Preferred column (migration 0020). Ignore failure if not applied yet.
  const updated = await supabase
    .from("nura_check_ins")
    .update({ reminder_sent_at: nowIso })
    .eq("id", checkIn.id);
  if (updated.error && !/reminder_sent_at/i.test(updated.error.message)) {
    console.error("[check-in-reminders] stamp reminder_sent_at failed", checkIn.id, updated.error.message);
  }

  // Always write observation fallback for idempotency without requiring the column.
  const observed = await supabase.from("nura_observations").insert({
    owner_id: checkIn.owner_id,
    plan_id: checkIn.plan_id,
    label: OBSERVATION_LABEL,
    value: checkIn.id,
    recorded_at: nowIso,
  });
  if (observed.error) {
    console.error("[check-in-reminders] observation stamp failed", checkIn.id, observed.error.message);
  }
}

async function runCheckInReminders(request: NextRequest) {
  if (!process.env.AGENT_TOOL_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "cron is not configured" }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Supabase is not configured" },
      { status: 503 },
    );
  }

  const now = Date.now();
  const leadMs = Math.max(5, REMINDER_MINUTES_BEFORE) * 60_000;
  const slackMs = REMINDER_WINDOW_MINUTES * 60_000;
  // scheduled_for is roughly now + lead (± slack)
  const windowStart = new Date(now + leadMs - slackMs).toISOString();
  const windowEnd = new Date(now + leadMs + slackMs).toISOString();

  const { data: candidates, error } = await supabase
    .from("nura_check_ins")
    .select("id, owner_id, plan_id, channel, prompt, scheduled_for, reminder_sent_at, nura_plans(title)")
    .is("completed_at", null)
    .is("triggered_at", null)
    .gte("scheduled_for", windowStart)
    .lte("scheduled_for", windowEnd)
    .order("scheduled_for", { ascending: true })
    .limit(40);

  // If reminder_sent_at column isn't migrated yet, retry without it.
  let rows = (candidates ?? []) as ReminderCheckIn[];
  if (error) {
    const fallback = await supabase
      .from("nura_check_ins")
      .select("id, owner_id, plan_id, channel, prompt, scheduled_for, nura_plans(title)")
      .is("completed_at", null)
      .is("triggered_at", null)
      .gte("scheduled_for", windowStart)
      .lte("scheduled_for", windowEnd)
      .order("scheduled_for", { ascending: true })
      .limit(40);
    if (fallback.error) {
      return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 500 });
    }
    rows = (fallback.data ?? []) as ReminderCheckIn[];
  }

  const base = appBaseUrl();
  let emailed = 0;
  let pushed = 0;
  let skipped = 0;
  let failures = 0;
  const results: Record<string, unknown>[] = [];

  for (const checkIn of rows) {
    if (await alreadyReminded(supabase, checkIn)) {
      skipped += 1;
      results.push({ checkInId: checkIn.id, status: "already_reminded" });
      continue;
    }

    const access = await getSubscriptionAccess(supabase, checkIn.owner_id);
    if (!access.hasPlus) {
      skipped += 1;
      results.push({ checkInId: checkIn.id, status: "skipped_plus_required" });
      continue;
    }

    const { data: profile } = await supabase
      .from("nura_profiles")
      .select("display_name")
      .eq("id", checkIn.owner_id)
      .maybeSingle();

    const { data: authData } = await supabase.auth.admin.getUserById(checkIn.owner_id);
    const email = authData.user?.email ?? null;
    const firstName = firstNameFrom(
      profile?.display_name ?? (authData.user?.user_metadata?.display_name as string | undefined) ?? null,
      email,
    );
    const planTitle = checkIn.nura_plans?.title?.trim() || "your Care plan";
    const workspaceUrl = `${base}/workspace?planId=${checkIn.plan_id}`;
    const timeZone = await resolveUserTimeZone(supabase, checkIn.owner_id, {
      authMetadata: (authData.user?.user_metadata ?? null) as Record<string, unknown> | null,
    });
    const whenLabel = formatInTimeZone(checkIn.scheduled_for, timeZone, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    let emailOk = false;
    let pushOk = false;

    if (email) {
      const sent = await sendAuthEmail({
        to: email,
        subject: `Nura check-in in about ${REMINDER_MINUTES_BEFORE >= 60 ? "an hour" : `${REMINDER_MINUTES_BEFORE} minutes`}`,
        html: checkInReminderEmailHtml({
          workspaceUrl,
          scheduledFor: checkIn.scheduled_for,
          planTitle,
          channel: checkIn.channel,
          firstName,
          minutesBefore: REMINDER_MINUTES_BEFORE,
          timeZone,
        }),
        text: checkInReminderEmailText({
          workspaceUrl,
          scheduledFor: checkIn.scheduled_for,
          planTitle,
          channel: checkIn.channel,
          firstName,
          minutesBefore: REMINDER_MINUTES_BEFORE,
          timeZone,
        }),
        idempotencyKey: `checkin-reminder:${checkIn.id}`,
        attachments: nuraEmailLogoAttachment(),
      });
      emailOk = sent.ok;
      if (!sent.ok) {
        console.error("[check-in-reminders] email failed", checkIn.id, sent.error);
      } else {
        emailed += 1;
      }
    }

    const pushResult = await sendPushToOwner(
      checkIn.owner_id,
      {
        title: "Upcoming check-in",
        body: `Around ${whenLabel}: ${planTitle}`,
        url: `/workspace?planId=${checkIn.plan_id}`,
      },
      { bypassRateLimit: true },
    ).catch(() => null);
    pushOk = Boolean(pushResult && pushResult.sent > 0);
    if (pushOk) pushed += 1;

    if (emailOk || pushOk) {
      await markReminded(supabase, checkIn);
      results.push({
        checkInId: checkIn.id,
        status: "reminded",
        email: emailOk,
        push: pushOk,
        scheduledFor: checkIn.scheduled_for,
      });
    } else {
      failures += 1;
      results.push({
        checkInId: checkIn.id,
        status: "failed",
        email: emailOk,
        push: pushOk,
        pushSkipped: pushResult?.skipped ?? null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    minutesBefore: REMINDER_MINUTES_BEFORE,
    windowStart,
    windowEnd,
    candidates: rows.length,
    emailed,
    pushed,
    skipped,
    failures,
    results,
  });
}

export async function GET(request: NextRequest) {
  return runCheckInReminders(request);
}

export async function POST(request: NextRequest) {
  return runCheckInReminders(request);
}
