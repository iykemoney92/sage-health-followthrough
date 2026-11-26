import { CARD_STRINGS, FIND_A_HELPLINE } from "@/lib/domain/crisis-cards-i18n";
import {
  CRISIS_LINES,
  CRISIS_NUMBERS,
  crisisCountry,
  messageLanguage,
  screenCrisis,
  type CrisisKind,
  type CrisisLang,
} from "@/lib/domain/crisis-lines";
import { foldText } from "@/lib/domain/crisis-screen-i18n";

/**
 * Clariti's code backstop for crisis and medical-emergency messages in chat (26 Nov 2026
 * non-English safety check: Clariti had no code screen at all, so a message the model missed got
 * an ordinary paperwork answer with no numbers, and Brazil, Indonesia, Egypt and Saudi Arabia got
 * no digits).
 *
 * The screen itself is Nura's (crisis-lines.ts, crisis-screen-i18n.ts: English, Spanish,
 * Portuguese, French, Indonesian, Arabic, with idioms, past events and quotes handled). What
 * Clariti adds is document wording. Clariti's readers ask about paperwork that is full of crisis
 * words ("why does my discharge summary say chest pain?", "is the overdose visit covered?",
 * "¿qué significa 'dolor torácico' en mi informe?"). A sentence that talks about the paperwork
 * (it names a document, a code, a charge or a diagnosis, or asks what a term means) has its
 * medical TERMS masked before screening, unless the same sentence says it is happening to
 * someone now: a present-tense "has / tengo / tem / j'ai / mengalami / عنده" right before the
 * term, or a now-word ("right now", "esta noche", "o que eu faço", "ماذا أفعل"). Statements are
 * never masked: "can't breathe", "me voy a quitar la vida" and "bunuh diri" in "aku mau bunuh
 * diri" still fire inside a sentence about a bill, because only the listed nouns are masked and
 * "bunuh diri" is masked only when the sentence is about a document and has no present marker.
 *
 * What the backstop does with a hit (it never blocks or replaces the answer about the document):
 * - a crisis or emergency statement ("block" in Nura's screen): the lines for the reader's
 *   country, in the language they wrote in, are appended unless the reply already gives them;
 * - suicide wording in context (a past event, a quote, a figure of speech): one gentle line;
 * - an emergency word in context ("Dad had a heart attack last year"): nothing, because Clariti's
 *   readers talk about past medical events all day.
 */

export type ClaritiCrisisLevel = "urgent" | "gentle";
export type ClaritiCrisisHit = { kind: CrisisKind; level: ClaritiCrisisLevel; lang: CrisisLang };

type Numbers = { emergency: string[]; line?: { name?: string; number: string } };
type EnglishLines = { name: string; crisis: string; emergency: string };

/**
 * Countries Clariti already named before 26 Nov that Nura's verified table does not have. Numbers
 * as checked on official sources on 25 Nov (see lib/ai/clariti-safety.ts): PH 911 (DILG, EO 56),
 * KE 999/112 (National Police Service), MY 999 (malaysia.gov.my), NZ 111 (police.govt.nz). No
 * crisis line was confirmed for any of them.
 */
const CLARITI_EXTRA: Record<string, { name: string; emergency: string[] }> = {
  PH: { name: "the Philippines", emergency: ["911"] },
  KE: { name: "Kenya", emergency: ["999", "112"] },
  MY: { name: "Malaysia", emergency: ["999"] },
  NZ: { name: "New Zealand", emergency: ["111"] },
};

/** The rest of the EU: 112, the emergency number across the EU. No crisis line confirmed. */
const EU_112 = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "DE", "GR", "HU", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "RO", "SK", "SI", "SE",
]);

