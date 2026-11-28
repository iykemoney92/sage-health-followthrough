import {
  CRISIS_NUMBERS,
  countryFromPhone,
  crisisCountry,
  crisisGuidance,
  messageLanguage,
  screenCrisis,
  type CrisisCountry,
  type CrisisGuidance,
} from "@/lib/domain/crisis-lines";

/**
 * The try-first crisis screen, run on signed-in chat and WhatsApp before the model (28 Nov 2026
 * eval: these had no code screen, so safety rested on the model's own rule alone).
 *
 * - Suicide "block": the numbers are the whole reply; the model isn't called and nothing changes.
 * - Emergency "block": the numbers come first, then the model's reply (chat has no "It isn't an
 *   emergency" button, so a long-term condition mustn't lock the person out of their own chat).
 * - "alongside" (a past event, a figure of speech, a reminder): the model's reply, then the lines.
 * The numbers are skipped only when the model's reply already gives them.
 */

/** Time zones that tell us the country well enough for crisis numbers when there's no phone. */
const ZONE_COUNTRY: Array<[RegExp, CrisisCountry]> = [
  [/^Europe\/(London|Belfast|Guernsey|Jersey|Isle_of_Man)$/, "GB"],
  [/^Europe\/Dublin$/, "IE"],
  [/^Australia\//, "AU"],
  [/^Africa\/Lagos$/, "NG"],
  [/^Europe\/(Madrid)$|^Atlantic\/Canary$/, "ES"],
  [/^Europe\/Lisbon$/, "PT"],
  [/^Europe\/Paris$/, "FR"],
  [/^Asia\/(Kolkata|Calcutta)$/, "IN"],
  [/^Asia\/(Jakarta|Makassar|Jayapura|Pontianak)$/, "ID"],
  [/^America\/Sao_Paulo$/, "BR"],
  [/^America\/Mexico_City$/, "MX"],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)$|^Pacific\/Honolulu$/, "US"],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina)$/, "CA"],
];

/** Country for the numbers: the phone's country code, then the time zone, else unknown. */
export function chatCrisisCountry(phone: string | null | undefined, timeZone: string | null | undefined): CrisisCountry | null {
  const fromPhone = crisisCountry(countryFromPhone(phone)?.iso2);
  if (fromPhone) return fromPhone;
  const zone = (timeZone ?? "").trim();
  return ZONE_COUNTRY.find(([re]) => re.test(zone))?.[1] ?? null;
}

export type ChatCrisis = { guidance: CrisisGuidance; modelSkipped: boolean };

/** The screen's verdict on a chat message, with the card to show, or null. No model call. */
export function screenChatMessage(
  content: string,
  phone: string | null | undefined,
  timeZone: string | null | undefined,
): ChatCrisis | null {
  const screen = screenCrisis(content);
  if (!screen) return null;
  const lang = messageLanguage(content, null, screen.lang);
  const guidance = crisisGuidance(screen.kind, chatCrisisCountry(phone, timeZone), screen.mode, lang);
  return { guidance, modelSkipped: screen.kind === "suicide" && screen.mode === "block" };
}

/** "116 123" also matches "116123" and "116-123", never inside a longer number. */
function numberPattern(n: string) {
  const d = n.replace(/\D/g, "");
  return new RegExp(`(^|[^\\d])${d.split("").join("[\\s-]?")}($|[^\\d])`);
}

/** The reply already gives a number to call (or "your local emergency number"). */
export function replyHasHelp(reply: string, country: CrisisCountry | null): boolean {
  if (/findahelpline|local emergency number/i.test(reply)) return true;
  const entry = country ? CRISIS_NUMBERS[country] : null;
  const numbers = entry ? [...entry.emergency, ...(entry.line ? [entry.line.number] : [])] : ["999", "911", "112", "116 123", "988"];
  return numbers.some((n) => numberPattern(n).test(reply));
}

/** The card as one chat message: title, lead and the extra lines, one paragraph each. */
export function crisisChatText(guidance: CrisisGuidance): string {
  return [guidance.title, guidance.lead, ...guidance.more].join("\n\n");
}

/** The model's reply with the numbers added where the screen asks for them. */
export function withCrisisLines(reply: string, crisis: ChatCrisis | null): string {
  if (!crisis) return reply;
  const { guidance } = crisis;
  if (replyHasHelp(reply, guidance.country)) return reply;
  if (guidance.mode === "block") return `${crisisChatText(guidance)}\n\n${reply}`;
  return `${reply}\n\n${guidance.lead}`;
}
