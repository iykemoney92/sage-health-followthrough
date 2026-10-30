/**
 * The one Zapx opt-out list (~/zapx-optout): a Resend topic on the Zapx Resend account. Resend drops any
 * send that names the topic for anyone who opted out, from any Zapx product. Nura's own Resend account
 * can't see the topic, so reminders that carry it go out with RESEND_OPTOUT_API_KEY, a sending key on
 * the Zapx account. Sign-in, password and missed-call emails never carry it, so those always arrive.
 */
export const OPTOUT_TOPIC_ID = "eee99e60-b9bc-4fdc-95d1-2f937a2ad8b2";

const UNSUBSCRIBE_MAILTO = "<mailto:hi@zapxlabs.com?subject=unsubscribe>";

/** Same token as the zapx-optout Worker's mintToken: AES-GCM over "email|product", keyed by SHA-256 of the secret. */
export async function mintOptOutToken(secret: string, email: string, product = "") {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", enc.encode(secret)),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(`${email.trim().toLowerCase()}|${product}`)),
  );
  return Buffer.concat([iv, ct]).toString("base64url");
}

/** Their own unsubscribe link, or null without OPTOUT_TOKEN_SECRET (replying "stop" still works). */
export async function unsubscribeUrl(email: string) {
  const secret = process.env.OPTOUT_TOKEN_SECRET?.trim();
  if (!secret) return null;
  return `https://unsubscribe.zapxlabs.com/u/${await mintOptOutToken(secret, email, "nura")}`;
}

/** The one-click unsubscribe headers Gmail and Yahoo show as "Unsubscribe". */
export function unsubscribeHeaders(url: string | null): Record<string, string> {
  return url
    ? { "List-Unsubscribe": `<${url}>, ${UNSUBSCRIBE_MAILTO}`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : { "List-Unsubscribe": UNSUBSCRIBE_MAILTO };
}
