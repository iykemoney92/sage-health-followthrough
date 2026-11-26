import { COUNTRY_CODES } from "@/lib/country-codes";
import { CARD_STRINGS, EN_LABELS, FIND_A_HELPLINE, type CrisisLabels } from "@/lib/domain/crisis-cards-i18n";
import {
  FOREIGN_CARE,
  FOREIGN_CLAUSE_SPLIT,
  FOREIGN_EMERGENCY,
  FOREIGN_EMERGENCY_WEAK,
  FOREIGN_IDIOMS,
  FOREIGN_PAST,
  FOREIGN_PRESENT,
  FOREIGN_QUOTE,
  FOREIGN_SUICIDE,
  FOREIGN_SUICIDE_WEAK,
  foldText,
  type CrisisLang,
  type LangRule,
} from "@/lib/domain/crisis-screen-i18n";

export type { CrisisLang } from "@/lib/domain/crisis-screen-i18n";
export { messageLanguage } from "@/lib/domain/crisis-screen-i18n";

/**
 * Crisis and emergency numbers by country, and a deterministic screen for crisis and emergency
 * text (22 Nov 2026 eval: try-first turned "I've been saving my tablets" into a Care plan, and
 * unknown US callers were given UK numbers).
 *
 * Numbers checked on official sources on 22 Nov 2026: 988lifeline.org (US 988), 988.ca (Canada
 * 9-8-8, 9-1-1), samaritans.org (UK and Ireland 116 123), lifeline.org.au (13 11 14, 000).
 * Nigeria: 112 national emergency number. Never guess a country from a name.
 *
 * 26 Nov 2026 (non-English safety check): the screen and the cards now cover Spanish, Portuguese,
 * French, Indonesian and Arabic, and an unknown or unsupported country gets "your local emergency
 * number" plus findahelpline.com instead of UK numbers. Countries added, each number checked that
 * day on the source next to it (a country is only listed when its numbers were confirmed):
 *
 * | Country   | Crisis line (24h)              | Emergency | Source                                                                 |
 * |-----------|--------------------------------|-----------|------------------------------------------------------------------------|
 * | Brazil    | CVV 188                        | SAMU 192  | cvv.org.br · gov.br/saude/pt-br/composicao/saes/samu-192               |
 * | Mexico    | Línea de la Vida 800 911 2000  | 911       | findahelpline.com/countries/mx · gob.mx/911                            |
 * | Spain     | 024                            | 112       | sanidad.gob.es/linea024/home.htm                                       |
 * | Portugal  | 1411 (SNS 24)                  | 112       | sns24.gov.pt/servico/linha-nacional-de-prevencao-do-suicidio · findahelpline.com/countries/pt |
 * | Argentina | 0800 999 0091                  | 911       | argentina.gob.ar/dispositivo-0800 · findahelpline.com/countries/ar     |
 * | Colombia  | Línea 106                      | 123       | minsalud.gov.co/salud/publica/salud-mental/Paginas/linea-106.aspx · findahelpline.com/countries/co |
 * | Chile     | *4141                          | SAMU 131  | findahelpline.com/countries/cl                                         |
 * | Indonesia | 119 ext. 8                     | 119       | findahelpline.com/countries/id · kemkes.go.id (119)                    |
 * | France    | 3114                           | 112       | 3114.fr · findahelpline.com/countries/fr                               |
 * | India     | Tele MANAS 14416               | 112       | findahelpline.com/countries/in                                         |
 * | Saudi Arabia | none confirmed              | 997       | srca.org.sa/en/contact-us (Red Crescent ambulance)                     |
 * | UAE       | none confirmed                 | 998 / 999 | u.ae handling-emergencies (998 ambulance, 999 police)                  |
 * | Pakistan  | none confirmed (no 24h line)   | 1122      | findahelpline.com/countries/pk                                         |
 *
 * Left out because they could not be confirmed on an official page that day: Egypt (16328, 123),
 * France 15 (SAMU), Indonesia 112 (not yet nationwide), Portugal SNS 24 808 24 24 24 as a crisis line.
 */

