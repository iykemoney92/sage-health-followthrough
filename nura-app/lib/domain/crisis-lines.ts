import { COUNTRY_CODES } from "@/lib/country-codes";

/**
 * Crisis and emergency numbers by country, and a deterministic screen for crisis and emergency
 * text (22 Nov 2026 eval: try-first turned "I've been saving my tablets" into a Care plan, and
 * unknown US callers were given UK numbers).
 *
 * Numbers checked on official sources on 22 Nov 2026: 988lifeline.org (US 988), 988.ca (Canada
 * 9-8-8, 9-1-1), samaritans.org (UK and Ireland 116 123), lifeline.org.au (13 11 14, 000).
 * Nigeria: 112 national emergency number. Never guess a country from a name.
 */

export type CrisisCountry = "GB" | "IE" | "US" | "CA" | "AU" | "NG";

type CountryLines = {
  name: string;
  /** Spoken/written line for suicidal thoughts or self-harm. */
  crisis: string;
  /** Spoken/written line for a medical emergency. */
  emergency: string;
};

export const CRISIS_LINES: Record<CrisisCountry, CountryLines> = {
  GB: {
    name: "the UK",
    crisis: "Samaritans on 116 123 (free, any time, day or night), or 999 if you're in danger right now or have taken anything",
    emergency: "999",
  },
  IE: {
    name: "Ireland",
    crisis: "Samaritans on 116 123 (free, any time), or 112 or 999 if you're in danger right now or have taken anything",
    emergency: "112 or 999",
  },
  US: {
    name: "the US",
    crisis: "call or text 988 (Suicide & Crisis Lifeline, any time), or 911 if you're in danger right now or have taken anything",
    emergency: "911",
  },
  CA: {
    name: "Canada",
    crisis: "call or text 9-8-8 (any time), or 9-1-1 if you're in danger right now or have taken anything",
    emergency: "9-1-1",
  },
  AU: {
    name: "Australia",
    crisis: "Lifeline on 13 11 14 (any time), or 000 if you're in danger right now or have taken anything",
    emergency: "000",
  },
  NG: {
    name: "Nigeria",
    crisis: "112 if you're in danger right now or have taken anything, and tell someone you trust who can be with you",
    emergency: "112",
  },
};

const SUPPORTED = new Set<string>(Object.keys(CRISIS_LINES));

function asCrisisCountry(iso2: string | null | undefined): CrisisCountry | null {
  const code = (iso2 ?? "").trim().toUpperCase();
  if (code === "UK") return "GB";
  return SUPPORTED.has(code) ? (code as CrisisCountry) : null;
}

const BY_DIAL_CODE_DESC = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);

/**
 * ISO country of a phone number from its country code (digits, with or without "+"), or null
 * when there's no match. +1 numbers are reported as US: the US and Canada share 988 and 911.
 */
export function countryFromPhone(phone: string | null | undefined): { iso2: string; name: string } | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const match = BY_DIAL_CODE_DESC.find((c) => digits.startsWith(c.dialCode));
  if (!match) return null;
  if (match.dialCode === "1") return { iso2: "US", name: "the US or Canada" };
  return { iso2: match.iso2, name: match.name };
}

/** Country from a browser locale's region ("en-GB" → GB), or null when it has none. */
export function countryFromLocale(locale: string | null | undefined): string | null {
  const parts = (locale ?? "").trim().replace(/_/g, "-").split("-");
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p));
  return region ? region.toUpperCase() : null;
}

/** The supported country to use for crisis numbers, or null for "unknown". */
export function crisisCountry(iso2: string | null | undefined): CrisisCountry | null {
  return asCrisisCountry(iso2);
}

export type CrisisKind = "suicide" | "emergency";

const SUICIDE_PATTERNS: RegExp[] = [
  /\bsuicid\w*/,
  /\bkill(ing|ed)? (my|him|her|them)sel(f|ves)\b/,
  /\bend(ing)? (it all|my life|my own life|his life|her life)\b/,
  /\b(want|wants|wanted|wanna|wanting|going|plan|plans|planning) to die\b/,
  /\bwish (i|he|she) (was|were) dead\b/,
  /\bbetter off (dead|without me)\b/,
  /\b(don't|do not|dont|doesn't|does not) want to (be here|be alive|live|wake up|exist|go on)\b/,
  /\bno (reason|point) (to|in) (live|living|being alive|going on)\b/,
  /\bself[- ]?harm\w*/,
  /\b(cut|cutting|hurt|hurting|harm|harming) (my|him|her)self\b/,
  /\b(saving|saved|stockpil\w*|hoard\w*|stash\w*|collecting|storing) (up )?((my|his|her|their|the|some|all) )?(tablets|pills|meds|medications?|medicines?|painkillers|paracetamol|sleeping pills)\b/,
];

