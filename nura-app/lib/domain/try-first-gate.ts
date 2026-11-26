/**
 * Off-topic and probe gate for "Try Nura first" (22 Nov 2026 QA). A "connectivity test" probe was
 * turned into a "Connectivity Test Check" Care plan and the probe's reference was echoed back.
 * Anything that isn't about a person and how they're doing gets a friendly nudge instead of a plan,
 * and no model call is made.
 *
 * Deterministic and deliberately cautious: anything that mentions a person, a feeling or a part of
 * everyday wellbeing goes through, so a real (if short or odd) message is never turned away.
 *
 * 26 Nov 2026 (non-English safety check): "mau mati", "quero sumir", "أريد الموت" and "بدي موت"
 * were turned away as gibberish (fewer than three words) with no model call and no numbers. Order
 * of the checks on a try-first message now:
 *   1. the crisis screen (crisis-lines.ts), in six languages, before this gate and the length check;
 *   2. this gate, which no longer calls a short message gibberish when it could be another language
 *      (any non-ASCII letter, or two real-looking words that aren't English filler): it goes to the
 *      model, whose safety check is by meaning, not keywords;
 *   3. anything still turned away, or too short, is shown `tryFirstHelpLine` under the nudge, so
 *      the nudge is never the only thing a person in distress sees.
 */

export type TryFirstGateReason = "probe" | "gibberish" | "not_care";

export type TryFirstGate = { ok: true } | { ok: false; reason: TryFirstGateReason; message: string };

/** What the visitor sees instead of a plan. */
export const TRY_FIRST_OFF_TOPIC_MESSAGE =
  "Nura is a companion that checks in on people. Tell it who you’d like it to check in on (you, or someone you look out for) and how they’re doing: sleep, stress, energy, a routine, or whatever matters to them.";

/** Probes that are never a real message, even next to everyday words. */
const HARD_PROBE =
  /\b(connectivity|lorem ipsum|hello,? world|smoke[- ]?test|ping[- ]?test|health[- ]?check (endpoint|ping)|uptime (check|monitor)|ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|messages?)|system prompt|jailbreak|prompt injection)\b/i;

