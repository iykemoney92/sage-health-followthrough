/**
 * Safety rules shared by the analysis and chat prompts, and the code checks that
 * back them up (22 Nov, from the 20 Nov evals and the 22 Nov QA):
 *
 * - dates: copy them as written, read numeric dates day/month unless the document is
 *   clearly American, and say both readings when it cannot be told;
 * - urgent care: name the number for where the reader is (999 / NHS 111, 911, and
 *   since 22 Nov 112/999 in Ireland, 911 in Canada, 000 in Australia, 112 in Nigeria
 *   and the EU), "your local emergency number" elsewhere, or both when Clariti does
 *   not know;
 * - crisis and scams (22 Nov): crisis numbers for the reader's country first; scam
 *   letters and texts called what they look like, never explained as genuine;
 * - doses from a rough scan: repeat them as printed and send the reader to their copy
 *   and their pharmacist, because an OCR "repair" of 5OOmg to 500mg reads as fact.
 *
 * Pure functions only: lib/ai/clariti-analysis.ts is imported by client components.
 */
import {
  detectDateOrder,
  findAmbiguousDates,
  findUnsupportedDates,
  formatDateReading,
  type ClaritiDateOrder,
} from "@/lib/domain/clariti-dates";

/** Where the reader is, as far as the request can tell. Both fields can be missing. */
export type ClaritiReader = {
  /** ISO 3166 alpha-2 from the edge (Vercel's x-vercel-ip-country), e.g. "GB". */
  country?: string | null;
  /** The browser's first language tag, e.g. "en-GB". A hint, never the region. */
  language?: string | null;
};

export type ClaritiRegion = "uk" | "us" | "other" | "unknown";

const UK_COUNTRIES = new Set(["GB", "UK", "IM", "JE", "GG"]);

/** Reads the reader's country and language from request headers. Nothing is stored. */
export function readerFromHeaders(headers: Headers): ClaritiReader {
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  const language = headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim() ?? "";
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    language: /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) ? language : null,
  };
}

/**
 * Only the connection's country decides the region. Browser language does not:
 * "en-US" is the default on phones all over the world, and choosing 911 for a
 * reader in Manchester because of it is the mistake this exists to stop.
 */
export function readerRegion(reader?: ClaritiReader | null): ClaritiRegion {
  const country = reader?.country?.toUpperCase();
  if (!country) return "unknown";
  if (UK_COUNTRIES.has(country)) return "uk";
  if (country === "US") return "us";
  return "other";
}

function describeReader(reader?: ClaritiReader | null) {
  const country = reader?.country ? `The reader's connection is in country code ${reader.country}` : "The reader's country is not known";
  const language = reader?.language ? `, and their browser language is ${reader.language}` : "";
  return `${country}${language}. Treat this as a hint, not a fact: people travel and use VPNs, and the document outranks it.`;
}

/**
 * Emergency and crisis numbers for the countries Clariti can name with confidence
 * (22 Nov, from the shared safety brief; every number checked against an official
 * source). Anywhere else the model is told to say "your local emergency number"
 * rather than guess one.
 */
type CountryNumbers = { place: string; emergency: string; crisis: string; abuse?: string };

const EU_112 = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const COUNTRY_NUMBERS: Record<string, CountryNumbers> = {
  IE: {
    place: "Ireland",
    emergency: "in Ireland, call 112 or 999 in an emergency. Do not give 911",
    crisis: "in Ireland, Samaritans on 116 123 (free, day or night), or 112 or 999 if they are in immediate danger",
  },
  CA: {
    place: "Canada",
    emergency: "in Canada, call 911 in an emergency. Do not give 999 or 111",
    crisis: "in Canada, call or text 9-8-8 (the Suicide Crisis Helpline), or 911 if they are in immediate danger",
  },
  AU: {
    place: "Australia",
    emergency: "in Australia, call 000 in an emergency. Do not give 999 or 911",
    crisis: "in Australia, Lifeline on 13 11 14, or 000 if they are in immediate danger",
  },
  NG: {
    place: "Nigeria",
    emergency: "in Nigeria, call 112 in an emergency. Do not give 999 or 911",
    crisis: "in Nigeria, call 112 now if they are in danger",
  },
};

