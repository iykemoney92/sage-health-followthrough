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

/**
 * "block": the message is a crisis statement, so show only the numbers. "alongside": a crisis
 * word in a message that is also about everyday care (a past event, a figure of speech, a song,
 * a reminder), so the plan is shown with the numbers added (25 Nov 2026 eval: the screen missed
 * "i wanna die", "kms" and "I took 30 paracetamol", and blocked "Dad had a heart attack last year").
 */
export type CrisisMode = "block" | "alongside";
export type CrisisScreen = { kind: CrisisKind; mode: CrisisMode };

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
  // Other languages (Spanish, French, Portuguese, German, Italian, Polish, Nigerian Pidgin).
  { re: /\b(quiero morir|me quiero morir|quiero matarme|me voy a matar|suicidarme)/ },
  { re: /\b(je veux mourir|j'ai envie de mourir|envie de mourir|me suicider|me tuer)\b/ },
  { re: /\b(quero morrer|vou me matar|me matar)\b/ },
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
 */
export function screenCrisis(text: string): CrisisScreen | null {
  const raw = normalise(text);
  const t = IDIOMS.reduce((s, re) => s.replace(re, " "), raw);
  // Past events and quotes are judged clause by clause, so "I used to self-harm" in one clause
  // doesn't soften "I want to kill myself" in another. Reminders and idioms soften the message.
  const clauses = t.split(/[.!?;,\n]+|\bbut\b/).filter((c) => c.trim());
  const inContext = (c: string) => (PAST.test(c) && !PRESENT.test(c)) || QUOTE.test(c);
  const blocks = (rules: Rule[], c: string) => rules.some((r) => r.re.test(c) && !(r.soft && r.soft.test(t)));

  const suicideHit = SUICIDE_RULES.some((r) => r.re.test(t));
  const emergencyHit = EMERGENCY_RULES.some((r) => r.re.test(t)) || isOverdoseCount(t);
  if (clauses.some((c) => blocks(SUICIDE_RULES, c) && !inContext(c))) return { kind: "suicide", mode: "block" };
  if (clauses.some((c) => (blocks(EMERGENCY_RULES, c) || isOverdoseCount(c)) && !(PAST.test(c) && !PRESENT.test(c)))) {
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
};

const ELSEWHERE = "If you're somewhere else, call your local emergency number (911 in the US and Canada, 112 in most of Europe).";

function elsewhere(country: CrisisCountry) {
  return `If you're not in ${CRISIS_LINES[country].name}, call your local emergency number.`;
}

/**
 * What to show when try-first text is a crisis or emergency: instead of a plan ("block"), or above
 * the plan when the crisis words may be a past event, an idiom or a reminder ("alongside").
 */
export function crisisGuidance(kind: CrisisKind, country: CrisisCountry | null, mode: CrisisMode = "block"): CrisisGuidance {
  const lines = CRISIS_LINES[country ?? "GB"];
  if (mode === "alongside") return alongsideGuidance(kind, country);
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
    return { kind, mode, title, lead, more, message: [title, lead, ...more].join(" "), country };
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
  return { kind, mode, title, lead, more, message: [title, lead, ...more].join(" "), country };
}

function alongsideGuidance(kind: CrisisKind, country: CrisisCountry | null): CrisisGuidance {
  const lines = CRISIS_LINES[country ?? "GB"];
  const where = country ? "" : "In the UK: ";
  if (kind === "suicide") {
    const title = "If things feel like too much right now";
    const lead = `If you're having thoughts of suicide or self-harm, or you're worried someone is: ${where}${country ? lines.crisis : CRISIS_LINES.GB.crisis}.`;
    const more = [country ? elsewhere(country) : ELSEWHERE];
    return { kind, mode: "alongside", title, lead, more, message: [title, lead, ...more].join(" "), country };
  }
  const title = "If this is happening now";
  const lead = country
    ? `If someone needs help right now, call ${lines.emergency}, or ask someone with you to call.`
    : "If someone needs help right now, call 999 in the UK, or ask someone with you to call.";
  const more = [
    country ? elsewhere(country) : ELSEWHERE,
    ...(country === "GB" || !country ? ["If it isn't an emergency but needs looking at today, call NHS 111 (UK)."] : []),
  ];
  return { kind, mode: "alongside", title, lead, more, message: [title, lead, ...more].join(" "), country };
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
