import { randomBytes } from "crypto";

const VERIFY_WHATSAPP_MESSAGE = "Hi Nura, I want to continue my check-in.";
const CONTINUE_WHATSAPP_MESSAGE = "Hi Nura, I'm ready to continue.";

export function getNuraWhatsappNumber() {
  return process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") ?? "";
}

export function createWhatsappLinkCode() {
  return `NURA-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function extractWhatsappLinkCode(text: string) {
  return text.match(/\bNURA-[A-F0-9]{8}\b/i)?.[0]?.toUpperCase() ?? null;
}

export function createWhatsappHref(code?: string | null, message?: string | null) {
  const number = getNuraWhatsappNumber();
  if (!number) return null;
  const baseMessage = message || (code ? VERIFY_WHATSAPP_MESSAGE : CONTINUE_WHATSAPP_MESSAGE);
  const text = code ? `${baseMessage}\n\nLink code: ${code}` : baseMessage;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