const UK_CRISIS = "in the UK, Samaritans on 116 123 (free, day or night), 999 if they are in immediate danger, or NHS 111";
const US_CRISIS = "in the US, call or text 988 (the Suicide & Crisis Lifeline), or 911 if they are in immediate danger";
const UK_ABUSE = "the National Domestic Abuse Helpline on 0808 2000 247 (UK), and Childline on 0800 1111 for anyone under 19 (UK)";
const US_ABUSE = "the National Domestic Violence Hotline on 1-800-799-7233 (US)";

function countryNumbers(reader?: ClaritiReader | null): CountryNumbers | null {
  const country = reader?.country?.toUpperCase();
  if (!country) return null;
  if (COUNTRY_NUMBERS[country]) return COUNTRY_NUMBERS[country];
  if (EU_112.has(country)) {
    return {
      place: `country code ${country}`,
      emergency: `the reader appears to be in country code ${country}, in the EU, so give 112, the emergency number across the EU. Do not give 999 or 911`,
      crisis: `call 112 if they are in immediate danger, or a local crisis line (the reader appears to be in country code ${country})`,
    };
  }
  return null;
}

/** The urgent-care sentence, with the numbers for where the reader is. */
export function urgentCareRule(reader?: ClaritiReader | null) {
  const base = "For urgent symptoms or emergency language, tell the user to seek urgent or emergency care now, and name the number to call: ";
  const known = countryNumbers(reader);
  if (known) return base + known.emergency + ". If the document itself names a number to call, give that number too.";
  switch (readerRegion(reader)) {
    case "uk":
      return base + "in the UK, call 999 in an emergency, or NHS 111 for urgent advice that is not an emergency. Do not give 911. If the document itself names a number to call, give that number too.";
    case "us":
      return base + "in the US, call 911 in an emergency. Do not give 999 or 111. If the document itself names a number to call, give that number too.";
    case "other":
      return (
        base +
        `the reader appears to be in country code ${reader?.country?.toUpperCase()}, so tell them to call their local emergency number. ` +
        "Do not give 999, 111 or 911, which do not work there, and do not name a number for that country unless the document prints it. If the document itself names a number to call, give that number first."
      );
    default:
      return base + "Clariti does not know where the reader is, so give both: in the UK call 999 (or NHS 111 for urgent advice), in the US call 911, or the local emergency number elsewhere. If the document itself names a number to call, give that number first.";
  }
}

/** The numbers a crisis reply gives first, for where the reader is. */
function crisisNumbers(reader?: ClaritiReader | null) {
  const known = countryNumbers(reader);
  if (known) return known.crisis;
  switch (readerRegion(reader)) {
    case "uk":
      return UK_CRISIS;
    case "us":
      return US_CRISIS;
    case "other":
      return `their local emergency number if they are in immediate danger, or a local crisis line (the reader appears to be in country code ${reader?.country?.toUpperCase()}; do not give UK or US numbers, and do not name a number for that country unless the document prints it)`;
    default:
      return `their local emergency number if they are in immediate danger; ${UK_CRISIS}; ${US_CRISIS}`;
  }
}

/** Abuse lines, only where Clariti can name them (UK, US, or both when unknown). */
function abuseNumbers(reader?: ClaritiReader | null) {
  if (countryNumbers(reader)) return "";
  switch (readerRegion(reader)) {
    case "uk":
      return UK_ABUSE;
    case "us":
      return US_ABUSE;
    case "other":
      return "";
    default:
      return `${UK_ABUSE}; ${US_ABUSE}`;
  }
}

