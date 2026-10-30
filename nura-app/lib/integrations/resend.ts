import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OPTOUT_TOPIC_ID, unsubscribeHeaders, unsubscribeUrl } from "@/lib/integrations/optout";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  /** Inline CID attachments (e.g. logo). Reference in HTML as cid:contentId */
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentId: string;
  }>;
  /**
   * A reminder rather than an account email: once RESEND_OPTOUT_API_KEY is set it goes through the Zapx
   * opt-out list (lib/integrations/optout.ts), with an unsubscribe link and replies to hi@zapxlabs.com,
   * where a "stop" opts them out.
   */
  optOut?: boolean;
};

/** Where nuraEmailShell's unsubscribe line goes; empty for everything but reminders. */
const UNSUBSCRIBE_SLOT = "<!--unsubscribe-->";

const EMAIL_LOGO_CID = "nura-logo";

let cachedLogoBase64: string | null | undefined;

function getEmailLogoBase64() {
  if (cachedLogoBase64 !== undefined) return cachedLogoBase64;
  try {
    const path = join(process.cwd(), "public", "brand", "nura-email-mark.png");
    cachedLogoBase64 = readFileSync(path).toString("base64");
  } catch {
    cachedLogoBase64 = null;
  }
  return cachedLogoBase64;
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://usenura.app").replace(
    /\/$/,
    "",
  );
}

/** Absolute logo URL as a fallback when CID embedding isn’t available. */
export function emailLogoSrc() {
  return `${appUrl()}/brand/nura-email-mark.png`;
}

export function getAuthEmailFrom() {
  return process.env.AUTH_EMAIL_FROM || "Nura <hello@usenura.app>";
}

export async function sendAuthEmail({ to, subject, html, text, idempotencyKey, attachments, optOut }: SendEmailInput) {
  const optOutKey = optOut ? process.env.RESEND_OPTOUT_API_KEY?.trim() : undefined;
  const apiKey = optOutKey || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "RESEND_API_KEY is not configured." };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const payload: Record<string, unknown> = {
    from: getAuthEmailFrom(),
    to: [to],
    subject,
    html: html.replace(UNSUBSCRIBE_SLOT, ""),
    text,
  };

  if (optOutKey) {
    const url = await unsubscribeUrl(to);
    payload.from = process.env.OPTOUT_EMAIL_FROM || "Nura <nura@send.zapxlabs.com>";
    payload.reply_to = "hi@zapxlabs.com";
    payload.topic_id = OPTOUT_TOPIC_ID;
    payload.headers = unsubscribeHeaders(url);
    payload.html = html.replace(
      UNSUBSCRIBE_SLOT,
      `<br/>Don’t want these emails? ${
        url ? `<a href="${url}" style="color:#2f6847;">Unsubscribe</a> or reply “stop”.` : "Reply “stop”."
      }`,
    );
    payload.text = `${text}Don’t want these emails? ${url ? `Unsubscribe: ${url} (or reply “stop”).` : "Reply “stop”."}\n`;
  }

  if (attachments?.length) {
    payload.attachments = attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
      content_id: file.contentId,
      content_type: "image/png",
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok) {
    return {
      ok: false as const,
      error: body?.message || `Resend failed with status ${res.status}`,
    };
  }

  return { ok: true as const, id: body?.id || null };
}

