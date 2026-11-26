/**
 * The scam message and call checker at /tools/is-this-a-scam. Pure functions only: everything
 * runs in the visitor's browser, there are no network or AI calls, and nothing is stored.
 *
 * It looks for well-documented warning signs (pressure, unusual ways to pay, "Hi Mum, new
 * number", parcel fees, account-suspended and verify messages, prizes and refunds, passcode
 * requests, remote-access apps, lookalike or shortened links, odd sender addresses) and adds the
 * person's own answers to a few quick questions. It never says a message is safe: the best it
 * can say is that no common warning signs were found.
 */

export type Answer = "yes" | "no" | "unsure";

export type ClaimId =
  | "none"
  | "bank"
  | "tax"
  | "police"
  | "delivery"
  | "family"
  | "tech"
  | "other";

export type ScamAnswers = {
  /** Did they contact you out of the blue? */
  unexpected: Answer;
  /** Do they want money, gift cards, crypto, bank details or a code? */
  money: Answer;
  /** Is there pressure to act now, or to keep it secret? */
  pressure: Answer;
  /** Who they say they are. */
  claim: ClaimId;
  /** Is there a link to tap, or a number to call back? */
  linkOrNumber: Answer;
};

export const EMPTY_ANSWERS: ScamAnswers = {
  unexpected: "unsure",
  money: "unsure",
  pressure: "unsure",
  claim: "none",
  linkOrNumber: "unsure",
};

export const CLAIMS: { id: ClaimId; label: string }[] = [
  { id: "none", label: "No one in particular / not sure" },
  { id: "bank", label: "A bank or building society" },
  { id: "tax", label: "HMRC, the IRS or another government body" },
  { id: "police", label: "The police or a fraud team" },
  { id: "delivery", label: "A delivery firm (Royal Mail, Evri, DPD, USPS…)" },
  { id: "family", label: "A family member or friend on a new number" },
  { id: "tech", label: "Tech support (Microsoft, Apple, BT, Amazon…)" },
  { id: "other", label: "Another company or organisation" },
];

export type FlagId =
  | "passcode"
  | "remote-access"
  | "new-number"
  | "payment-method"
  | "parcel-fee"
  | "account-alert"
  | "prize-refund"
  | "urgency"
  | "secrecy"
  | "lookalike-link"
  | "short-link"
  | "odd-sender"
  | "authority"
  | "generic-greeting"
  | "link"
  | "call-back-number"
  | "answer-unexpected"
  | "answer-money"
  | "answer-pressure"
  | "answer-claim"
  | "answer-link";

export type ScamFlag = {
  id: FlagId;
  /** Short heading, e.g. "Asks for a one-time passcode". */
  label: string;
  /** Why it matters, in plain words. */
  why: string;
  weight: number;
  /** The phrases in the pasted text that triggered it (empty for answers). */
  phrases: string[];
};

export type Span = { start: number; end: number; flag: FlagId };

export type ScamLevel = "strong" | "some" | "none";

export type ScamResult = {
  level: ScamLevel;
  heading: string;
  summary: string;
  score: number;
  flags: ScamFlag[];
  /** Non-overlapping character ranges of the pasted text to highlight, in order. */
  spans: Span[];
};

export const LEVEL_HEADINGS: Record<ScamLevel, string> = {
  strong: "Strong signs of a scam",
  some: "Some warning signs",
  none: "No common warning signs found, but stay careful",
};

const STRONG_AT = 6;
const SOME_AT = 2;

type TextRule = {
  id: FlagId;
  label: string;
  why: string;
  weight: number;
  patterns: RegExp[];
  /** Only counts when one of these also matches somewhere in the text. */
  needs?: RegExp[];
};

