import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionAccess,
  markExpiredSubscriptionIfNeeded,
  TRIAL_REMINDER_DAYS_BEFORE,
} from "@/lib/billing/subscription";
import {
  nuraEmailLogoAttachment,
  sendAuthEmail,
  trialReminderEmailHtml,
  trialReminderEmailText,
} from "@/lib/integrations/resend";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

type TrialingProfile = {
  id: string;
  display_name: string | null;
  trial_ends_at: string;
  trial_reminder_4d_sent_at: string | null;
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

function firstNameFrom(displayName: string | null, email: string | null | undefined) {
  const fromDisplay = displayName?.trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;
  const local = email?.split("@")[0]?.trim();
  return local || undefined;
}

async function runTrialLifecycle(request: NextRequest) {
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
  const reminderWindowStart = new Date(now).toISOString();
  const reminderWindowEnd = new Date(now + TRIAL_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000).toISOString();
  // Only fire once users are inside the ~4-day window (not earlier).
  const reminderEarliest = new Date(now + (TRIAL_REMINDER_DAYS_BEFORE - 0.5) * 24 * 60 * 60 * 1000).toISOString();

  const { data: reminderCandidates, error: reminderError } = await supabase
    .from("nura_profiles")
    .select("id, display_name, trial_ends_at, trial_reminder_4d_sent_at")
    .eq("subscription_status", "trialing")
    .not("trial_ends_at", "is", null)
    .is("trial_reminder_4d_sent_at", null)
    .gte("trial_ends_at", reminderEarliest)
    .lte("trial_ends_at", reminderWindowEnd);

  if (reminderError) {
    return NextResponse.json({ ok: false, error: reminderError.message }, { status: 500 });
  }

  const billingUrl = `${appBaseUrl()}/billing`;
  let remindersSent = 0;
  let reminderFailures = 0;

  for (const row of (reminderCandidates ?? []) as TrialingProfile[]) {
    const access = await getSubscriptionAccess(supabase, row.id);
    if (!access.hasPlus || access.status !== "trialing" || !access.trialEndsAt) continue;

    const { data: authData } = await supabase.auth.admin.getUserById(row.id);
    const email = authData.user?.email;
    if (!email) continue;

    const firstName = firstNameFrom(
      row.display_name ?? (authData.user?.user_metadata?.display_name as string | undefined) ?? null,
      email,
    );
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(access.trialEndsAt).getTime() - now) / (24 * 60 * 60 * 1000)),
    );

    const sent = await sendAuthEmail({
      to: email,
      subject: `Your Nura trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      html: trialReminderEmailHtml({
        billingUrl,
        trialEndsAt: access.trialEndsAt,
        firstName,
        daysLeft,
      }),
      text: trialReminderEmailText({
        billingUrl,
        trialEndsAt: access.trialEndsAt,
        firstName,
        daysLeft,
      }),
      idempotencyKey: `trial-reminder-4d:${row.id}:${access.trialEndsAt.slice(0, 10)}`,
      attachments: nuraEmailLogoAttachment(),
    });

    if (!sent.ok) {
      reminderFailures += 1;
      console.error("[billing/trial-reminders] send failed", row.id, sent.error);
      continue;
    }

    await supabase
      .from("nura_profiles")
      .update({ trial_reminder_4d_sent_at: new Date().toISOString() })
      .eq("id", row.id);
    remindersSent += 1;
  }

  // Mark lapsed trials as expired so the lock screen stays accurate.
  const { data: lapsed, error: lapsedError } = await supabase
    .from("nura_profiles")
    .select("id")
    .eq("subscription_status", "trialing")
    .not("trial_ends_at", "is", null)
    .lte("trial_ends_at", reminderWindowStart);

  if (lapsedError) {
    return NextResponse.json({ ok: false, error: lapsedError.message }, { status: 500 });
  }

  let expiredMarked = 0;
  for (const row of lapsed ?? []) {
    const access = await markExpiredSubscriptionIfNeeded(supabase, row.id);
    if (access.status === "expired" && !access.hasPlus) expiredMarked += 1;
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    reminderFailures,
    expiredMarked,
    candidates: reminderCandidates?.length ?? 0,
  });
}

export async function GET(request: NextRequest) {
  return runTrialLifecycle(request);
}

export async function POST(request: NextRequest) {
  return runTrialLifecycle(request);
}
