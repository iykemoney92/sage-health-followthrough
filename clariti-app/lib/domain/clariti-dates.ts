/**
 * Dates on health paperwork, and the check that Clariti never states one the
 * document does not hold.
 *
 * The 20 Nov evals caught a UK medication review dated "l2/ll/2026" (12 Nov,
 * through a rough scan) coming back titled "11 Dec 2026": the model read a
 * day/month date as month/day. Clariti reads letters from the UK, Europe and the
 * US, so neither order is safe to assume, and a wrong appointment or stop date is
 * a real harm. The prompt now carries a date-order rule; this module is the code
 * backstop that finds the dates Clariti wrote and checks each against the source.
 *
 * Pure functions only: client components import the analysis module that uses it.
 */

/** "dmy" = 02/12/2026 is 2 December; "mdy" = 12 February; "either" = cannot tell. */
export type ClaritiDateOrder = "dmy" | "mdy" | "either";

export type ClaritiDateReading = { year?: number; month: number; day: number };

type FoundDate = {
  /** The text as it appears, for showing back to the reader. */
  text: string;
  /** Every plausible reading. One for "12 Nov 2026", up to two for "02/12/2026". */
  readings: ClaritiDateReading[];
  /** Numeric dates only: the reading the order says is right, when there is one. */
  primary?: ClaritiDateReading;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_NAMES = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const LABELS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Separators must match (12/11/2026, 12.11.2026, 12-11-2026) so "2.5/10" never reads as a date.
const NUMERIC_DATE = /(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\d/-]|\.\d)/g;
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const DAY_MONTH = new RegExp(`(?<![\\w])(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_NAMES})\\.?(?:,?\\s+(\\d{4}))?(?![\\w])`, "gi");
const MONTH_DAY = new RegExp(`(?<![\\w])(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?![\\w])`, "gi");
// A rough scan's date: digits with the letters OCR mistakes for them ("l2/ll/2026").
const SCANNED_DATE = /(?<![\w/.-])([\dlIoO|]{1,2})([/.-])([\dlIoO|]{1,2})\2([\dlIoO|]{4}|\d{2})(?![\w/-]|\.\w)/g;

function fullYear(value: string) {
  const year = Number(value);
  return value.length === 2 ? 2000 + year : year;
}

function valid({ month, day, year }: ClaritiDateReading) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year === undefined) return true;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function numericReadings(first: number, second: number, year: number, order: ClaritiDateOrder) {
  const dmy = { day: first, month: second, year };
  const mdy = { day: second, month: first, year };
  const dmyOk = valid(dmy);
  const mdyOk = valid(mdy);
  const readings = [dmyOk ? dmy : null, mdyOk && (first !== second) ? mdy : null].filter(Boolean) as ClaritiDateReading[];
  // A date that can only be read one way is that date, whatever the order says.
  let primary: ClaritiDateReading | undefined;
  if (dmyOk && !mdyOk) primary = dmy;
  else if (mdyOk && !dmyOk) primary = mdy;
  else if (first === second) primary = dmy;
  else if (order === "dmy") primary = dmy;
  else if (order === "mdy") primary = mdy;
  return { readings, primary };
}

function deScan(value: string) {
  return value.replace(/[lI|]/g, "1").replace(/[oO]/g, "0");
}