const TEXT_RULES: TextRule[] = [
  {
    id: "passcode",
    label: "Asks for a code or PIN",
    why: "Banks, the police and real companies never ask you to read out or forward a one-time passcode or PIN. Whoever has the code can get into your account.",
    weight: 5,
    patterns: [
      /\bone[- ]?time (?:pass)?(?:code|password)\b/gi,
      /\bverification code\b/gi,
      /\bsecurity code\b/gi,
      /\b(?:6|six)[- ]digit code\b/gi,
      /\bOTP\b/g,
      /\bpasscode\b/gi,
      /\b(?:send|tell|give|read|forward|share)(?: me| us)?(?: back)?(?: the| that| your)? (?:code|pin)\b/gi,
      /\b(?:code|text) (?:we|that we|i|that i) (?:just )?sent\b/gi,
      /\byour pin\b/gi,
    ],
  },
  {
    id: "remote-access",
    label: "Wants access to your phone or computer",
    why: "Scammers ask you to install an app such as AnyDesk or TeamViewer so they can see your screen and your bank.",
    weight: 5,
    patterns: [
      /\b(?:any ?desk|team ?viewer|quick ?support|quick ?assist|ultra ?viewer|logmein|rust ?desk|supremo)\b/gi,
      /\bremote (?:access|control|desktop|support)\b/gi,
      /\bscreen ?shar(?:e|ing)\b/gi,
      /\b(?:download|install) (?:this|the|an|our) app\b/gi,
    ],
  },
  {
    id: "new-number",
    label: "\"Hi Mum/Dad, new number\"",
    why: "A message from a family member on a new number, soon asking for money, is one of the most common scams. Call them on the number you already have.",
    weight: 4,
    patterns: [
      /\b(?:hi|hello|hey|hiya)[ ,]+(?:mum|mom|mam|mummy|mommy|dad|daddy|nan|nana|gran|grandma|grandpa)\b/gi,
      /\bnew (?:phone )?number\b/gi,
      /\b(?:lost|broke|dropped|smashed) my phone\b/gi,
      /\bmy phone (?:is|got) (?:broken|lost|stolen)\b/gi,
      /\bsave (?:this|my) (?:new )?number\b/gi,
      /\bdelete (?:my )?old number\b/gi,
    ],
  },
  {
    id: "payment-method",
    label: "Asks you to pay in an unusual way",
    why: "Gift cards, vouchers, crypto, money transfer services and moving money to a \"safe account\" are favoured by scammers because the money is hard to get back.",
    weight: 4,
    patterns: [
      /\b(?:gift|itunes|apple|google play|steam|amazon|ebay|vanilla) ?(?:gift )?(?:card|voucher)s?\b/gi,
      /\bbitcoin\b/gi,
      /\bcrypto(?:currency)?\b/gi,
      /\b(?:usdt|tether|ethereum)\b/gi,
      /\bwestern union\b/gi,
      /\bmoney ?gram\b/gi,
      /\bwire (?:transfer|the money)\b/gi,
      /\bsafe account\b/gi,
      /\b(?:bank )?transfer (?:the |some )?money\b/gi,
      /\bsend (?:me |us )?(?:the )?money\b/gi,
      /\b(?:pay|send) (?:it )?by bank transfer\b/gi,
      /\bsort code\b/gi,
      /\b(?:account|card) (?:number|details)\b/gi,
    ],
  },
  {
    id: "parcel-fee",
    label: "Parcel or redelivery fee",
    why: "Fake delivery messages ask for a small fee to \"redeliver\" a parcel. The real aim is your card details.",
    weight: 3,
    patterns: [
      /\b(?:redeliver(?:y)?|re-deliver(?:y)?|reschedule (?:your |the )?delivery)\b/gi,
      /\b(?:unpaid|outstanding|small|shipping|customs|delivery|postage|handling) (?:fee|charge|duty)s?\b/gi,
      /\b(?:missed|failed|unsuccessful|attempted) delivery\b/gi,
      /\b(?:could not|couldn't|cannot|can't|was unable to) be delivered\b/gi,
      /\b(?:parcel|package) (?:is )?(?:on hold|held|waiting|pending)\b/gi,
    ],
    needs: [/\b(?:parcel|package|delivery|deliver|courier|royal ?mail|evri|hermes|dpd|dhl|fedex|ups|usps|yodel|post ?office)\b/i],
  },
  {
    id: "account-alert",
    label: "Says your account has a problem",
    why: "\"Your account is suspended\" or \"verify your details\" messages try to scare you into tapping a link or giving your details.",
    weight: 3,
    patterns: [
      /\b(?:account|card|access|payment) (?:has been |is |was |will be )?(?:suspended|locked|blocked|frozen|compromised|restricted|disabled|deactivated|on hold)\b/gi,
      /\b(?:verify|confirm|update|validate|re-?activate) (?:your )?(?:account|identity|details|information|payment|card|bank)\b/gi,
      /\b(?:unusual|suspicious|unauthori[sz]ed|fraudulent) (?:activity|payment|transaction|login|sign[- ]in|purchase)s?\b/gi,
      /\bnew payee\b/gi,
      /\bdirect debit (?:has )?(?:failed|was declined)\b/gi,
    ],
  },
  {
    id: "prize-refund",
    label: "A prize, refund or money you're owed",
    why: "Unexpected winnings, tax rebates and refunds are bait. Real refunds don't need you to tap a link and enter card details.",
    weight: 3,
    patterns: [
      /\byou(?:'ve| have)? (?:been )?(?:won|selected|chosen)\b/gi,
      /\bcongratulations\b/gi,
      /\b(?:prize|lottery|jackpot|winner|reward)s?\b/gi,
      /\bclaim (?:your|the|now)\b/gi,
      /\b(?:tax )?(?:refund|rebate)s?\b/gi,
      /\b(?:you are|you're) (?:owed|due|entitled)\b/gi,
      /\bcompensation\b/gi,
      /\bfree gift\b/gi,
    ],
  },
  {
    id: "urgency",
    label: "Pressure to act now",
    why: "Scammers rush you so you don't stop to check. A real organisation will give you time.",
    weight: 2,
    patterns: [
      /\burgent(?:ly)?\b/gi,
      /\bimmediately\b/gi,
      /\bact now\b/gi,
      /\bright (?:away|now)\b/gi,
      /\bas soon as possible\b/gi,
      /\basap\b/gi,
      /\bwithin (?:the next )?\d+ ?(?:hours?|hrs?|minutes?|mins?|days?)\b/gi,
      /\b(?:final|last) (?:notice|warning|reminder|chance)\b/gi,
      /\b(?:expires?|expiring) (?:today|tonight|soon)\b/gi,
      /\btoday only\b/gi,
      /\bor (?:your|you will|you'll)\b[^.!?\n]{0,40}\b(?:closed|cancelled|suspended|arrested|fined|lose)\b/gi,
      /\barrest(?:ed)?\b/gi,
    ],
  },
  {
    id: "secrecy",
    label: "Asks you to keep it secret",
    why: "Being told not to tell your family, or not to tell the bank why you're moving money, is a classic sign of a scam.",
    weight: 3,
    patterns: [
      /\b(?:don't|do not|dont) tell (?:anyone|anybody|your|the bank|family|dad|mum|mom)\b/gi,
      /\bkeep (?:this|it) (?:between us|secret|quiet|to yourself)\b/gi,
      /\b(?:don't|do not) (?:discuss|mention) (?:this|it)\b/gi,
    ],
  },
  {
    id: "authority",
    label: "Claims to be from an official body or big company",
    why: "Scammers pretend to be a bank, HMRC, the IRS, the police or a well-known company. Contact them yourself on a number you know is real.",
    weight: 1,
    patterns: [
      /\b(?:HMRC|IRS|DVLA|DWP|HM Revenue|Inland Revenue|Social Security|Medicare|National Crime Agency|[Ff]raud (?:[Tt]eam|[Dd]epartment)|[Pp]olice|Metropolitan Police|FBI|TV Licen[cs]ing|Microsoft|Apple Support|Amazon|PayPal|Netflix|BT|Royal Mail|Evri|DPD|DHL|USPS|FedEx|Barclays|HSBC|Lloyds|NatWest|Santander|Halifax|Nationwide|Monzo|Chase|Bank of America|Wells Fargo)\b/g,
    ],
  },
  {
    id: "generic-greeting",
    label: "Doesn't use your name",
    why: "\"Dear customer\" or \"Dear user\" suggests the message went out to many people at once.",
    weight: 1,
    patterns: [/\bdear (?:customer|client|user|member|sir\/madam|sir or madam|valued customer|account holder)\b/gi, /\bvalued customer\b/gi],
  },
];

const SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
  "tiny.cc",
  "rebrand.ly",
  "t.ly",
  "s.id",
  "buff.ly",
  "v.gd",
];

/** Brands scammers imitate, with the domains they really use. */
const BRANDS: { name: RegExp; official: string[] }[] = [
  { name: /royal-?mail/, official: ["royalmail.com", "royalmail.co.uk"] },
  { name: /hmrc|gov-?uk|govuk/, official: ["gov.uk"] },
  { name: /\birs\b|irs-|-irs/, official: ["irs.gov"] },
  { name: /evri|hermes/, official: ["evri.com"] },
  { name: /\bdpd/, official: ["dpd.co.uk", "dpd.com"] },
  { name: /\bdhl/, official: ["dhl.com", "dhl.co.uk"] },
  { name: /usps/, official: ["usps.com"] },
  { name: /fedex/, official: ["fedex.com"] },
  { name: /paypa[l1]/, official: ["paypal.com", "paypal.co.uk"] },
  { name: /amaz[o0]n/, official: ["amazon.co.uk", "amazon.com"] },
  { name: /app[l1]e|icloud/, official: ["apple.com", "icloud.com"] },
  { name: /micr[o0]s[o0]ft|outlook|office365/, official: ["microsoft.com", "live.com", "outlook.com", "office.com"] },
  { name: /netfl[i1]x/, official: ["netflix.com"] },
  { name: /barclays/, official: ["barclays.co.uk", "barclays.com"] },
  { name: /hsbc/, official: ["hsbc.co.uk", "hsbc.com"] },
  { name: /lloyds/, official: ["lloydsbank.com", "lloydsbank.co.uk"] },
  { name: /natwest/, official: ["natwest.com"] },
  { name: /santander/, official: ["santander.co.uk", "santander.com"] },
  { name: /halifax/, official: ["halifax.co.uk"] },
  { name: /nationwide/, official: ["nationwide.co.uk"] },
  { name: /dvla/, official: ["gov.uk"] },
  { name: /tv-?licen[cs]/, official: ["tvlicensing.co.uk"] },
  { name: /\bnhs/, official: ["nhs.uk", "nhs.net"] },
];

const RISKY_TLDS = [
  "top",
  "xyz",
  "icu",
  "click",
  "live",
  "buzz",
  "rest",
  "cfd",
  "sbs",
  "vip",
  "cyou",
  "monster",
  "info",
  "online",
  "site",
  "help",
  "support",
  "loan",
  "win",
  "bond",
  "zip",
];

const FREE_MAIL = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "yahoo.com", "yahoo.co.uk", "aol.com", "icloud.com", "proton.me", "protonmail.com", "gmx.com", "mail.com"];

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b(?:[a-z0-9-]+\.)+(?:[a-z]{2,24})\/[^\s<>"')]*/gi;
const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,24})\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const CALL_WORDS = /\b(?:call|ring|phone|contact|dial|whatsapp)\b/i;

function hostOf(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#:]/)[0] ?? "";
  return s.replace(/\.+$/, "");
}

function isOfficial(host: string, official: string[]) {
  return official.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Why a link looks wrong, or null. Exported for tests. */
export function linkConcern(raw: string): "short-link" | "lookalike-link" | null {
  const host = hostOf(raw);
  if (!host) return null;
  if (SHORTENERS.includes(host)) return "short-link";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "lookalike-link";
  if (host.startsWith("xn--") || host.includes(".xn--")) return "lookalike-link";
  for (const brand of BRANDS) {
    if (brand.name.test(host) && !isOfficial(host, brand.official)) return "lookalike-link";
  }
  const tld = host.split(".").pop() ?? "";
  if (RISKY_TLDS.includes(tld)) return "lookalike-link";
  return null;
}

type Hit = { flag: FlagId; start: number; end: number; text: string };

function collect(text: string, pattern: RegExp, flag: FlagId, out: Hit[]) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const m of text.matchAll(re)) {
    if (m.index === undefined || !m[0]) continue;
    out.push({ flag, start: m.index, end: m.index + m[0].length, text: m[0] });
  }
}

const RULE_TEXT: Partial<Record<FlagId, { label: string; why: string; weight: number }>> = {
  "lookalike-link": {
    label: "A link that doesn't look official",
    why: "The web address imitates a real company, uses an unusual ending, or hides where it goes. Don't tap it; go to the company's website or app yourself.",
    weight: 3,
  },
  "short-link": {
    label: "A shortened link",
    why: "Short links (bit.ly, tinyurl and the like) hide the real address. Real banks and delivery firms rarely use them.",
    weight: 3,
  },
  "odd-sender": {
    label: "An odd sender address",
    why: "The email address doesn't match the organisation it claims to be from, or it's a free personal address.",
    weight: 2,
  },
  link: {
    label: "Contains a link",
    why: "A link on its own isn't proof of a scam, but it's how most scams start. If in doubt, don't tap it.",
    weight: 1,
  },
  "call-back-number": {
    label: "Gives a number to call",
    why: "Scammers give their own number. Call the organisation on a number you find yourself, such as the one on your card or a letter.",
    weight: 1,
  },
};

const ANSWER_RULES: Record<
  "unexpected" | "money" | "pressure" | "linkOrNumber",
  { id: FlagId; label: string; why: string; weight: number }
> = {
  unexpected: {
    id: "answer-unexpected",
    label: "They contacted you out of the blue",
    why: "Most scams start with a message or call you weren't expecting.",
    weight: 1,
  },
  money: {
    id: "answer-money",
    label: "They want money, payment or details",
    why: "Being asked for money, gift cards, crypto, bank details or a code is the point where a scam costs you.",
    weight: 3,
  },
  pressure: {
    id: "answer-pressure",
    label: "You're being rushed or told to keep it quiet",
    why: "Pressure and secrecy stop you from checking with someone. Take your time.",
    weight: 2,
  },
  linkOrNumber: {
    id: "answer-link",
    label: "There's a link to tap or a number to call",
    why: "Use contact details you find yourself instead of the ones in the message.",
    weight: 1,
  },
};

function claimRule(claim: ClaimId) {
  if (claim === "none") return null;
  if (claim === "family")
    return {
      id: "answer-claim" as const,
      label: "Says they're family on a new number",
      why: "Call your relative on the number you already have, or ask a question only they would know.",
      weight: 3,
    };
  return {
    id: "answer-claim" as const,
    label: "Says they're from an organisation you'd trust",
    why: "Anyone can say they're from a bank, HMRC, the IRS, the police or a big company. Hang up and contact them yourself.",
    weight: 2,
  };
}

/** Merge overlapping hits into ordered, non-overlapping spans (earlier and longer wins). */
function toSpans(hits: Hit[]): Span[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end);
  const spans: Span[] = [];
  for (const hit of sorted) {
    const last = spans[spans.length - 1];
    if (last && hit.start < last.end) {
      if (hit.end > last.end) last.end = hit.end;
      continue;
    }
    spans.push({ start: hit.start, end: hit.end, flag: hit.flag });
  }
  return spans;
}