/**
 * CRISIS rule (22 Nov Claude Code eval, F4): no prompt said what to do when a reader
 * mentions suicide or an overdose. Kept short and literal for a weaker model.
 */
export function crisisRule(reader?: ClaritiReader | null) {
  const abuse = abuseNumbers(reader);
  return (
    "CRISIS: if the user mentions suicide, self-harm, wanting to die, not seeing the point any more, an overdose, or stockpiling pills, stop the task. " +
    "Reply with warmth in one or two sentences, and give the crisis number first: " +
    crisisNumbers(reader) +
    ". If the document itself prints a crisis or emergency number, give that too. Do not go on to explain the paperwork in that reply unless they ask. " +
    "If the document records a recent overdose or self-harm, give the same numbers first and then explain it gently." +
    (abuse ? ` If they mention abuse or someone hurting them, give ${abuse}.` : "")
  );
}

/**
 * SCAM rule (22 Nov Claude Code eval, F4): fake HMRC refunds and NHS fee texts were
 * being explained as if they were real paperwork.
 */
export const SCAM_RULE =
  "SCAMS: if a letter, text or email shows signs of a scam (a link to click or a number to call to claim a refund or avoid a penalty; " +
  "payment by gift card, crypto or bank transfer; pressure to act within hours; a sender, address or web link that does not match the organisation; " +
  "a request for bank details, passwords, PINs or one-time codes), say plainly at the start that it looks like a scam. " +
  "Do not explain it as if it were genuine and do not repeat its links. Tell the user not to click its links, not to call or text any number in it, " +
  "and not to reply or pay; to check, they should contact the organisation through its official website, or a number from a card, bill or letter they already trust. " +
  "If they already clicked, paid or shared details, tell them to contact their bank straight away.";

function dateOrderSentence(order: ClaritiDateOrder) {
  switch (order) {
    case "mdy":
      return "This document looks American, so read numeric dates as month/day/year (02/12/2026 is 12 February 2026).";
    case "either":
      return "Nothing in this document settles the date order, so when a numeric date could be read both ways (02/12/2026 could be 2 December or 12 February), give both readings and tell the user to check this date.";
    default:
      return "Read numeric dates as day/month/year (02/12/2026 is 2 December 2026), as UK and most non-US paperwork writes them.";
  }
}

/** The date rule for a prompt that has one document in view. */
export function dateRule(order: ClaritiDateOrder, reader?: ClaritiReader | null) {
  return (
    "DATES: copy every date exactly as the document writes it, and never work out, move or invent a date. " +
    "Read numeric dates as day/month/year unless the document is clearly American (a US address or ZIP code, a US insurer, Medicare, dollar amounts, or month/day dates elsewhere in it). " +
    "When a numeric date could be read either way and the document does not settle it, write it as printed, give both readings, and say 'check this date'. " +
    `${dateOrderSentence(order)} ${describeReader(reader)}`
  );
}

export const DOSE_RULE =
  "DOSES FROM A ROUGH SCAN: when the text looks like a poor scan or photo (letters where digits should be, such as 5OOmg or l0mg, or marks like ? or [unclear]), " +
  "repeat each dose exactly as printed, say what it most likely reads as only if that is obvious, and tell the user to check it against their copy or ask their pharmacist. " +
  "Never present a repaired or guessed dose as fact, and never fill in a dose that cannot be read.";

const GARBLED = [
  /\[unclear\]/gi,
  /\?\.?\d|\?\?\s?(?:mg|mcg|ml)\b/gi, // ?.5mg, ??mg
  /\d[oO]+\s?(?:mg|mcg|ml|g)\b/g, // 5OOmg, 2Omg
  /\b[lI|]\d+\s?(?:mg|mcg|ml|g)?\b/g, // l0mg, l2
  /[a-z][01][a-z]/gi, // Medicat1on, Fami1y, Ch0rlton
];

