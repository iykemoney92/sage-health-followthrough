type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

function claritiAppUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  const vercel = (process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://clariti-health-followthrough.vercel.app";
}

/** Shown as the From display name in inboxes — "Clariti <address>". */
export function getAuthEmailFrom() {
  return process.env.AUTH_EMAIL_FROM || "Clariti <hello@usenura.app>";
}

export async function sendAuthEmail({ to, subject, html, text, idempotencyKey }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "RESEND_API_KEY is not configured." };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: getAuthEmailFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
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

function claritiEmailShell({
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
  const site = claritiAppUrl();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f8f7;font-family:Georgia,'Times New Roman',serif;color:#21332f;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe8e4;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <div style="width:40px;height:40px;border-radius:12px;background:#4d8d83;color:#fff;font:bold 20px Georgia,serif;text-align:center;line-height:40px;">C</div>
                <p style="margin:18px 0 0;font:800 10px/1.2 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#718f87;">${eyebrow}</p>
                <h1 style="margin:10px 0 0;font:500 30px/1.15 Georgia,'Times New Roman',serif;letter-spacing:-0.03em;color:#21332f;">${title}</h1>
                <p style="margin:16px 0 0;font:400 14px/1.6 Inter,Arial,sans-serif;color:#5d706a;">${bodyHtml}</p>
                <p style="margin:28px 0 0;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#4d8d83;color:#ffffff;text-decoration:none;font:800 13px/1 Inter,Arial,sans-serif;padding:14px 18px;border-radius:12px;">${ctaLabel}</a>
                </p>
                <p style="margin:22px 0 0;font:400 12px/1.55 Inter,Arial,sans-serif;color:#8a9692;">${footerNote}</p>
                <p style="margin:18px 0 0;font:400 11px/1.5 Inter,Arial,sans-serif;color:#9aa5a1;word-break:break-all;">Or open this link:<br/><a href="${ctaUrl}" style="color:#2f6e66;">${ctaUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px;border-top:1px solid #edf1ef;">
                <p style="margin:0;font:400 11px/1.5 Inter,Arial,sans-serif;color:#9aa5a1;">Clariti · <a href="${site}" style="color:#2f6e66;text-decoration:none;">${site.replace(/^https?:\/\//, "")}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function confirmEmailHtml({
  confirmUrl,
  firstName,
}: {
  confirmUrl: string;
  firstName?: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return claritiEmailShell({
    preview: "Confirm your email to finish creating your Clariti account.",
    eyebrow: "Confirm email",
    title: "Confirm your email.",
    bodyHtml: `${greeting}<br/><br/>Thanks for joining Clariti. Tap the button below to verify your address so we can keep your health documents and explanations secure.`,
    ctaLabel: "Confirm email",
    ctaUrl: confirmUrl,
    footerNote: "If you didn’t create a Clariti account, you can ignore this email.",
  });
}

export function confirmEmailText({ confirmUrl, firstName }: { confirmUrl: string; firstName?: string }) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const site = claritiAppUrl();
  return `Clariti — Health document clarity

${greeting}

Confirm your email to finish creating your Clariti account:
${confirmUrl}

If you didn’t create a Clariti account, you can ignore this email.

${site.replace(/^https?:\/\//, "")}
`;
}