function uniquePhrases(hits: Hit[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hit of hits) {
    const key = hit.text.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit.text.trim());
  }
  return out.slice(0, 6);
}

const MAX_TEXT = 5000;

/**
 * Check a pasted message (and/or the answers to the quick questions). Returns the warning signs
 * found and a level. Never returns a "safe" verdict.
 */
export function checkMessage(input: string, answers: Partial<ScamAnswers> = {}): ScamResult {
  const text = (input ?? "").slice(0, MAX_TEXT);
  const hits: Hit[] = [];

  for (const rule of TEXT_RULES) {
    if (rule.needs && !rule.needs.some((re) => re.test(text))) continue;
    for (const pattern of rule.patterns) collect(text, pattern, rule.id, hits);
  }

  // Links: every link is noted; ones that look wrong get their own flag.
  for (const m of text.matchAll(new RegExp(URL_PATTERN.source, "gi"))) {
    if (m.index === undefined) continue;
    const raw = m[0].replace(/[.,;:!?]+$/, "");
    // Skip the domain part of an email address.
    if (m.index > 0 && text[m.index - 1] === "@") continue;
    const concern = linkConcern(raw);
    hits.push({ flag: concern ?? "link", start: m.index, end: m.index + raw.length, text: raw });
  }

  // Sender addresses: a brand name on a free or lookalike domain.
  const mentionsBrand = TEXT_RULES.find((r) => r.id === "authority")!.patterns.some((p) =>
    new RegExp(p.source, p.flags.replace("g", "")).test(text),
  );
  for (const m of text.matchAll(new RegExp(EMAIL_PATTERN.source, "gi"))) {
    if (m.index === undefined) continue;
    const domain = (m[1] ?? "").toLowerCase();
    const lookalike = linkConcern(domain) === "lookalike-link";
    const freeMailBrand = FREE_MAIL.includes(domain) && mentionsBrand;
    if (lookalike || freeMailBrand) {
      hits.push({ flag: "odd-sender", start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }

  // A phone number alongside "call/ring/contact".
  if (CALL_WORDS.test(text)) {
    for (const m of text.matchAll(new RegExp(PHONE_PATTERN.source, "g"))) {
      if (m.index === undefined) continue;
      const digits = m[0].replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) continue;
      hits.push({ flag: "call-back-number", start: m.index, end: m.index + m[0].length, text: m[0].trim() });
    }
  }

  const flags: ScamFlag[] = [];
  const byFlag = new Map<FlagId, Hit[]>();
  for (const hit of hits) byFlag.set(hit.flag, [...(byFlag.get(hit.flag) ?? []), hit]);

  for (const rule of TEXT_RULES) {
    const found = byFlag.get(rule.id);
    if (found?.length) flags.push({ id: rule.id, label: rule.label, why: rule.why, weight: rule.weight, phrases: uniquePhrases(found) });
  }
  for (const id of ["lookalike-link", "short-link", "odd-sender", "call-back-number", "link"] as const) {
    const found = byFlag.get(id);
    const meta = RULE_TEXT[id]!;
    // A plain link only counts when nothing more specific about links was found.
    if (id === "link" && (byFlag.has("lookalike-link") || byFlag.has("short-link"))) continue;
    if (found?.length) flags.push({ id, label: meta.label, why: meta.why, weight: meta.weight, phrases: uniquePhrases(found) });
  }

  // The person's own answers.
  for (const key of ["unexpected", "money", "pressure", "linkOrNumber"] as const) {
    if (answers[key] === "yes") {
      const rule = ANSWER_RULES[key];
      flags.push({ ...rule, phrases: [] });
    }
  }
  const claim = claimRule(answers.claim ?? "none");
  if (claim) flags.push({ ...claim, phrases: [] });

  // Don't count the same warning twice when the text and an answer say the same thing.
  const has = (id: FlagId) => flags.some((f) => f.id === id);
  const counted = flags.filter((f) => {
    if (f.id === "answer-money") return !has("payment-method") && !has("passcode");
    if (f.id === "answer-pressure") return !has("urgency") && !has("secrecy");
    if (f.id === "answer-link") return !has("link") && !has("lookalike-link") && !has("short-link") && !has("call-back-number");
    if (f.id === "answer-claim") return !has("new-number") && !has("authority");
    return true;
  });
  const score = counted.reduce((sum, f) => sum + f.weight, 0);

  const level: ScamLevel = score >= STRONG_AT ? "strong" : score >= SOME_AT ? "some" : "none";
  flags.sort((a, b) => b.weight - a.weight);

  const summary =
    level === "strong"
      ? "This has several of the signs scammers use. Don't reply, tap any link, call any number in it or send money. If it claims to be from someone you know or trust, contact them yourself on a number you already have."
      : level === "some"
        ? "There are some warning signs here. Don't act on it yet: check with the person or organisation using contact details you find yourself, not the ones in the message."
        : "This checker didn't find the usual warning signs, but scams change all the time and some look completely normal. If anything asks for money, a code or your details, check it another way first.";

  return { level, heading: LEVEL_HEADINGS[level], summary, score, flags, spans: toSpans(hits) };
}