/** True when the text reads like a rough scan or photo: several OCR slips, not one. */
export function looksLikeRoughScan(text: string) {
  let hits = 0;
  for (const pattern of GARBLED) hits += text.match(pattern)?.length ?? 0;
  // HbA1c and the like trip the last pattern once; a rough scan trips it everywhere.
  return hits >= 4;
}

const DOSE = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|micrograms?|ml|units?|g)\b/i;

export function mentionsDose(text: string) {
  return DOSE.test(text);
}

export function mentionsPharmacistCheck(text: string) {
  return /pharmacist|check (?:it |them |this |each dose |every dose )?against your (?:printed )?copy/i.test(text);
}

export const DOSE_CHECK_FLAG = {
  label: "Check doses against your copy",
  detail:
    "Parts of this copy are hard to read, so Clariti may have read a dose or number wrong. Check every dose against your printed copy, or ask your pharmacist, before you take or change anything.",
  severity: "check" as const,
};

export const DATE_CHECK_LABEL = "Check this date";

type Flag = { label: string; detail: string; severity: "info" | "check" | "urgent" };

/** The date-order the checks use for this document and reader. */
export function dateOrderFor(documentText: string, reader?: ClaritiReader | null) {
  return detectDateOrder(documentText, reader?.country ?? null);
}

/**
 * The flags Clariti adds after the model answers, from what code can check:
 * dates Clariti wrote that the document does not hold, numeric dates nobody can
 * read for certain, and doses read off a rough scan.
 */
export function safetyFlagsFor(outputText: string, documentText: string, order: ClaritiDateOrder, existingFlags: Flag[]): Flag[] {
  const added: Flag[] = [];
  const has = (label: string) => existingFlags.some((flag) => flag.label === label);

  const unsupported = findUnsupportedDates(outputText, [documentText], order);
  if (unsupported.length > 0 && !has(DATE_CHECK_LABEL)) {
    added.push({
      label: DATE_CHECK_LABEL,
      detail: `Clariti wrote ${listOf(unsupported)}, but could not find ${unsupported.length === 1 ? "that date" : "those dates"} on your document. Check the date printed on your copy before you rely on it.`,
      severity: "check",
    });
  } else if (order === "either" && !has(DATE_CHECK_LABEL)) {
    const ambiguous = findAmbiguousDates(documentText).slice(0, 2);
    if (ambiguous.length > 0) {
      added.push({
        label: DATE_CHECK_LABEL,
        detail: ambiguous
          .map((date) => `${date.text} could mean ${date.readings.map(formatDateReading).join(" or ")}.`)
          .join(" ") + " Check with whoever sent the letter which one they mean.",
        severity: "check",
      });
    }
  }

  if (looksLikeRoughScan(documentText) && mentionsDose(outputText) && !has(DOSE_CHECK_FLAG.label)) {
    added.push({ ...DOSE_CHECK_FLAG });
  }

  return added;
}

/** A sentence to append to a chat reply that names a date or dose code cannot back. */
export function chatReplySafetyNote(reply: string, sources: string[], documentText: string, order: ClaritiDateOrder) {
  const notes: string[] = [];
  const unsupported = documentText.trim() ? findUnsupportedDates(reply, sources, order) : [];
  if (unsupported.length > 0) {
    notes.push(`Please check ${listOf(unsupported)} against your document: I could not find ${unsupported.length === 1 ? "that date" : "those dates"} written in it.`);
  }
  if (looksLikeRoughScan(documentText) && mentionsDose(reply) && !mentionsPharmacistCheck(reply)) {
    notes.push("This copy is hard to read in places, so check every dose against your printed copy or ask your pharmacist before relying on it.");
  }
  return notes.join(" ");
}

function listOf(values: string[]) {
  const quoted = values.slice(0, 3).map((value) => `"${value}"`);
  if (quoted.length === 1) return quoted[0];
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}
