import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  circleMissedCheckInEmailHtml,
  circleMissedCheckInEmailText,
  circleUpdateEmailHtml,
  circleUpdateEmailText,
  nuraEmailLogoAttachment,
  sendAuthEmail,
  type CircleEmailNote,
} from "@/lib/integrations/resend";
import type { CircleNote } from "@/lib/care-circle-notes";

/**
 * Care circle email. Every function here runs with the service role (the weekly job and the
 * alert sweep have no session), so who gets an email is decided by the membership rows alone:
 * active, and email_updates still on.
 */

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://usenura.app").replace(/\/$/, "");
}

function tokenSecret() {
  return process.env.CIRCLE_EMAIL_SECRET || process.env.AGENT_TOOL_SECRET || "";
}

function sign(payload: string) {
  return createHmac("sha256", tokenSecret()).update(`circle-email:${payload}`).digest("base64url");
}

/**
 * A token naming one watcher on one plan, for the "Stop these emails" link. It only ever
 * switches email off for that pair, so it carries no expiry: an old email should still work.
 */
export function createStopEmailsToken(planId: string, memberId: string) {
  const payload = Buffer.from(`${planId}.${memberId}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readStopEmailsToken(token: string): { planId: string; memberId: string } | null {
  if (!tokenSecret()) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  const [planId, memberId] = Buffer.from(payload, "base64url").toString("utf8").split(".");
  if (!planId || !memberId) return null;
  return { planId, memberId };
}

type Recipient = { memberId: string; email: string; firstName?: string };

/** Watchers on a plan who still want email, with the address and name to write to. */
export async function listEmailRecipients(admin: SupabaseClient, planId: string): Promise<Recipient[]> {
  const { data: members } = await admin
    .from("nura_plan_members")
    .select("member_id")
    .eq("plan_id", planId)
    .is("revoked_at", null)
    .eq("email_updates", true);
  if (!members || members.length === 0) return [];

  const ids = members.map((m) => m.member_id as string);
  const { data: profiles } = await admin.from("nura_profiles").select("id, display_name").in("id", ids);
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, ((p.display_name as string | null) ?? "").trim().split(/\s+/)[0]]));

  const recipients: Recipient[] = [];
  for (const memberId of ids) {
    const { data } = await admin.auth.admin.getUserById(memberId).catch(() => ({ data: null }));
    const email = data?.user?.email;
    if (!email) continue;
    recipients.push({ memberId, email, firstName: nameById.get(memberId) || undefined });
  }
  return recipients;
}

function noteWhen(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function toEmailNotes(notes: CircleNote[]): CircleEmailNote[] {
  return notes.map((note) => ({ body: note.body, when: noteWhen(note.createdAt), viaCall: note.source === "voice_call" }));
}

async function sendToEach(
  admin: SupabaseClient,
  planId: string,
  idempotencyKey: string,
  build: (recipient: Recipient, links: { planUrl: string; stopEmailsUrl: string }) => { subject: string; html: string; text: string },
) {
  if (!process.env.RESEND_API_KEY) return { emailed: 0, failed: 0, skipped: "not_configured" as const };
  const recipients = await listEmailRecipients(admin, planId);
  const planUrl = `${appUrl()}/plans/${planId}`;
  let emailed = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const stopEmailsUrl = `${appUrl()}/circle/emails/${createStopEmailsToken(planId, recipient.memberId)}`;
    const message = build(recipient, { planUrl, stopEmailsUrl });
    const sent = await sendAuthEmail({
      to: recipient.email,
      ...message,
      idempotencyKey: `${idempotencyKey}:${recipient.memberId}`,
      attachments: nuraEmailLogoAttachment(),
    });
    if (sent.ok) emailed += 1;
    else {
      failed += 1;
      console.error("[circle-email] send failed", planId, sent.error);
    }
  }
  return { emailed, failed };
}

export async function emailCircleUpdate(
  admin: SupabaseClient,
  input: { planId: string; updateId: string; ownerFirstName: string; updateBody: string; notes: CircleNote[] },
) {
  const notes = toEmailNotes(input.notes);
  return sendToEach(admin, input.planId, `circle-update:${input.updateId}`, (recipient, links) => {
    const args = { recipientFirstName: recipient.firstName, ownerFirstName: input.ownerFirstName, ...links, updateBody: input.updateBody, notes };
    return {
      subject: `How ${input.ownerFirstName} is getting on this week`,
      html: circleUpdateEmailHtml(args),
      text: circleUpdateEmailText(args),
    };
  });
}

export async function emailCircleMissedCheckIn(
  admin: SupabaseClient,
  input: { planId: string; checkInId: string; ownerFirstName: string; alertBody: string },
) {
  return sendToEach(admin, input.planId, `circle-alert:${input.checkInId}`, (recipient, links) => {
    const args = { recipientFirstName: recipient.firstName, ownerFirstName: input.ownerFirstName, ...links, alertBody: input.alertBody };
    return {
      subject: `${input.ownerFirstName} missed a check-in`,
      html: circleMissedCheckInEmailHtml(args),
      text: circleMissedCheckInEmailText(args),
    };
  });
}