/** Every date written in `text`, with every way it could be read. */
export function findDates(text: string, order: ClaritiDateOrder, { scanned = false } = {}): FoundDate[] {
  const found: FoundDate[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (start: number, end: number) => taken.some(([s, e]) => start < e && end > s);
  const add = (start: number, end: number, date: FoundDate) => {
    if (overlaps(start, end) || date.readings.length === 0) return;
    taken.push([start, end]);
    found.push(date);
  };

  for (const match of text.matchAll(ISO_DATE)) {
    const reading = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    if (valid(reading)) add(match.index, match.index + match[0].length, { text: match[0], readings: [reading], primary: reading });
  }
  for (const match of text.matchAll(NUMERIC_DATE)) {
    const { readings, primary } = numericReadings(Number(match[1]), Number(match[3]), fullYear(match[4]), order);
    add(match.index, match.index + match[0].length, { text: match[0], readings, primary });
  }
  if (scanned) {
    for (const match of text.matchAll(SCANNED_DATE)) {
      if (!/[lIoO|]/.test(match[0])) continue;
      const [first, second, year] = [deScan(match[1]), deScan(match[3]), deScan(match[4])];
      if (!/^\d+$/.test(first + second + year)) continue;
      const { readings, primary } = numericReadings(Number(first), Number(second), fullYear(year), order);
      add(match.index, match.index + match[0].length, { text: match[0], readings, primary });
    }
  }
  for (const match of text.matchAll(DAY_MONTH)) {
    const reading = { day: Number(match[1]), month: MONTHS[match[2].toLowerCase().replace(/\.$/, "")], year: match[3] ? Number(match[3]) : undefined };
    if (reading.month && valid(reading)) add(match.index, match.index + match[0].length, { text: match[0], readings: [reading], primary: reading });
  }
  for (const match of text.matchAll(MONTH_DAY)) {
    // "May 5" is a date; "may 2" in "you may 2 tablets" is not worth the false alarm.
    if (match[1].toLowerCase() === "may" && match[1] !== "May") continue;
    const reading = { day: Number(match[2]), month: MONTHS[match[1].toLowerCase().replace(/\.$/, "")], year: match[3] ? Number(match[3]) : undefined };
    if (reading.month && valid(reading)) add(match.index, match.index + match[0].length, { text: match[0], readings: [reading], primary: reading });
  }

  return found;
}

const US_SIGNALS: RegExp[] = [
  /\bexplanation of benefits\b/i,
  /\bmedicare\b|\bmedicaid\b/i,
  /\bco-?pay(?:ment)?\b|\bdeductible\b|\bcoinsurance\b/i,
  /\$\s?\d/,
  /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+\d{5}(?:-\d{4})?\b/,
  /\b(?:cpt|npi|hcpcs)\b/i,
];
const UK_SIGNALS: RegExp[] = [
  /\bnhs\b/i,
  /£\s?\d/,
  /\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b/, // postcode, e.g. M13 9WL
  /\bGP\b|\bgeneral practitioner\b|\bfoundation trust\b|\bpractice nurse\b/i,
  /\b0\d{3,4}\s?\d{3}\s?\d{3,4}\b/, // UK landline, e.g. 0151 706 2000
];

const UK_COUNTRIES = new Set(["GB", "UK", "IM", "JE", "GG"]);

/**
 * Which way round this document writes numeric dates.
 *
 * The document wins over the reader: a US bill read in London is still US paperwork.
 * A date like 25/10/2026 settles it outright. With nothing in the document, a reader
 * in the US makes it a genuine toss-up ("either"); everyone else gets day/month,
 * which is how most of the world, and every NHS letter, writes dates.
 */
export function detectDateOrder(documentText: string, readerCountry?: string | null): ClaritiDateOrder {
  let dmyEvidence = 0;
  let mdyEvidence = 0;
  for (const match of documentText.matchAll(NUMERIC_DATE)) {
    const first = Number(match[1]);
    const second = Number(match[3]);
    if (first > 12 && second <= 12) dmyEvidence += 1;
    if (second > 12 && first <= 12) mdyEvidence += 1;
  }
  if (dmyEvidence > 0 && mdyEvidence === 0) return "dmy";
  if (mdyEvidence > 0 && dmyEvidence === 0) return "mdy";

  const us = US_SIGNALS.filter((pattern) => pattern.test(documentText)).length;
  const uk = UK_SIGNALS.filter((pattern) => pattern.test(documentText)).length;
  if (us > uk) return "mdy";
  if (uk > us) return "dmy";

  const country = readerCountry?.toUpperCase() ?? null;
  if (country === "US") return "either";
  if (country && UK_COUNTRIES.has(country)) return "dmy";
  return "dmy";
}

function sameDay(a: ClaritiDateReading, b: ClaritiDateReading) {
  return a.month === b.month && a.day === b.day && (a.year === undefined || b.year === undefined || a.year === b.year);
}

export function formatDateReading(reading: ClaritiDateReading) {
  return `${reading.day} ${LABELS[reading.month]}${reading.year ? ` ${reading.year}` : ""}`;
}

function squash(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * The dates in `output` that `sources` do not support, read with `order`.
 *
 * Supported means: written the same way in a source, or the same calendar day as
 * the reading of a source date that `order` allows. When the order is "either", both
 * readings of an ambiguous source date are allowed. When it is not, the other reading
 * is allowed only if the output also gives the right one ("2 December or 12
 * February"), because that is the "say both readings" answer the prompt asks for.
 */
export function findUnsupportedDates(output: string, sources: string[], order: ClaritiDateOrder): string[] {
  const sourceText = sources.join("\n");
  if (!sourceText.trim()) return [];
  const sourceFlat = squash(sourceText);
  const sourceDates = findDates(sourceText, order, { scanned: true });
  const allowed: ClaritiDateReading[] = [];
  const alternates: Array<{ alternate: ClaritiDateReading; primary: ClaritiDateReading }> = [];
  for (const date of sourceDates) {
    if (order === "either" || !date.primary) {
      allowed.push(...date.readings);
      continue;
    }
    allowed.push(date.primary);
    for (const reading of date.readings) {
      if (!sameDay(reading, date.primary)) alternates.push({ alternate: reading, primary: date.primary });
    }
  }

  const outputDates = findDates(output, order);
  const flagged: string[] = [];
  for (const date of outputDates) {
    if (sourceFlat.includes(squash(date.text))) continue;
    const readings = date.primary ? [date.primary] : date.readings;
    if (readings.some((reading) => allowed.some((source) => sameDay(reading, source)))) continue;
    const bothGiven = readings.some((reading) =>
      alternates.some(({ alternate, primary }) =>
        sameDay(reading, alternate) && outputDates.some((other) => other !== date && (other.primary ? [other.primary] : other.readings).some((r) => sameDay(r, primary)))));
    if (bothGiven) continue;
    if (!flagged.includes(date.text)) flagged.push(date.text);
  }
  return flagged;
}

/** Numeric source dates that could be read either way, for an order we cannot settle. */
export function findAmbiguousDates(documentText: string): Array<{ text: string; readings: ClaritiDateReading[] }> {
  return findDates(documentText, "either", { scanned: true })
    .filter((date) => date.readings.length > 1)
    .map(({ text, readings }) => ({ text, readings }));
}