const EMERGENCY_PATTERNS: RegExp[] = [
  // chest pain
  /\bchest (pain|pains|pressure|tightness|is tight|feels tight|hurts|is hurting)\b/,
  /\b(pain|pressure|tightness) in (my|his|her|their|the) chest\b/,
  /\bheart attack\b/,
  // stroke signs
  /\b(having|is having|had just had) a stroke\b/,
  /\b(signs|symptoms) of (a )?stroke\b/,
  /\b(think|thinks|worried|scared) (it's|its|it is|he's|she's|i'm|he is|she is|i am) (a |having a )?stroke\b/,
  /\b(face|mouth|smile) (is |has |has gone |went )?(droop\w*|fallen|lopsided)\b/,
  /\bslurr(ed|ing)\b/,
  /\b(arm|leg|side of (my|his|her|their) (face|body)) (is |has |has gone |went )?(weak|numb|dead|floppy)\b/,
  /\b(can't|cannot|can not|couldn't) (lift|raise|move) (my|his|her|their) arm\b/,
  // breathing
  /\b(can't|cannot|can not|couldn't|could not|struggling to|unable to|hardly|barely) breathe?\b/,
  /\b(not|stopped|isn't|is not) breathing\b/,
  /\b(difficulty|trouble|struggling) breathing\b/,
  /\bgasping for (air|breath)\b/,
  /\bchoking\b/,
  // overdose (deliberate wording is caught above as "suicide")
  /\boverdos\w*/,
  /\b(taken|took|swallowed|has had) (too many|a lot of|loads of|all (of )?(my|his|her|their|the)) (tablets|pills|meds|medication|medicine|painkillers|paracetamol)\b/,
  // falls with a head injury, or can't get up
  /\b(hit|banged|bumped|knocked|cracked|struck) (my|his|her|their) head\b/,
  /\bhead (injury|wound)\b/,
  /\b(unconscious|knocked out|unresponsive|won't wake up|not waking up|passed out)\b/,
  /\b(fell|fallen|had a fall|on the floor)\b[^.!?]{0,60}\b(can't|cannot|couldn't|could not) get (back )?up\b/,
];

function normalise(text: string) {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ");
}

/**
 * Deterministic screen for suicidal thoughts, self-harm or stockpiling tablets ("suicide"), and
 * medical emergencies including an overdose ("emergency"). Suicide wins when both match, and its
 * guidance includes the emergency number too.
 */
export function detectCrisis(text: string): CrisisKind | null {
  const t = normalise(text);
  if (SUICIDE_PATTERNS.some((re) => re.test(t))) return "suicide";
  if (EMERGENCY_PATTERNS.some((re) => re.test(t))) return "emergency";
  return null;
}

export type CrisisGuidance = {
  kind: CrisisKind;
  title: string;
  /** The first, most important line: who to call now. */
  lead: string;
  /** Extra lines, shown under the lead. */
  more: string[];
  /** Everything in one plain message (for older clients that only show `message`). */
  message: string;
  country: CrisisCountry | null;
};

const ELSEWHERE = "If you're somewhere else, call your local emergency number (911 in the US and Canada, 112 in most of Europe).";

function elsewhere(country: CrisisCountry) {
  return `If you're not in ${CRISIS_LINES[country].name}, call your local emergency number.`;
}

/** What to show instead of a plan when try-first text is a crisis or emergency. */
export function crisisGuidance(kind: CrisisKind, country: CrisisCountry | null): CrisisGuidance {
  const lines = CRISIS_LINES[country ?? "GB"];
  if (kind === "suicide") {
    const lead = country
      ? `Please reach out right now: ${lines.crisis}.`
      : `Please reach out right now. In the UK: ${CRISIS_LINES.GB.crisis}.`;
    const more = [
      country ? elsewhere(country) : ELSEWHERE,
      "If you've saved up tablets, please put them out of reach or give them to someone, and tell someone you trust how you're feeling.",
      "If this is about someone else, stay with them if you can and call for help now.",
    ];
    const title = "I’m really glad you told me. You don’t have to go through this alone.";
    return { kind, title, lead, more, message: [title, lead, ...more].join(" "), country };
  }
  const lead = country
    ? `Please call ${lines.emergency} right now, or ask someone with you to call.`
    : "Please call 999 right now if you're in the UK, or ask someone with you to call.";
  const more = [
    country ? elsewhere(country) : ELSEWHERE,
    "Nura can’t help with an emergency. Don’t wait to see if it passes.",
    ...(country === "GB" || !country ? ["If it isn't an emergency but needs looking at today, call NHS 111 (UK)."] : []),
  ];
  const title = "This sounds like it needs help now.";
  return { kind, title, lead, more, message: [title, lead, ...more].join(" "), country };
}

/**
 * One line for a voice call's context so the agent gives the caller's own numbers. From the
 * caller's phone country code; when it's unknown, the agent asks where they are.
 */
export function voiceCountryNote(phone: string | null | undefined): string {
  const found = countryFromPhone(phone);
  const supported = crisisCountry(found?.iso2);
  if (found && supported) {
    const lines = CRISIS_LINES[supported];
    return `Caller's country (from their number's country code): ${found.name}. For safety numbers use theirs, not the UK ones: suicidal thoughts or self-harm - ${lines.crisis}; a medical emergency - ${lines.emergency}.`;
  }
  if (found) {
    return `Caller's country (from their number's country code): ${found.name}. The UK numbers in the safety rules don't apply: tell them to call their local emergency number (112 works in most of Europe and many other countries).`;
  }
  return "We don't know which country the caller is in. If a safety number is needed, say \"call your local emergency number now\" (999 in the UK, 911 in the US and Canada), then ask where they are so you can give the right crisis line (UK: Samaritans 116 123; US and Canada: call or text 988).";
}