export type CrisisCountry =
  | "GB"
  | "IE"
  | "US"
  | "CA"
  | "AU"
  | "NG"
  | "BR"
  | "MX"
  | "ES"
  | "PT"
  | "AR"
  | "CO"
  | "CL"
  | "ID"
  | "FR"
  | "IN"
  | "SA"
  | "AE"
  | "PK";

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
  BR: {
    name: "Brazil",
    crisis: "CVV on 188 (free, any time), or 192 (SAMU ambulance) if you're in danger right now or have taken anything",
    emergency: "192",
  },
  MX: {
    name: "Mexico",
    crisis: "Línea de la Vida on 800 911 2000 (free, any time), or 911 if you're in danger right now or have taken anything",
    emergency: "911",
  },
  ES: {
    name: "Spain",
    crisis: "024 (free, any time), or 112 if you're in danger right now or have taken anything",
    emergency: "112",
  },
  PT: {
    name: "Portugal",
    crisis: "1411 (the SNS 24 suicide prevention line, free, any time), or 112 if you're in danger right now or have taken anything",
    emergency: "112",
  },
  AR: {
    name: "Argentina",
    crisis: "0800 999 0091 (free, any time), or 911 if you're in danger right now or have taken anything",
    emergency: "911",
  },
  CO: {
    name: "Colombia",
    crisis: "Línea 106 (dial 106, free, any time), or 123 if you're in danger right now or have taken anything",
    emergency: "123",
  },
  CL: {
    name: "Chile",
    crisis: "*4141 (free, any time), or 131 (SAMU ambulance) if you're in danger right now or have taken anything",
    emergency: "131",
  },
  ID: {
    name: "Indonesia",
    crisis: "119 extension 8 (free, any time), or 119 if you're in danger right now or have taken anything",
    emergency: "119",
  },
  FR: {
    name: "France",
    crisis: "3114 (free, any time), or 112 if you're in danger right now or have taken anything",
    emergency: "112",
  },
  IN: {
    name: "India",
    crisis: "Tele MANAS on 14416 (free, any time), or 112 if you're in danger right now or have taken anything",
    emergency: "112",
  },
  SA: {
    name: "Saudi Arabia",
    crisis: "997 (ambulance) if you're in danger right now or have taken anything, and tell someone you trust who can be with you",
    emergency: "997",
  },
  AE: {
    name: "the UAE",
    crisis: "998 (ambulance) or 999 (police) if you're in danger right now or have taken anything, and tell someone you trust who can be with you",
    emergency: "998",
  },
  PK: {
    name: "Pakistan",
    crisis: "1122 if you're in danger right now or have taken anything, and tell someone you trust who can be with you",
    emergency: "1122",
  },
};