/** Every country the backstop can give digits for, with its numbers. Null means "your local emergency number". */
export function claritiCrisisNumbers(iso2: string | null | undefined): { country: string; numbers: Numbers; english: EnglishLines } | null {
  const code = (iso2 ?? "").trim().toUpperCase();
  const nura = crisisCountry(code);
  if (nura) return { country: nura, numbers: CRISIS_NUMBERS[nura], english: CRISIS_LINES[nura] };
  const extra = CLARITI_EXTRA[code] ?? (EU_112.has(code) ? { name: "the EU", emergency: ["112"] } : null);
  if (!extra) return null;
  const emergency = extra.emergency.join(" or ");
  return {
    country: code,
    numbers: { emergency: extra.emergency },
    english: {
      name: extra.name,
      crisis: `${emergency} if you're in danger right now or have taken anything, and tell someone you trust who can be with you`,
      emergency,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Document wording
// ---------------------------------------------------------------------------------------------

/** "Attached: scan.pdf" and "Please read this document: chest_pain.pdf" are file names, not words. */
function withoutAttachmentNames(text: string) {
  return text.replace(/\n*\s*Attached:\s*.+$/i, "").replace(/^Please read this document:\s*.+$/i, "");
}

/**
 * A pattern folded like the text it is tested on (crisis-screen-i18n.ts `foldText`): Arabic hamza
 * seats and vowel marks go, so "زائدة" in a pattern must become "زايده" too. No upper-case escapes.
 */
function folded(source: string, flags = "") {
  return new RegExp(foldText(source), flags);
}

/** The sentence talks about paperwork: a document, a code, a charge, a diagnosis, or what a term means. */
const DOCUMENT_TALK = folded(
  [
    // English
    "\\b(document|documents|summary|report|letter|bill|bills|billing|invoice|statement|eob|explanation of benefits|claim|claims|insurance|insurer|coverage|record|records|chart|notes?|discharge|discharged|diagnos\\w*|codes?|coded|coding|icd(-?10)?|cpt|drg|charges?|charged|billed|results?|labs?|paperwork|forms?|listed|written|mentions?|mentioned|documented|history of|admitted|admission|referral|denied|denial|prior auth\\w*|pre-?auth\\w*|copay|deductible|stand for|meaning|term|abbreviation|define|definition)\\b",
    "\\bwhat (does|do|did|is|are|was|were|'s) .{0,60}\\bmean\\b",
    "\\b(what is|what's|whats|what are) (a|an)\\b",
    // Spanish
    "\\b(documento|resumen|informe|reporte|carta|factura|estado de cuenta|seguro|aseguradora|diagnostico|dado de alta|alta medica|alta hospitalaria|informe de alta|resumen de alta|historial|antecedentes|expediente|codigo|cobro|cobraron|cobrado|reclamo|resultados?|analisis|laboratorio|receta|que significa|que quiere decir|que es (un|una|el|la))\\b",
    // Portuguese
    "\\b(documento|resumo|relatorio|laudo|carta|fatura|conta hospitalar|plano de saude|convenio|seguro|diagnostico|alta hospitalar|resumo de alta|historico|antecedentes|prontuario|codigo|cobranca|cobraram|cobrado|exames?|resultados?|receita|o que significa|o que quer dizer|o que e (um|uma|o|a))\\b",
    // French
    "\\b(document|compte rendu|compte-rendu|rapport|lettre|facture|assurance|mutuelle|diagnostic|antecedents|dossier|code|resultats?|analyses|ordonnance|lettre de sortie|qu'est-ce que|que veut dire|que signifie|ca veut dire quoi)\\b",
    // Indonesian
    "\\b(dokumen|ringkasan|resume|laporan|surat|tagihan|asuransi|bpjs|klaim|diagnosis|diagnosa|riwayat|rekam medis|kode|hasil|resep|apa (itu|arti|artinya|maksud|maksudnya)|artinya|maksudnya|tertulis|disebutkan)\\b",
    // Arabic (folded: no hamza on alef, ة → ه, ى → ي)
    "(المستند|الوثيقه|التقرير|الملخص|ملخص الخروج|الرساله|الخطاب|الفاتوره|التامين|التشخيص|التاريخ المرضي|سوابق|الرمز|الكود|النتائج|نتيجه|التحاليل|الوصفه|مكتوب|ماذا يعني|ما معني|ما هو|ما هي|يعني ايه|شو يعني|شو معني)",
  ].join("|"),
);

/** ...unless the same sentence says it is happening now, or asks what to do. */
const HAPPENING_NOW = folded(
  [
    "\\b(now|right now|just now|at the moment|currently|tonight|this (morning|afternoon|evening)|just started|came back|coming back|getting worse|what (do|should|can) (i|we) do|should (i|we) call)\\b",
    "\\b(ahora|ahora mismo|en este momento|esta noche|que hago|que hacemos|que debo hacer)\\b",
    "\\b(agora|agora mesmo|neste momento|esta noite|o que (eu )?faco|o que fazer|o que a gente faz)\\b",
    "\\b(en ce moment|maintenant|ce soir|que dois-je faire|que faire|qu'est-ce que je fais)\\b",
    "\\b(sekarang|saat ini|malam ini|harus bagaimana|harus apa|gimana ini)\\b",
    "(الان|الحين|دلوقتي|هلق|هلا|الليله|ماذا افعل|ماذا نفعل|شو اعمل|شو نعمل|اعمل ايه|وش اسوي)",
  ].join("|"),
);

/** Present tense right before the term: "has chest pain", "tiene un dolor", "estou com falta de ar". */
const PRESENT_VERB =
  "(has|have|having|got|gets|getting|feel|feels|feeling|tiene|tengo|tienen|tenemos|siente|siento|sintiendo|le duele|me duele|tem|tenho|esta com|estou com|ta com|to com|sente|sinto|sentindo|j'ai|il a|elle a|on a|ressens|ressent|souffre de|punya|mengalami|merasa|merasakan|kena|sedang|lagi|عندي|عنده|عندها|يعاني|تعاني|اعاني|يشعر|تشعر|اشعر|حاسس|حاسه|جاله|جالها)";

/** Medical terms that paperwork prints as labels, masked in a sentence about the paperwork. */
const DOCUMENT_TERMS = [
  // English
  "chest pains?|chest pressure|chest tightness|heart attacks?|myocardial infarction|cardiac arrest|strokes?|tia|seizures?|overdos\\w*|suicid\\w*|self[- ]?harm\\w*|ha?emorrhag\\w*|collaps\\w*|syncope|unconscious\\w*|loss of consciousness|anaphyla\\w*|shortness of breath|difficulty breathing|trouble breathing|dyspn\\w*|slurred speech|facial droop|ideation",
  // Spanish
  "dolor(es)?( [a-z]+){0,3} (en el|de|del) pecho|dolor toracico|infartos?|ataque al corazon|ictus|derrame( cerebral)?|acv|convulsi\\w*|sobredosis|intento de suicidio|suicidio|autolesi\\w*|hemorragia\\w*|disnea|dificultad (para )?respirar|desmayo|sincope",
  // Portuguese
  "dor(es)?( [a-z]+){0,3} (no|do|em) peito|dor toracica|infarto|enfarte|ataque cardiaco|avc|derrame|convuls\\w*|superdosagem|overdose|tentativa de suicidio|suicidio|automutila\\w*|autoles\\w*|hemorragia|falta de ar|dispneia|desmaio",
  // French
  "douleurs? thoraciques?|douleurs?( [a-z]+){0,2} (a|dans) la poitrine|infarctus|crise cardiaque|convulsions?|surdose|tentative de suicide|automutil\\w*|hemorragie|dyspnee|malaise",
  // Indonesian
  "nyeri dada|sakit dada|serangan jantung|kejang|overdosis( obat)?|percobaan bunuh diri|bunuh diri|perdarahan|pendarahan|sesak (napas|nafas)|pingsan",
].join("|");
const ARABIC_TERMS = "الم( [^ ]+){0,2} (في|ب) ?(ال)?صدر[^ ]*|الم صدري|نوبه قلبيه|جلطه( دماغيه| قلبيه)?|سكته دماغيه|تشنج[^ ]*|جرعه زائده|محاوله انتحار|انتحار|نزيف|ضيق (في )?(ال)?تنفس";

const TERM = folded(`\\b(${DOCUMENT_TERMS})\\b|(${ARABIC_TERMS})`, "g");
const PRESENT_BEFORE_TERM = new RegExp(`(^|[^\\p{L}])${foldText(PRESENT_VERB)}( [^ ]+){0,2} (${foldText(DOCUMENT_TERMS)}|${foldText(ARABIC_TERMS)})`, "u");

/** Sentence breaks only: a comma inside "what does chest pain, listed here, mean" is one question. */
const SENTENCE_SPLIT = /[.!?;\n؟؛]+/;

/**
 * The message with the medical terms of every sentence that only talks about the paperwork
 * masked out. Sentences that say something is happening now are left as written.
 */
export function maskDocumentWording(text: string): string {
  return withoutAttachmentNames(text)
    .split(SENTENCE_SPLIT)
    .map((sentence) => {
      const folded = foldText(sentence).replace(/[¿¡"“”«»]/g, " ");
      if (!DOCUMENT_TALK.test(folded)) return sentence;
      if (HAPPENING_NOW.test(folded) || PRESENT_BEFORE_TERM.test(folded)) return sentence;
      return folded.replace(TERM, " ");
    })
    .filter((sentence) => sentence.trim())
    .join("\n");
}

/**
 * Screens one chat message. Null when there is nothing to add: no crisis or emergency wording,
 * an emergency word about the past, or crisis words that only name something in the paperwork.
 */
export function screenClaritiMessage(text: string, locale?: string | null): ClaritiCrisisHit | null {
  const screen = screenCrisis(maskDocumentWording(text));
  if (!screen) return null;
  const level: ClaritiCrisisLevel | null = screen.mode === "block" ? "urgent" : screen.kind === "suicide" ? "gentle" : null;
  if (!level) return null;
  return { kind: screen.kind, level, lang: messageLanguage(withoutAttachmentNames(text), locale, screen.lang ?? null) };
}

// ---------------------------------------------------------------------------------------------
// The lines
// ---------------------------------------------------------------------------------------------

const EN_EXAMPLE_LINES = "In the UK and Ireland, Samaritans are on 116 123; in the US and Canada, call or text 988.";
const EN_EXAMPLE_EMERGENCY = "It's 999 in the UK, 911 in the US and Canada, and 112 in most of Europe.";
const NHS_111 = "If it isn't an emergency but needs looking at today, call NHS 111 (UK).";
const EN_CANT_HELP = "Clariti can’t help with an emergency. Don’t wait to see if it passes.";

/**
 * The lines for a hit, in `hit.lang`, for the reader's country (ISO alpha-2 from the edge). An
 * unknown or unlisted country gets "your local emergency number" and findahelpline.com, never
 * another country's number as the instruction (English adds the UK/US lines as examples only
 * when the country is unknown, as the chat prompt does).
 *
 * `alone` is for a reply that is only the lines (a message that could not reach the model), so it
 * opens with a warm sentence.
 */
export function crisisLinesText(hit: ClaritiCrisisHit, iso2: string | null | undefined, alone = false): string {
  const found = claritiCrisisNumbers(iso2);
  const unknown = !iso2;
  if (hit.lang === "en") return englishLines(hit, found, unknown, alone);

  const s = CARD_STRINGS[hit.lang];
  const emergency = found ? found.numbers.emergency.join(s.or) : null;
  const call = found?.numbers.line ? s.callLine(found.numbers.line.name, found.numbers.line.number) : null;
  const travelling = found ? [s.elsewhere] : [];
  if (hit.level === "gentle") return s.alongside.suicideLead(call, emergency);
  if (hit.kind === "suicide") return [...(alone ? [s.suicide.title] : []), s.suicide.lead(call, emergency), ...travelling].join(" ");
  return [...(alone ? [s.emergency.title] : []), s.emergency.lead(emergency), ...travelling, ...(alone ? [s.emergency.cantHelp] : [])].join(" ");
}

function englishLines(
  hit: ClaritiCrisisHit,
  found: ReturnType<typeof claritiCrisisNumbers>,
  unknown: boolean,
  alone: boolean,
): string {
  const lines = found?.english;
  const elsewhere = lines ? `If you're not in ${lines.name}, call your local emergency number.` : null;
  if (hit.level === "gentle") {
    return lines
      ? `If you're having thoughts of suicide or self-harm, or you're worried someone is: ${lines.crisis}.`
      : `If you're having thoughts of suicide or self-harm, or you're worried someone is: call your local emergency number if there's any danger, and find a free helpline for your country at ${FIND_A_HELPLINE}.${unknown ? ` ${EN_EXAMPLE_LINES}` : ""}`;
  }
  if (hit.kind === "suicide") {
    return [
      ...(alone ? ["I’m really glad you told me. You don’t have to go through this alone."] : []),
      lines
        ? `Please reach out right now: ${lines.crisis}.`
        : `Please reach out right now: call your local emergency number if you're in danger or have taken anything, and find a free helpline for your country at ${FIND_A_HELPLINE}.`,
      ...(elsewhere ? [elsewhere] : unknown ? [EN_EXAMPLE_LINES] : []),
    ].join(" ");
  }
  return [
    ...(alone ? ["This sounds like it needs help now."] : []),
    lines
      ? `Please call ${lines.emergency} right now, or ask someone with you to call.`
      : "Please call your local emergency number right now, or ask someone with you to call.",
    ...(elsewhere ? [elsewhere] : unknown ? [EN_EXAMPLE_EMERGENCY] : []),
    ...(found?.country === "GB" ? [NHS_111] : []),
    ...(alone ? [EN_CANT_HELP] : []),
  ].join(" ");
}

/** Digits only, keeping * (Chile's *4141): "800 911 2000" → "8009112000". */
function compact(value: string) {
  return value.replace(/[^\d*]/g, "");
}

/** The number written in the reply, ignoring spaces, dashes and dots ("9-8-8", "800-911-2000"). */
function mentions(reply: string, number: string) {
  const wanted = compact(number.replace(/\s*ext\.?.*$/i, ""));
  if (!wanted) return true;
  const digits = reply.replace(/(?<=[\d*])[\s.\-()]+(?=[\d*])/g, "");
  return new RegExp(`(?<![\\d*])${wanted.replace(/\*/g, "\\*")}(?!\\d)`).test(digits);
}

/** True when the reply already gives the numbers the backstop would lead with. */
export function replyHasCrisisLines(reply: string, hit: ClaritiCrisisHit, iso2: string | null | undefined): boolean {
  const found = claritiCrisisNumbers(iso2);
  if (!found) return reply.includes("findahelpline");
  const wanted = [found.numbers.emergency[0], ...(hit.kind === "suicide" && found.numbers.line ? [found.numbers.line.number] : [])];
  return wanted.every((number) => mentions(reply, number));
}

/**
 * The reply with the lines appended when the model left them out. The answer itself is never
 * cut or replaced.
 */
export function withCrisisLines(reply: string, hit: ClaritiCrisisHit | null, iso2: string | null | undefined): string {
  if (!hit || replyHasCrisisLines(reply, hit, iso2)) return reply;
  const lines = crisisLinesText(hit, iso2);
  return reply.trim() ? `${reply}\n\n${lines}` : lines;
}