/** Probes and placeholders that only count when nothing in the message is about a person. */
const SOFT_PROBE =
  /\b(test(ing)?|tests|ping|probe|debug(ging)?|dummy|placeholder|sample (text|input)|foo|bar|baz|asdf\w*|qwerty\w*|api|endpoint|payload|request id|ref(erence)? ?(id|no|number|code)?[:#]|json|curl|http|localhost|webhook|integration|monitoring|automated|bot)\b/i;

/** Requests for something other than a check-in companion. */
const NOT_CARE_REQUEST =
  /^\s*(please\s+)?(write|generate|create|code|translate|summari[sz]e|calculate|solve|draft|compose|list|give me|tell me a (joke|story)|what is|what's|who is|who was|when (is|was|did)|where is|how (do|can) i (code|build|make money|hack)|can you (write|code|translate|generate|make))\b/i;

/**
 * Words that show the message is about someone and how they're doing. Any one of these and the
 * message goes through (unless it's a hard probe).
 */
const CARE_SIGNAL = new RegExp(
  "\\b(" +
    [
      // people
      "mum|mom|mother|mam|dad|father|parents?|gran|granny|grandma|grandmother|grandad|grandpa|grandfather|nan|nana|nanna",
      "partner|wife|husband|boyfriend|girlfriend|son|daughter|kids?|children|child|baby|friend|brother|sister|family|aunt|uncle|neighbou?r|carer|caring",
      // how someone is
      "feel|feels|feeling|feelings|felt|mood|stress|stressed|stressful|anxious|anxiety|worried|worry|worrying|lonely|loneliness|alone|sad|down|low|happy|overwhelm\\w*|burn(ed|t)? ?out|burnout|cope|coping|struggl\\w*|grief|grieving|nervous|scared|afraid|upset|angry|bored|sick|ill|unwell",
      "tired|exhausted|fatigue|energy|sleep\\w*|slept|insomnia|rest|wake|waking",
      // everyday wellbeing and routines
      "routines?|habits?|walk\\w*|exercis\\w*|gym|running|move|moving|water|hydrat\\w*|eat|eating|food|meals?|diet|weight|drink\\w*|alcohol|smok\\w*|vape|vaping",
      "health\\w*|well-?being|wellness|self-?care|motivat\\w*|focus|morning|evening|night|bedtime|wind ?down",
      "check(ing)?[- ]?(in|on)|checkins?|remind\\w*|nudges?|accountab\\w*|support|visit\\w*",
      // life
      "work|job|shift|exams?|study\\w*|uni|school|retire\\w*|moved|living|lives|home",
      // the minor health side Nura still covers
      "medication|medicine|tablets?|pills?|doses?|pain|recover\\w*|pregnan\\w*|postpartum|surgery|hospital|doctor|gp|therapy|therapist|blood|appointments?|scan|results",
    ].join("|") +
    ")\\b",
  "i",
);

const VOWEL = /[aeiouy]/i;

/** English words that make a two-word message a greeting or a shrug, not something to plan from. */
const ENGLISH_FILLER = new Set(
  "hello hi hey hiya yo sup there ok okay yes no nope yeah yep thanks thank you please good great fine cool nice lol haha hmm what whats who why how when where is are it this that the and or so just nothing idk dunno bye nura ai app chatgpt claude bot test testing"
    .split(" "),
);

/**
 * A message of one or two words that may be real words in another language, so it must not be
 * called gibberish: it has a letter outside ASCII (another script, or an accent), or it is two
 * different words with vowels that are not English filler ("mau mati", "quero sumir").
 */
function couldBeAnotherLanguage(text: string, distinct: Set<string>) {
  if (/[^\x00-\x7F]/.test(text.replace(/[^\p{L}]/gu, ""))) return true;
  if (distinct.size < 2) return false;
  const list = [...distinct];
  return list.every((w) => VOWEL.test(w)) && list.some((w) => !ENGLISH_FILLER.has(w.replace(/[’']/g, "")));
}

function words(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{M}’']+/gu) ?? [];
}

/** Keyboard mashes, number strings, a word or two repeated. */
function looksLikeGibberish(text: string) {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return true;
  const letters = (compact.match(/[\p{L}\p{M}]/gu) ?? []).length;
  if (letters / compact.length < 0.5) return true;

  const all = words(text);
  const latin = all.filter((w) => /^[a-z’']+$/.test(w));
  // Only judge vowels on Latin-script words; other scripts pass this check.
  if (latin.length > 0) {
    const noVowel = latin.filter((w) => w.length >= 5 && !VOWEL.test(w));
    if (noVowel.length > 0 && noVowel.length / latin.length >= 0.3) return true;
  }
  const distinct = new Set(all.filter((w) => w.length >= 2));
  if (distinct.size < 3 && !couldBeAnotherLanguage(text, distinct)) return true;
  // The same letter five or more times in a row, in more than one place ("aaaaa bbbbb").
  if ((text.match(/(\p{L})\1{4,}/gu) ?? []).length >= 2) return true;
  return false;
}

/** Decides whether a try-first message should get a plan, or a friendly nudge instead. */
export function gateTryFirstText(text: string): TryFirstGate {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const offTopic = (reason: TryFirstGateReason): TryFirstGate => ({ ok: false, reason, message: TRY_FIRST_OFF_TOPIC_MESSAGE });

  if (HARD_PROBE.test(cleaned)) return offTopic("probe");
  if (CARE_SIGNAL.test(cleaned)) return { ok: true };
  if (SOFT_PROBE.test(cleaned)) return offTopic("probe");
  if (NOT_CARE_REQUEST.test(cleaned)) return offTopic("not_care");
  if (looksLikeGibberish(cleaned)) return offTopic("gibberish");
  return { ok: true };
}