/** The same numbers as plain data, for the cards in other languages. */
export const CRISIS_NUMBERS: Record<CrisisCountry, { emergency: string[]; line?: { name?: string; number: string } }> = {
  GB: { emergency: ["999"], line: { name: "Samaritans", number: "116 123" } },
  IE: { emergency: ["112", "999"], line: { name: "Samaritans", number: "116 123" } },
  US: { emergency: ["911"], line: { number: "988" } },
  CA: { emergency: ["9-1-1"], line: { number: "9-8-8" } },
  AU: { emergency: ["000"], line: { name: "Lifeline", number: "13 11 14" } },
  NG: { emergency: ["112"] },
  BR: { emergency: ["192"], line: { name: "CVV", number: "188" } },
  MX: { emergency: ["911"], line: { name: "Línea de la Vida", number: "800 911 2000" } },
  ES: { emergency: ["112"], line: { number: "024" } },
  PT: { emergency: ["112"], line: { number: "1411" } },
  AR: { emergency: ["911"], line: { number: "0800 999 0091" } },
  CO: { emergency: ["123"], line: { number: "106" } },
  CL: { emergency: ["131"], line: { number: "*4141" } },
  ID: { emergency: ["119"], line: { number: "119 ext. 8" } },
  FR: { emergency: ["112"], line: { number: "3114" } },
  IN: { emergency: ["112"], line: { name: "Tele MANAS", number: "14416" } },
  SA: { emergency: ["997"] },
  AE: { emergency: ["998", "999"] },
  PK: { emergency: ["1122"] },
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

/**
 * "block": the message is a crisis statement, so show only the numbers. "alongside": a crisis
 * word in a message that is also about everyday care (a past event, a figure of speech, a song,
 * a reminder), so the plan is shown with the numbers added (25 Nov 2026 eval: the screen missed
 * "i wanna die", "kms" and "I took 30 paracetamol", and blocked "Dad had a heart attack last year").
 */
export type CrisisMode = "block" | "alongside";
/** `lang` is set when the wording that matched is Spanish, Portuguese, French, Indonesian or Arabic. */
export type CrisisScreen = { kind: CrisisKind; mode: CrisisMode; lang?: CrisisLang };

type Rule = {
  re: RegExp;
  /** When this also matches, the hit only adds the lines (it never blocks on its own). */
  soft?: RegExp;
};

const PILLS =
  "(tablets?|pills?|meds|medications?|medicines?|painkillers|paracetamol|ibuprofen|aspirin|co-?codamol|codeine|tramadol|insulin|antidepressants|sleeping (pills|tablets)|sleepers)";

/** Taking medicines as prescribed, not an overdose ("took all my pills this morning, remind me"). */
const ADHERENCE =
  /\b(remind\w*|routine|on time|as prescribed|prescribed|every (day|morning|evening|night)|each (day|morning|evening|night)|daily|forget|forgot|forgetting|keep track|schedule|dose times?)\b/;

/** Breathless from stress or effort, not choking or an asthma attack. */
const BREATH_CONTEXT =
  /\b(stress\w*|anxious|anxiety|panic\w*|worr\w*|nervous|when (i|he|she|they) (run|walk|exercise|climb|go up)|on the stairs|stairs|exercis\w*|running|jogging|after (a |my |the )?(run|walk|workout|class)|out of breath|copd|asthma (is|has been) (fine|ok|okay|better))\b/;

/** "Killing myself with these shifts", "killing myself laughing". */
const KILL_IDIOM =
  /\bkill(ing|ed)? (my|him|her|them) ?sel(f|ves) (with|at|over|doing|for|on|trying|working|laughing|to (get|make|finish|keep|pay))\b/;

const SUICIDE_RULES: Rule[] = [
  { re: /\b(suicid\w*|suicde\w*|sucid\w*|sucide\w*|suiside\w*|suisid\w*)/ },
  { re: /\bkill?(ing|ed|s)? (my|him|her|them) ?sel(f|ves)\b/, soft: KILL_IDIOM },
  { re: /\b(kms|unalive\w*|un-alive\w*)\b/ },
  { re: /\bend(ing)? (it all|my life|my own life|his life|her life|it tonight|things tonight)\b/ },
  { re: /\b(want|wants|wanted|wanting|going|plan|plans|planning|ready|trying|deserve) to die\b/ },
  { re: /\b(wanna|gonna|wan|wana) die\b/ },
  { re: /\b(wish|wishing) (i|he|she) (was|were) dead\b/ },
  { re: /\b(i'd|i would|id) rather be dead\b/ },
  { re: /\bbetter off (dead|without me|if i (was|were) gone)\b/ },
  { re: /\b(don't|do not|dont|doesn't|does not|doesnt) want to (be here|be alive|live|wake up|exist|go on)\b/ },
  { re: /\b(want|wish|wishing|hope|hoping)\w* to (go to )?sleep and (never|not) wake up\b/ },
  { re: /\bno (reason|point) (to|in) (live|living|being alive|going on)\b/ },
  { re: /\blife (isn't|is not|isnt|ain't|aint) worth (living|it anymore|it any more)\b/ },
  { re: /\b(not|no longer) worth living\b/ },
  { re: /\b(nobody|no one|noone|no-one) (would|will|'d) (miss|care about|notice) (me|if i)\b/ },
  { re: /\bself[- ]?harm\w*/ },
  { re: /\b(cut|cutting|hurt|hurting|harm|harming|burn|burning) (my|him|her) ?self\b/ },
  { re: /\bhang(ing)? (my|him|her|them) ?sel(f|ves)\b/ },
  { re: /\bnoose\b/ },
  { re: /\b(gas|gassing|drown|drowning) (my|him|her) ?self\b/ },
  {
    re: /\b(jump|jumping|throw (my|him|her) ?self|throwing (my|him|her) ?self) (off|from|in front of)( of)?( a| the)? (bridge|building|roof|cliff|train|car park|multi-storey|balcony|tower|motorway|lorry|bus|block)\b/,
  },
  {
    re: new RegExp(
      `\\b(saving|saved|stockpil\\w*|hoard\\w*|stash\\w*|collecting|storing) (up )?((my|his|her|their|the|some|all) )?${PILLS}\\b`,
    ),
  },
  // About to take a lot at once: "thinking about taking all my tablets tonight".
  {
    re: new RegExp(
      `\\b(thinking (about|of)|going to|gonna|want(s|ed)? to|wanna|planning (to|on)|plan to|about to|might|tempted to|could easily) (take|taking|swallow|swallowing|down|downing) (all|every|the whole|a whole|the rest|loads|lots|a load|a bunch|a handful|handfuls|\\d+)\\b[^.!?]{0,40}\\b${PILLS}\\b`,
    ),
    soft: ADHERENCE,
  },
  // German, Italian, Polish, Nigerian Pidgin. Spanish, Portuguese, French, Indonesian and Arabic
  // are in crisis-screen-i18n.ts, with their own idiom, past-event and emergency wording.
  { re: /\b(ich will sterben|ich möchte sterben|mich umbringen|will nicht mehr leben)/ },
  { re: /\b(voglio morire|uccidermi)\b/ },
  { re: /\b(chcę umrzeć|chce umrzec|chcę się zabić|chce sie zabic)/ },
  { re: /\b(i wan die|make i die|i go kill myself)\b/ },
];

/** Suicide wording that may be distress rather than a plan: adds the lines next to a plan. */
const SUICIDE_WEAK: RegExp[] = [
  /\b(want|wants|wanted|wanna) to disappear\b/,
  /\b(can't|cannot|cant|can not) go on\b/,
  /\b(can't|cannot|cant) (do|take) (this|it) any ?more\b/,
];

// Amounts only: "too many" and "all my" are in the emergency rules, where a reminder softens them.
const OVERDOSE_WORDS =
  "(\\d+|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|a hundred|a (whole )?(box|packet|pack|bottle|strip|tub) of|(a )?handfuls? of)";

/** "I took 30 paracetamol", "Mum took 20 of her sleeping tablets": six or more at once. */
const OVERDOSE_COUNT = new RegExp(
  `\\b(took|taken|swallowed|downed|has had|have had|had) ${OVERDOSE_WORDS} ?(of )?((my|his|her|their|the|[a-z]+'s) )?([a-z-]+ )?${PILLS}\\b`,
);

function isOverdoseCount(t: string) {
  const m = t.match(OVERDOSE_COUNT);
  if (!m) return false;
  return /^\d+$/.test(m[2]) ? Number(m[2]) >= 6 : true;
}

const EMERGENCY_RULES: Rule[] = [
  // chest pain
  { re: /\bchest (pain|pains|pressure|tightness|is tight|feels tight|hurts|is hurting)\b/ },
  { re: /\b(pain|pressure|tightness) in (my|his|her|their|the) chest\b/ },
  { re: /\b(having|has just had|just had|is having|might be having|could be having) a heart attack\b/ },
  { re: /\bheart attack (right )?now\b/ },
  { re: /\bthink\w* [^.!?]{0,25}\bheart attack\b/ },
  // stroke signs
  { re: /\b(having|is having|had just had|just had) a stroke\b/ },
  { re: /\b(signs|symptoms) of (a )?stroke\b/ },
  { re: /\b(think|thinks|worried|scared) (it's|its|it is|he's|she's|i'm|he is|she is|i am) (a |having a )?stroke\b/ },
  { re: /\b(face|mouth|smile) (is |has |has gone |went )?(droop\w*|fallen|lopsided)\b/ },
  { re: /\bslurr(ed|ing)\b/ },
  { re: /\b(arm|leg|side of (my|his|her|their) (face|body)) (is |has |has gone |went )?(weak|numb|dead|floppy)\b/ },
  { re: /\b(can't|cannot|can not|couldn't) (lift|raise|move) (my|his|her|their) arm\b/ },
  // breathing
  { re: /\b(can't|cannot|can not|cant|couldn't|could not|struggling to|unable to|hardly|barely) breathe?\b/, soft: BREATH_CONTEXT },
  { re: /\b(not|stopped|isn't|is not|isnt) breathing\b/ },
  { re: /\b(difficulty|trouble|struggling) breathing\b/, soft: BREATH_CONTEXT },
  { re: /\bgasping for (air|breath)\b/, soft: BREATH_CONTEXT },
  { re: /\b(lips|face|skin|fingers) (have |has |had |are |is )?(gone|turned|going|turning) (blue|grey|gray)\b/ },
  { re: /\b(is|he's|she's|i'm|im|they're|baby's|baby is|keeps|started) choking\b|\bchoking on\b/ },
  // allergy, bleeding, seizures, collapse
  { re: /\b(throat|tongue|lips?|face|mouth) (is |are |has |have |keeps )?(swelling|swollen|closing)( up)?\b/ },
  { re: /\banaphyla\w*/ },
  { re: /\b(bleeding|bleed) (heavily|a lot|badly|loads|everywhere|profusely)\b/ },
  { re: /\b(won't|will not|wont|can't|cannot|cant) stop (the )?bleeding\b|\bbleeding\b[^.!?]{0,30}\b(won't|will not|wont) stop\b/ },
  { re: /\b(having|is having|in the middle of) a (seizure|fit)\b|\bseizing\b|\b(is|he's|she's|started|keeps) fitting\b|\bconvuls\w*/ },
  { re: /\bcollaps(ed|ing)\b/ },
  // overdose (deliberate wording is caught above as "suicide")
  { re: /\boverdos\w*/ },
  {
    re: new RegExp(
      `\\b(taken|took|swallowed|has had) (too many|a lot of|loads of|all (of )?(my|his|her|their|the)) ${PILLS}\\b`,
    ),
    soft: ADHERENCE,
  },
  // falls with a head injury, or can't get up
  { re: /\b(hit|banged|bumped|knocked|cracked|struck) (my|his|her|their) head\b/ },
  { re: /\bhead (injury|wound)\b/ },
  { re: /\b(unconscious|knocked out|unresponsive|won't wake up|not waking up|can't wake (him|her|them) up)\b/ },
  { re: /\b(fell|fallen|had a fall|on the floor)\b[^.!?]{0,60}\b(can't|cannot|couldn't|could not) get (back )?up\b/ },
];

/** Emergency words that are often not an emergency: add the lines next to a plan. */
const EMERGENCY_WEAK: RegExp[] = [/\bheart attack\b/, /\bchoking\b/, /\bpassed out\b/, /\bseizures?\b/, /\bepi-?pen\b/];

/** Figures of speech removed before screening ("choking up", "nearly had a heart attack"). */
const IDIOMS: RegExp[] = [
  /\bdying (to|for)\b/g,
  /\bchok(e|es|ed|ing) up\b/g,
  /\b(nearly|almost|practically|about to|could have|could've) (had|have|gave me|give me|having) a heart attack\b/g,
  /\b(gave|give|gives|giving) (me|him|her|us) a heart attack\b/g,
  /\bpassed out (on|in) (the |my |his |her )?(sofa|couch|bed|armchair|chair)\b/g,
  /\bpassed out (after|from) (a |my |the )?(long |busy |hard )?(day|shift|night|week)\b/g,
  /\bcollaps(e|ed|ing) (into|onto|on) (the |my |his |her )?(bed|sofa|couch|chair)\b/g,
];

/** A past event, not something happening now ("had a heart attack last year", "used to self-harm"). */
const PAST =
  /\b(last (year|month|week|summer|winter|spring|autumn|fall|christmas|time)|(years?|months?|weeks?|decades?) ago|a (while|long time|few (years|months|weeks)) (ago|back)|used to|back in|in (19|20)\d\d|in the past|history of|since (his|her|my|their) (stroke|heart attack|op|operation|surgery|fall)|since (he|she|they) (died|passed)|recover(ed|ing|y)|after (his|her|my|their) (stroke|heart attack)|doing (much |a lot )?better)\b/;
/** ...unless it's also happening now. */
const PRESENT = /\b(right now|at the moment|tonight|again|just now|currently|happening|this (morning|afternoon|evening))\b/;

/** A song, film or book title or quote, not the person's own words. */
const QUOTE = /\b(song|songs|lyrics?|film|movie|book|novel|track|album|sings?|singing|title|quote|tv show|series|episode|poem)\b/;

/** Words that show the message is also about everyday care: a plan can go next to the lines. */
const CARE_CONTENT =
  /\b(mum|mom|mother|dad|father|parents?|gran|granny|grandma|grandad|grandpa|nan|nana|partner|wife|husband|son|daughter|kids?|children|friend|brother|sister|family|routines?|habits?|walk\w*|exercis\w*|physio\w*|sleep\w*|stress\w*|work|job|shifts?|study\w*|exams?|remind\w*|check[- ]?ins?|checking in|lonely|loneliness|grief|grieving|energy|eat|eating|meals?|water|tablets?|pills?|medication|routine|evenings?|mornings?|plan)\b/;

function normalise(text: string) {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ");
}

/**
 * Deterministic screen for suicidal thoughts, self-harm or stockpiling tablets ("suicide"), and
 * medical emergencies including an overdose ("emergency"), with the mode to show them in. Suicide
 * wins when both match, and its guidance includes the emergency number too.
 *
 * Fail safe (25 Nov 2026): a crisis word that might be a past event, a figure of speech, a quote
 * or a medication reminder never blocks the plan; it adds the numbers next to it. A message that
 * is only a crisis statement (nothing else about everyday care) always gets the numbers alone.
 *
 * 26 Nov 2026: the same rules run a second time on Spanish, Portuguese, French, Indonesian and
 * Arabic wording (crisis-screen-i18n.ts); the stronger of the two results wins.
 */
export function screenCrisis(text: string): CrisisScreen | null {
  const english = screenEnglish(text);
  const foreign = screenForeign(text);
  return rank(foreign) > rank(english) ? foreign : english;
}

/** Suicide block 4, emergency block 3, suicide alongside 2, emergency alongside 1, nothing 0. */
function rank(screen: CrisisScreen | null) {
  if (!screen) return 0;
  return (screen.mode === "block" ? 2 : 0) + (screen.kind === "suicide" ? 2 : 1);
}

/**
 * A clause about a past event, in English or one of the other screened languages ("last year",
 * "el año pasado", "tahun lalu"), unless it also says it is happening now.
 */
function pastEvent(clause: string) {
  if (PAST.test(clause) && !PRESENT.test(clause)) return true;
  const folded = foldText(clause);
  return FOREIGN_PAST.test(folded) && !FOREIGN_PRESENT.test(folded);
}

/** A song, film or book title or quote, in any screened language. */
function quoted(clause: string) {
  return QUOTE.test(clause) || FOREIGN_QUOTE.test(foldText(clause));
}

function screenEnglish(text: string): CrisisScreen | null {
  const raw = normalise(text);
  const t = IDIOMS.reduce((s, re) => s.replace(re, " "), raw);
  // Past events and quotes are judged clause by clause, so "I used to self-harm" in one clause
  // doesn't soften "I want to kill myself" in another. Reminders and idioms soften the message.
  const clauses = t.split(/[.!?;,\n]+|\bbut\b/).filter((c) => c.trim());
  const inContext = (c: string) => pastEvent(c) || quoted(c);
  const blocks = (rules: Rule[], c: string) => rules.some((r) => r.re.test(c) && !(r.soft && r.soft.test(t)));

  const suicideHit = SUICIDE_RULES.some((r) => r.re.test(t));
  const emergencyHit = EMERGENCY_RULES.some((r) => r.re.test(t)) || isOverdoseCount(t);
  if (clauses.some((c) => blocks(SUICIDE_RULES, c) && !inContext(c))) return { kind: "suicide", mode: "block" };
  if (clauses.some((c) => (blocks(EMERGENCY_RULES, c) || isOverdoseCount(c)) && !pastEvent(c))) {
    return { kind: "emergency", mode: "block" };
  }
  // A crisis phrase in context (a past event, an idiom, a quote, a reminder): the plan plus the lines.
  if (suicideHit) return { kind: "suicide", mode: "alongside" };
  if (emergencyHit) return { kind: "emergency", mode: "alongside" };

  const weak: CrisisKind | null = SUICIDE_WEAK.some((re) => re.test(t))
    ? "suicide"
    : EMERGENCY_WEAK.some((re) => re.test(t))
      ? "emergency"
      : null;
  if (!weak) return null;
  // Nothing else to make a plan from: the crisis words are the message.
  return { kind: weak, mode: CARE_CONTENT.test(t) ? "alongside" : "block" };
}

/** "suicidio", "suicídio", "suicide": the word itself in any Latin-script spelling. */
const SUICIDE_WORD = /\bsuicid/;

/** The same screen for Spanish, Portuguese, French, Indonesian and Arabic wording, on folded text. */
function screenForeign(text: string): CrisisScreen | null {
  const t = FOREIGN_IDIOMS.reduce((s, re) => s.replace(re, " "), foldText(text));
  const clauses = t.split(FOREIGN_CLAUSE_SPLIT).filter((c) => c && c.trim());
  const past = pastEvent;
  const inContext = (c: string) => pastEvent(c) || quoted(c);
  const hit = (rules: LangRule[]) => rules.find((r) => r.re.test(t));
  const blocking = (rules: LangRule[], keep: (c: string) => boolean) => {
    for (const c of clauses) {
      const rule = rules.find((r) => r.re.test(c) && !(r.soft && r.soft.test(t)));
      if (rule && keep(c)) return rule;
    }
    // A phrase that runs across a comma ("dormir, y no despertar") still counts.
    return clauses.length > 1 ? undefined : rules.find((r) => r.re.test(t) && !(r.soft && r.soft.test(t)) && keep(t));
  };

  const suicideBlock = blocking(FOREIGN_SUICIDE, (c) => !inContext(c));
  if (suicideBlock) return { kind: "suicide", mode: "block", lang: suicideBlock.lang };
  if (clauses.some((c) => SUICIDE_WORD.test(c) && !inContext(c))) return { kind: "suicide", mode: "block" };
  const emergencyBlock = blocking(FOREIGN_EMERGENCY, (c) => !past(c));
  if (emergencyBlock) return { kind: "emergency", mode: "block", lang: emergencyBlock.lang };

  const suicideHit = hit(FOREIGN_SUICIDE);
  if (suicideHit) return { kind: "suicide", mode: "alongside", lang: suicideHit.lang };
  if (SUICIDE_WORD.test(t)) return { kind: "suicide", mode: "alongside" };
  const emergencyHit = hit(FOREIGN_EMERGENCY);
  if (emergencyHit) return { kind: "emergency", mode: "alongside", lang: emergencyHit.lang };

  const weakSuicide = hit(FOREIGN_SUICIDE_WEAK);
  const weak = weakSuicide ?? hit(FOREIGN_EMERGENCY_WEAK);
  if (!weak) return null;
  // Nothing else to make a plan from: the crisis words are the message.
  return { kind: weakSuicide ? "suicide" : "emergency", mode: FOREIGN_CARE.test(t) ? "alongside" : "block", lang: weak.lang };
}

/** The kind of crisis or emergency in the text (blocking or not), or null. */
export function detectCrisis(text: string): CrisisKind | null {
  return screenCrisis(text)?.kind ?? null;
}

export type CrisisGuidance = {
  kind: CrisisKind;
  /** "block": shown instead of a plan. "alongside": shown above the plan. */
  mode: CrisisMode;
  title: string;
  /** The first, most important line: who to call now. */
  lead: string;
  /** Extra lines, shown under the lead. */
  more: string[];
  /** Everything in one plain message (for older clients that only show `message`). */
  message: string;
  country: CrisisCountry | null;
  /** The language the card is written in, its direction, and its fixed words. */
  lang: CrisisLang;
  dir: "ltr" | "rtl";
  labels: CrisisLabels;
};

type CardText = { title: string; lead: string; more: string[] };

function elsewhere(country: CrisisCountry) {
  return `If you're not in ${CRISIS_LINES[country].name}, call your local emergency number.`;
}

const NHS_111 = "If it isn't an emergency but needs looking at today, call NHS 111 (UK).";
const TABLETS = "If you've saved up tablets, please put them out of reach or give them to someone, and tell someone you trust how you're feeling.";
const SOMEONE_ELSE = "If this is about someone else, stay with them if you can and call for help now.";
const CANT_HELP = "Nura can’t help with an emergency. Don’t wait to see if it passes.";
/**
 * Country unknown or not supported: "your local emergency number" and findahelpline.com lead, never
 * UK numbers (26 Nov 2026: a visitor in Brazil or Indonesia was told to call Samaritans and 999).
 * These follow, as examples only, for English readers whose country we couldn't tell.
 */
const EN_EXAMPLE_LINES = "In the UK and Ireland, Samaritans are on 116 123; in the US and Canada, call or text 988.";
const EN_EXAMPLE_EMERGENCY = "It's 999 in the UK, 911 in the US and Canada, and 112 in most of Europe.";

function englishCard(kind: CrisisKind, country: CrisisCountry | null, mode: CrisisMode): CardText {
  const lines = country ? CRISIS_LINES[country] : null;
  if (mode === "alongside") {
    if (kind === "suicide") {
      return {
        title: "If things feel like too much right now",
        lead: lines
          ? `If you're having thoughts of suicide or self-harm, or you're worried someone is: ${lines.crisis}.`
          : `If you're having thoughts of suicide or self-harm, or you're worried someone is: call your local emergency number if there's any danger, and find a free helpline for your country at ${FIND_A_HELPLINE}.`,
        more: [country ? elsewhere(country) : EN_EXAMPLE_LINES],
      };
    }
    return {
      title: "If this is happening now",
      lead: lines
        ? `If someone needs help right now, call ${lines.emergency}, or ask someone with you to call.`
        : "If someone needs help right now, call your local emergency number, or ask someone with you to call.",
      more: [country ? elsewhere(country) : EN_EXAMPLE_EMERGENCY, ...(country === "GB" ? [NHS_111] : [])],
    };
  }
  if (kind === "suicide") {
    return {
      title: "I’m really glad you told me. You don’t have to go through this alone.",
      lead: lines
        ? `Please reach out right now: ${lines.crisis}.`
        : `Please reach out right now: call your local emergency number if you're in danger or have taken anything, and find a free helpline for your country at ${FIND_A_HELPLINE}.`,
      more: [country ? elsewhere(country) : EN_EXAMPLE_LINES, TABLETS, SOMEONE_ELSE],
    };
  }
  return {
    title: "This sounds like it needs help now.",
    lead: lines
      ? `Please call ${lines.emergency} right now, or ask someone with you to call.`
      : "Please call your local emergency number right now, or ask someone with you to call.",
    more: [country ? elsewhere(country) : EN_EXAMPLE_EMERGENCY, CANT_HELP, ...(country === "GB" ? [NHS_111] : [])],
  };
}

function translatedCard(kind: CrisisKind, country: CrisisCountry | null, mode: CrisisMode, lang: Exclude<CrisisLang, "en">): CardText {
  const s = CARD_STRINGS[lang];
  const numbers = country ? CRISIS_NUMBERS[country] : null;
  const emergency = numbers ? numbers.emergency.join(s.or) : null;
  const call = numbers?.line ? s.callLine(numbers.line.name, numbers.line.number) : null;
  const travelling = country ? [s.elsewhere] : [];
  if (mode === "alongside") {
    return kind === "suicide"
      ? { title: s.alongside.suicideTitle, lead: s.alongside.suicideLead(call, emergency), more: travelling }
      : { title: s.alongside.emergencyTitle, lead: s.alongside.emergencyLead(emergency), more: travelling };
  }
  return kind === "suicide"
    ? { title: s.suicide.title, lead: s.suicide.lead(call, emergency), more: [...travelling, s.suicide.tablets, s.suicide.someoneElse] }
    : { title: s.emergency.title, lead: s.emergency.lead(emergency), more: [...travelling, s.emergency.cantHelp] };
}

/**
 * What to show when try-first text is a crisis or emergency: instead of a plan ("block"), or above
 * the plan when the crisis words may be a past event, an idiom or a reminder ("alongside").
 * Written in `lang` (the message's language, see `messageLanguage`). A null country never gets
 * another country's numbers as the instruction.
 */
export function crisisGuidance(
  kind: CrisisKind,
  country: CrisisCountry | null,
  mode: CrisisMode = "block",
  lang: CrisisLang = "en",
): CrisisGuidance {
  const card = lang === "en" ? englishCard(kind, country, mode) : translatedCard(kind, country, mode, lang);
  return {
    kind,
    mode,
    ...card,
    message: [card.title, card.lead, ...card.more].join(" "),
    country,
    lang,
    dir: lang === "en" ? "ltr" : CARD_STRINGS[lang].dir,
    labels: lang === "en" ? EN_LABELS : CARD_STRINGS[lang].labels,
  };
}

/**
 * One quiet line for under a nudge ("write a little more", "tell me who to check in on"), so a
 * message the screen and the gate could not read never leaves someone with nothing to call.
 */
export function tryFirstHelpLine(lang: CrisisLang, country: CrisisCountry | null): string {
  if (lang !== "en") {
    const s = CARD_STRINGS[lang];
    return s.help(country ? CRISIS_NUMBERS[country].emergency.join(s.or) : null);
  }
  return `If you or someone else is in danger or thinking about suicide, call ${country ? CRISIS_LINES[country].emergency : "your local emergency number"} now, or find a free helpline for your country at ${FIND_A_HELPLINE}.`;
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