function nuraEmailShell({
  preview,
  eyebrow,
  title,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  preview: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
}) {
  const logoSrc = `cid:${EMAIL_LOGO_CID}`;
  const site = appUrl();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${title}</title>
    <!--[if mso]>
    <style type="text/css">
      body, table, td { font-family: Georgia, serif !important; }
    </style>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;background:#f7f5ef;color:#183129;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
      ${preview}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f5ef;width:100%;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td align="left" style="padding:0 8px 18px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <img
                        src="${logoSrc}"
                        width="44"
                        height="44"
                        alt="Nura"
                        style="display:block;width:44px;height:44px;border:0;border-radius:12px;outline:none;"
                      />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font:700 24px/1 Georgia,'Times New Roman',serif;color:#183129;letter-spacing:-0.02em;">Nura</div>
                      <div style="padding-top:2px;font:500 12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#5f6f68;letter-spacing:0.04em;text-transform:uppercase;">Health follow-through</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#fffcf7;border:1px solid rgba(24,49,41,0.10);border-radius:20px;overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:6px;line-height:6px;font-size:0;background:linear-gradient(90deg,#3f7b57 0%,#2f6847 55%,#edf4eb 100%);background-color:#3f7b57;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:28px 28px 8px;">
                      <div style="font:600 11px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#3f7b57;">${eyebrow}</div>
                      <h1 style="margin:10px 0 0;font:600 26px/1.25 Georgia,'Times New Roman',serif;color:#183129;">${title}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 28px 0;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#5f6f68;">
                      ${bodyHtml}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:26px 28px 8px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#3f7b57" style="border-radius:999px;background:#3f7b57;">
                            <a
                              href="${ctaUrl}"
                              style="display:inline-block;padding:14px 22px;font:700 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;"
                            >${ctaLabel}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 28px 28px;font:400 13px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#7a8781;">
                      ${footerNote}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 12px 0;font:400 12px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#7a8781;">
                Your health context stays private and under your control.<br/>
                <a href="${site}" style="color:#2f6847;text-decoration:none;font-weight:600;">usenura.app</a>${UNSUBSCRIBE_SLOT}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmailHtml({
  resetUrl,
  firstName,
}: {
  resetUrl: string;
  firstName?: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return nuraEmailShell({
    preview: "Choose a new password for your Nura account.",
    eyebrow: "Password reset",
    title: "Choose a new password.",
    bodyHtml: `${greeting}<br/><br/>Use the button below to get back into your Care plans. This link expires soon for your security.`,
    ctaLabel: "Choose a new password",
    ctaUrl: resetUrl,
    footerNote:
      "If you didn’t ask for this, you can ignore this email — your password won’t change.",
  });
}

export function passwordResetEmailText({ resetUrl, firstName }: { resetUrl: string; firstName?: string }) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `Nura — Health follow-through

${greeting}

Choose a new password for your Nura account:
${resetUrl}

If you didn’t ask for this, you can ignore this email — your password won’t change.

usenura.app
`;
}

export function confirmEmailHtml({
  confirmUrl,
  firstName,
}: {
  confirmUrl: string;
  firstName?: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return nuraEmailShell({
    preview: "Confirm your email to finish creating your Nura account.",
    eyebrow: "Confirm email",
    title: "Confirm your email.",
    bodyHtml: `${greeting}<br/><br/>Thanks for joining Nura. Tap the button below to verify your address and start your Care plans.`,
    ctaLabel: "Confirm email",
    ctaUrl: confirmUrl,
    footerNote: "If you didn’t create a Nura account, you can ignore this email.",
  });
}

export function confirmEmailText({ confirmUrl, firstName }: { confirmUrl: string; firstName?: string }) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `Nura — Health follow-through

${greeting}

Confirm your email to finish creating your Nura account:
${confirmUrl}

If you didn’t create a Nura account, you can ignore this email.

usenura.app
`;
}

function formatTrialEndDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function trialReminderEmailHtml({
  billingUrl,
  trialEndsAt,
  firstName,
  daysLeft = 4,
}: {
  billingUrl: string;
  trialEndsAt: string;
  firstName?: string;
  daysLeft?: number;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const endLabel = formatTrialEndDate(trialEndsAt);
  return nuraEmailShell({
    preview: `Your Nura trial ends in ${daysLeft} days — renew to keep Care plans going.`,
    eyebrow: "Trial reminder",
    title: `Your trial ends in ${daysLeft} days.`,
    bodyHtml: `${greeting}<br/><br/>Just a heads-up: your free Nura trial ends on <strong>${endLabel}</strong>. After that, Care plans and check-ins pause until you upgrade to Plus.<br/><br/>You can renew anytime — your health context stays saved.`,
    ctaLabel: "Manage billing",
    ctaUrl: billingUrl,
    footerNote: "If you already upgraded, you can ignore this email.",
  });
}

export function trialReminderEmailText({
  billingUrl,
  trialEndsAt,
  firstName,
  daysLeft = 4,
}: {
  billingUrl: string;
  trialEndsAt: string;
  firstName?: string;
  daysLeft?: number;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const endLabel = formatTrialEndDate(trialEndsAt);
  return `Nura — Health follow-through

${greeting}

Your free Nura trial ends in ${daysLeft} days (${endLabel}).
After that, Care plans and check-ins pause until you upgrade to Plus.

Manage billing:
${billingUrl}

If you already upgraded, you can ignore this email.

usenura.app
`;
}

function formatCheckInWhen(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function checkInReminderEmailHtml({
  workspaceUrl,
  scheduledFor,
  planTitle,
  channel,
  firstName,
  minutesBefore = 60,
  timeZone,
}: {
  workspaceUrl: string;
  scheduledFor: string;
  planTitle: string;
  channel: string;
  firstName?: string;
  minutesBefore?: number;
  timeZone?: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const whenLabel = formatCheckInWhen(scheduledFor, timeZone);
  const channelLabel =
    channel === "voice" ? "a phone call" : channel === "whatsapp" ? "a WhatsApp message" : "an in-app check-in";
  const lead =
    minutesBefore >= 60 && minutesBefore % 60 === 0
      ? `${minutesBefore / 60} hour${minutesBefore === 60 ? "" : "s"}`
      : `${minutesBefore} minutes`;
  return nuraEmailShell({
    preview: `Nura will check in about ${planTitle} in about ${lead}.`,
    eyebrow: "Upcoming check-in",
    title: `Check-in in about ${lead}.`,
    bodyHtml: `${greeting}<br/><br/>Just a heads-up: Nura will reach out about <strong>${planTitle}</strong> around <strong>${whenLabel}</strong> (${channelLabel}).<br/><br/>You can open your Care plan anytime if you want to share an update early.`,
    ctaLabel: "Open Care plan",
    ctaUrl: workspaceUrl,
    footerNote: "If you already completed this check-in, you can ignore this email.",
  });
}

export function checkInReminderEmailText({
  workspaceUrl,
  scheduledFor,
  planTitle,
  channel,
  firstName,
  minutesBefore = 60,
  timeZone,
}: {
  workspaceUrl: string;
  scheduledFor: string;
  planTitle: string;
  channel: string;
  firstName?: string;
  minutesBefore?: number;
  timeZone?: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const whenLabel = formatCheckInWhen(scheduledFor, timeZone);
  const channelLabel =
    channel === "voice" ? "a phone call" : channel === "whatsapp" ? "a WhatsApp message" : "an in-app check-in";
  const lead =
    minutesBefore >= 60 && minutesBefore % 60 === 0
      ? `${minutesBefore / 60} hour${minutesBefore === 60 ? "" : "s"}`
      : `${minutesBefore} minutes`;
  return `Nura — Health follow-through

${greeting}

Just a heads-up: Nura will reach out about ${planTitle} around ${whenLabel} (${channelLabel}) — in about ${lead}.

Open your Care plan:
${workspaceUrl}

If you already completed this check-in, you can ignore this email.

usenura.app
`;
}

export function missedCheckInEmailHtml({
  workspaceUrl,
  planTitle,
  firstName,
  message,
}: {
  workspaceUrl: string;
  planTitle: string;
  firstName?: string;
  message: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return nuraEmailShell({
    preview: `Nura tried to call about ${planTitle} but couldn't reach you.`,
    eyebrow: "Missed check-in call",
    title: "Nura tried to call.",
    bodyHtml: `${greeting}<br/><br/>Nura called about <strong>${planTitle}</strong> but the call didn't go through.<br/><br/>${message}`,
    ctaLabel: "Open Care plan",
    ctaUrl: workspaceUrl,
    footerNote: "You can reply anytime from your Care plan — no need to wait for the next call.",
  });
}

export function missedCheckInEmailText({
  workspaceUrl,
  planTitle,
  firstName,
  message,
}: {
  workspaceUrl: string;
  planTitle: string;
  firstName?: string;
  message: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `Nura — Health follow-through

${greeting}

Nura called about ${planTitle} but the call didn't go through.

${message}

Open your Care plan:
${workspaceUrl}

You can reply anytime from your Care plan — no need to wait for the next call.

usenura.app
`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type CircleEmailBase = {
  /** The watcher's own first name, when known. */
  recipientFirstName?: string;
  /** The person whose Care plan this is. */
  ownerFirstName: string;
  planUrl: string;
  /** One-click page to stop these emails for this plan. */
  stopEmailsUrl: string;
};

export type CircleEmailNote = { body: string; when: string; viaCall: boolean };

function circleFooterHtml(ownerFirstName: string, stopEmailsUrl: string) {
  const name = escapeHtml(ownerFirstName);
  return `You're getting this because ${name} added you to their Care circle in Nura. You can see their plan and check-ins, never their conversations with Nura.<br/><a href="${escapeHtml(stopEmailsUrl)}" style="color:#2f6847;font-weight:600;">Stop these emails</a>`;
}

function circleFooterText(ownerFirstName: string, stopEmailsUrl: string) {
  return `You're getting this because ${ownerFirstName} added you to their Care circle in Nura. You can see their plan and check-ins, never their conversations with Nura.

Stop these emails: ${stopEmailsUrl}`;
}

function notesHtml(ownerFirstName: string, notes: CircleEmailNote[]) {
  if (notes.length === 0) return "";
  const items = notes
    .map(
      (note) =>
        `<div style="margin:10px 0 0;padding:12px 14px;border-left:3px solid #3f7b57;background:#f3f7f1;border-radius:0 10px 10px 0;color:#183129;">&ldquo;${escapeHtml(note.body)}&rdquo;<div style="padding-top:6px;font-size:12px;color:#7a8781;">${escapeHtml(note.when)}${note.viaCall ? " · passed on during a call with Nura" : ""}</div></div>`,
    )
    .join("");
  return `<br/><br/><strong style="color:#183129;">In ${escapeHtml(ownerFirstName)}'s words</strong>${items}`;
}

function notesText(ownerFirstName: string, notes: CircleEmailNote[]) {
  if (notes.length === 0) return "";
  return `\n\nIn ${ownerFirstName}'s words:\n${notes
    .map((note) => `"${note.body}" (${note.when}${note.viaCall ? ", passed on during a call with Nura" : ""})`)
    .join("\n")}`;
}

/** The weekly update Nura writes for a Care circle, plus any notes the owner chose to pass on. */
export function circleUpdateEmailHtml({
  recipientFirstName,
  ownerFirstName,
  planUrl,
  stopEmailsUrl,
  updateBody,
  notes,
}: CircleEmailBase & { updateBody: string; notes: CircleEmailNote[] }) {
  const greeting = recipientFirstName ? `Hi ${escapeHtml(recipientFirstName)},` : "Hi,";
  const name = escapeHtml(ownerFirstName);
  return nuraEmailShell({
    preview: updateBody.slice(0, 120),
    eyebrow: "Care circle update",
    title: `How ${name} is getting on`,
    bodyHtml: `${greeting}<br/><br/>${escapeHtml(updateBody).replace(/\n/g, "<br/>")}${notesHtml(ownerFirstName, notes)}`,
    ctaLabel: `See ${name}'s Care plan`,
    ctaUrl: escapeHtml(planUrl),
    footerNote: circleFooterHtml(ownerFirstName, stopEmailsUrl),
  });
}

export function circleUpdateEmailText({
  recipientFirstName,
  ownerFirstName,
  planUrl,
  stopEmailsUrl,
  updateBody,
  notes,
}: CircleEmailBase & { updateBody: string; notes: CircleEmailNote[] }) {
  const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : "Hi,";
  return `Nura - Care circle update

${greeting}

${updateBody}${notesText(ownerFirstName, notes)}

See ${ownerFirstName}'s Care plan:
${planUrl}

${circleFooterText(ownerFirstName, stopEmailsUrl)}

usenura.app
`;
}

/** "Tell my circle if I miss a check-in" - the email twin of the push and the in-app notice. */
export function circleMissedCheckInEmailHtml({
  recipientFirstName,
  ownerFirstName,
  planUrl,
  stopEmailsUrl,
  alertBody,
}: CircleEmailBase & { alertBody: string }) {
  const greeting = recipientFirstName ? `Hi ${escapeHtml(recipientFirstName)},` : "Hi,";
  const name = escapeHtml(ownerFirstName);
  return nuraEmailShell({
    preview: alertBody.slice(0, 120),
    eyebrow: "Care circle",
    title: `${name} missed a check-in`,
    bodyHtml: `${greeting}<br/><br/>${escapeHtml(alertBody)}`,
    ctaLabel: `See ${name}'s Care plan`,
    ctaUrl: escapeHtml(planUrl),
    footerNote: circleFooterHtml(ownerFirstName, stopEmailsUrl),
  });
}

export function circleMissedCheckInEmailText({
  recipientFirstName,
  ownerFirstName,
  planUrl,
  stopEmailsUrl,
  alertBody,
}: CircleEmailBase & { alertBody: string }) {
  const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : "Hi,";
  return `Nura - Care circle

${greeting}

${alertBody}

See ${ownerFirstName}'s Care plan:
${planUrl}

${circleFooterText(ownerFirstName, stopEmailsUrl)}

usenura.app
`;
}

/** Attach the Nura mark as an inline CID image for branded auth emails. */
export function nuraEmailLogoAttachment() {
  const content = getEmailLogoBase64();
  if (!content) return [];
  return [
    {
      filename: "nura-logo.png",
      content,
      contentId: EMAIL_LOGO_CID,
    },
  ];
}
