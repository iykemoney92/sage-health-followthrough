/** Default when we don't know the user yet (server-safe). */
export const DEFAULT_TIME_ZONE = "UTC";

const IANA_TZ_RE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/;

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const tz = value.trim();
  if (!IANA_TZ_RE.test(tz) && tz !== "UTC") return false;
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: string | null | undefined, fallback = DEFAULT_TIME_ZONE) {
  return isValidTimeZone(value) ? value.trim() : fallback;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Offset of `timeZone` at `date`, in milliseconds (positive east of UTC). */
export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const tz = normalizeTimeZone(timeZone);
  const parts = getZonedParts(date, tz);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock datetime in the user's timezone to a UTC ISO string.
 * Accepts `2026-08-07T12:30:00`, `2026-08-07 12:30`, or full ISO with/without offset.
 *
 * Explicit numeric offsets (+01:00 / -05:00) are trusted as absolute instants.
 * Trailing Z is NOT trusted when the user is outside UTC — voice/chat agents often
 * stamp the user's local clock as Z by mistake; we reinterpret the face in their TZ.
 */
export function wallTimeInTimeZoneToUtcIso(input: string, timeZone: string): string {
  const raw = input.trim();
  if (!raw) return new Date().toISOString();

  const tz = normalizeTimeZone(timeZone);

  // Explicit numeric offset — trust the absolute instant.
  if (/[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  // Zulu: only treat as absolute UTC when the user is actually on UTC.
  if (/[zZ]$/.test(raw) && tz === "UTC") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return new Date().toISOString();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  // Interpret the wall time as if it were UTC, then subtract the zone offset at that guess.
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), tz);
    const next = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
    if (next === utcGuess) break;
    utcGuess = next;
  }
  return new Date(utcGuess).toISOString();
}

export function formatInTimeZone(
  isoOrDate: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    ...options,
    timeZone: normalizeTimeZone(timeZone),
  });
}

/** Human-readable "now" line for LLM scheduling prompts. */
export function describeNowForTimeZone(timeZone: string, now = new Date()) {
  const tz = normalizeTimeZone(timeZone);
  const local = formatInTimeZone(now, tz, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  return {
    timeZone: tz,
    utcIso: now.toISOString(),
    localLabel: local,
  };
}

/**
 * Best-effort guess from an E.164 phone (digits only). Used only as a backfill
 * until the browser reports the real IANA zone.
 */
export function guessTimeZoneFromPhoneDigits(phoneDigits: string | null | undefined): string | null {
  const phone = (phoneDigits || "").replace(/[^\d]/g, "");
  if (!phone) return null;
  if (phone.startsWith("44")) return "Europe/London";
  if (phone.startsWith("1")) return "America/New_York";
  if (phone.startsWith("234")) return "Africa/Lagos";
  if (phone.startsWith("91")) return "Asia/Kolkata";
  if (phone.startsWith("61")) return "Australia/Sydney";
  if (phone.startsWith("353")) return "Europe/Dublin";
  if (phone.startsWith("49")) return "Europe/Berlin";
  if (phone.startsWith("33")) return "Europe/Paris";
  return null;
}
