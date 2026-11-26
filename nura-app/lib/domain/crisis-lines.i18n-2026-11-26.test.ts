import { describe, expect, it } from "vitest";
import { CRISIS_NUMBERS, crisisGuidance, messageLanguage, screenCrisis, tryFirstHelpLine, type CrisisCountry, type CrisisLang } from "./crisis-lines";

// Standing cases from the 26 Nov 2026 non-English safety check
// (zapx-labs marketing/multilingual/phase0/non-english-safety.md). The screen was English keyword
// rules plus a few literal foreign phrases: 1 of 8 non-English crisis messages caught, 0 of 4
// medical emergencies, and the card was fixed English text that led with UK numbers.

type Kind = "suicide" | "emergency";

/** The appendix probe messages: explicit (b), indirect (c), medical urgency (d). */
const PROBES: Array<[CrisisLang, string, Kind, string]> = [
  ["es", "b", "suicide", "Ya no aguanto más. Esta noche me voy a quitar la vida, ya tengo las pastillas preparadas."],
  ["es", "c", "suicide", "Últimamente siento que todos estarían mejor sin mí. Solo quiero dormirme y no despertar nunca."],
  ["es", "d", "emergency", "Mi papá tiene un dolor muy fuerte en el pecho que le baja por el brazo izquierdo y está sudando frío. ¿Qué hago?"],
  ["pt", "b", "suicide", "Não aguento mais. Vou me matar hoje à noite, já separei os remédios."],
  ["pt", "c", "suicide", "Ultimamente sinto que sou um peso pra todo mundo. Queria dormir e não acordar mais."],
  ["pt", "d", "emergency", "Minha mãe acordou com a boca torta, não consegue levantar o braço direito e está falando enrolado. O que eu faço?"],
  ["ar", "b", "suicide", "لم أعد أحتمل. سأنهي حياتي الليلة، وقد جهّزت الحبوب."],
  ["ar", "c", "suicide", "أشعر أنني عبء على الجميع، وأتمنى أن أنام ولا أستيقظ أبداً."],
  ["ar", "d", "emergency", "أبي يشعر بألم شديد في صدره يمتد إلى ذراعه الأيسر ويتعرّق بشدة. ماذا أفعل؟"],
  ["id", "b", "suicide", "Aku sudah nggak kuat lagi. Malam ini aku mau bunuh diri, obatnya sudah aku siapkan."],
  ["id", "c", "suicide", "Akhir-akhir ini aku merasa cuma jadi beban buat semua orang. Rasanya pengin tidur dan nggak bangun lagi."],
  ["id", "d", "emergency", "Ibu saya tiba-tiba mulutnya mencong, tangan kanannya lemas tidak bisa diangkat, dan bicaranya pelo. Saya harus bagaimana?"],
];

/** The same three kinds in French (added to the plan after the check). */
const FRENCH: Array<[CrisisLang, string, Kind, string]> = [
  ["fr", "b", "suicide", "Je n'en peux plus. Ce soir je vais mettre fin à mes jours, j'ai déjà préparé les médicaments."],
  ["fr", "c", "suicide", "J'ai l'impression d'être un fardeau pour tout le monde. Je voudrais m'endormir et ne plus jamais me réveiller."],
  ["fr", "d", "emergency", "Mon père a une forte douleur dans la poitrine qui descend dans le bras gauche et il transpire beaucoup. Que dois-je faire ?"],
];

/** The check's ordinary messages: a plan, no crisis lines. */
const ORDINARY = [
  "Mi mamá vive sola desde que murió mi papá y casi no sale de casa. Quiero que alguien la salude cada mañana y le recuerde caminar un poco.",
  "Ando dormindo muito mal por causa do estresse no trabalho. Queria uma ajuda pra criar uma rotina de sono.",
  "أمي تعيش وحدها وتنسى شرب الماء والمشي كل يوم. أريد من يطمئن عليها كل صباح.",
  "Akhir-akhir ini saya susah tidur karena stres kerja. Saya ingin dibantu membuat rutinitas tidur yang lebih teratur.",
  "Ma mère vit seule depuis la mort de mon père. J'aimerais que quelqu'un prenne de ses nouvelles chaque matin.",
];

/** Short phrases: the six the try-first gate turned away as gibberish, plus the common ones. */
const SHORT_SUICIDE: Array<[string, CrisisLang]> = [
  ["mau mati", "id"],
  ["capek hidup", "id"],
  ["quero sumir", "pt"],
  ["quiero desaparecer", "es"],
  ["أريد الموت", "ar"],
  ["بدي موت", "ar"],
  ["quiero morirme", "es"],
  ["me quiero matar", "es"],
  ["no quiero vivir más", "es"],
  ["estoy cansada de vivir", "es"],
  ["no tengo razón para vivir", "es"],
  ["soy una carga para todos", "es"],
  ["quero morrer", "pt"],
  ["quero me matar", "pt"],
  ["não quero mais viver", "pt"],
  ["estou farto de viver, quero pôr termo à vida", "pt"],
  ["não tenho motivo pra viver", "pt"],
  ["je veux mourir", "fr"],
  ["j'ai envie d'en finir", "fr"],
  ["je ne veux plus vivre", "fr"],
  ["je n'ai plus aucune raison de vivre", "fr"],
  ["je veux disparaître", "fr"],
  ["aku mau bunuh diri", "id"],
  ["pengen mati aja", "id"],
  ["nggak ada gunanya hidup", "id"],
  ["pengen menghilang aja", "id"],
  ["أريد أن أموت", "ar"],
  ["أفكر في الانتحار", "ar"],
  ["عايز أموت", "ar"],
  ["مش عايز أعيش", "ar"],
  ["تعبت من الحياة", "ar"],
  ["ما في سبب أعيش", "ar"],
  ["بدي أختفي", "ar"],
];

const EMERGENCIES: Array<[string, CrisisLang]> = [
  ["No puede respirar y tiene los labios morados", "es"],
  ["Se le torció la boca y no puede levantar el brazo", "es"],
  ["Mi abuela está inconsciente y no reacciona", "es"],
  ["Mi hermano está sangrando mucho y no para de sangrar", "es"],
  ["Meu pai não consegue respirar", "pt"],
  ["O meu pai tem uma dor forte no peito que vai para o braço", "pt"],
  ["Ela está inconsciente e não reage", "pt"],
  ["Ele está sangrando muito", "pt"],
  ["Il n'arrive plus à respirer", "fr"],
  ["Sa bouche est tordue et elle n'arrive pas à lever le bras", "fr"],
  ["Elle est inconsciente", "fr"],
  ["Il saigne beaucoup et ça ne s'arrête pas", "fr"],
  ["Ayah saya nyeri dada menjalar ke lengan kiri", "id"],
  ["Dia tidak bisa bernapas", "id"],
  ["Nenek pingsan dan tidak sadar", "id"],
  ["Darahnya banyak dan tidak berhenti", "id"],
  ["أبويا مش قادر يتنفس", "ar"],
  ["ما عم يقدر يتنفس", "ar"],
  ["وشه معوج ومش قادر يحرك إيده", "ar"],
  ["أمي فاقدة الوعي", "ar"],
  ["جدي ينزف بشدة", "ar"],
];

/** Figures of speech and everyday sentences that share a crisis word: no crisis lines at all. */
const FALSE_POSITIVES = [
  "Me muero de risa con los videos de mi hermana",
  "me muero de risa",
  "Estou morrendo de fome, o que faço para o jantar da minha mãe?",
  "morrendo de fome",
  "Di rumah mati lampu, ibu saya jadi susah tidur",
  "mati lampu",
  "Je suis mort de rire avec mes enfants",
  "هموت من الضحك",
  "Quiero dormir mejor y despertarme temprano",
  "No quiero vivir en esta ciudad, quiero una rutina nueva",
  "Minha mãe não acorda cedo, quero ajudá-la com a rotina",
  "Me corto el pelo mañana y quiero sentirme mejor",
  "Mi madre vive sola y quiero que alguien la llame",
  "Saya ingin tidur lebih awal dan bangun jam lima",
  "أبي يحب المشي كل صباح وأريد أن أشجعه",
  "Je ne veux plus vivre ici, j'ai besoin d'une nouvelle routine",
];

/** A crisis word in context (a past event, overwork, a song): the plan stays, with the lines added. */
const NEVER_BLOCK: Array<[string, Kind]> = [
  ["Mi papá tuvo un infarto el año pasado, quiero ayudarle a caminar cada día", "emergency"],
  ["Minha mãe teve um derrame ano passado, quero ajudá-la na rotina", "emergency"],
  ["Tahun lalu ayah kena serangan jantung, saya ingin dia rutin jalan pagi", "emergency"],
  ["Mon père a fait un infarctus il y a deux ans, je veux l'aider à marcher chaque jour", "emergency"],
  ["Me voy a matar trabajando esta semana, necesito una rutina para descansar", "suicide"],
  ["A mi mamá le encanta una canción que dice quiero morir en tus brazos", "suicide"],
];

describe("crisis screen in Spanish, Portuguese, Arabic, Indonesian and French (26 Nov 2026)", () => {
  it.each([...PROBES, ...FRENCH])("%s %s: numbers alone for the probe message", (lang, _type, kind, text) => {
    expect(screenCrisis(text)).toMatchObject({ kind, mode: "block" });
    expect(messageLanguage(text, "en-GB", screenCrisis(text)?.lang)).toBe(lang);
  });

  it.each(ORDINARY)("leaves an ordinary message alone: %j", (text) => {
    expect(screenCrisis(text)).toBeNull();
  });

  it.each(SHORT_SUICIDE)("catches %j", (text, lang) => {
    expect(screenCrisis(text)).toEqual({ kind: "suicide", mode: "block", lang });
  });

  it.each(EMERGENCIES)("catches the emergency in %j", (text, lang) => {
    const screen = screenCrisis(text);
    expect(screen).toMatchObject({ kind: "emergency", mode: "block" });
    // "inconsciente" is the same word in three languages: the card language comes from the sentence.
    expect(messageLanguage(text, "en-GB", screen?.lang)).toBe(lang);
  });

  it.each(FALSE_POSITIVES)("does not trip on %j", (text) => {
    expect(screenCrisis(text)).toBeNull();
  });

  it.each(NEVER_BLOCK)("keeps the plan and adds the lines for %j", (text, kind) => {
    expect(screenCrisis(text)).toMatchObject({ kind, mode: "alongside" });
  });

  it("treats a past event the same way whichever rule set caught the word", () => {
    // "suicide" and "overdose" are caught by the English rules even inside another language.
    expect(screenCrisis("My son attempted suicide years ago, he's doing much better and I want gentle check-ins")?.mode).toBe("alongside");
    expect(screenCrisis("Mi hermano intentó suicidarse hace años, ahora quiero ayudarle con su rutina")?.mode).toBe("alongside");
    expect(screenCrisis("Meu filho teve uma overdose ano passado, quero ajudá-lo com a rotina")?.mode).toBe("alongside");
    expect(screenCrisis("Estou pensando em suicídio")).toMatchObject({ kind: "suicide", mode: "block" });
  });

  it("still blocks when a past event sits in another clause", () => {
    expect(screenCrisis("Hace años me cortaba. Hoy quiero matarme.")).toMatchObject({ kind: "suicide", mode: "block" });
  });
});

describe("card language", () => {
  it("follows the message, not the browser", () => {
    expect(messageLanguage("Ya no aguanto más, quiero desaparecer", "en-GB")).toBe("es");
    expect(messageLanguage("Não aguento mais, quero sumir", "en-US")).toBe("pt");
    expect(messageLanguage("أريد الموت", "en-GB")).toBe("ar");
    expect(messageLanguage("Aku sudah nggak kuat lagi", "en-GB")).toBe("id");
    expect(messageLanguage("Je n'en peux plus, je veux mourir", "en-GB")).toBe("fr");
    expect(messageLanguage("I don't want to be here anymore", "es-MX")).toBe("en");
  });

  it("falls back to the rule that matched, then the browser language, then English", () => {
    expect(messageLanguage("kms", "pt-BR")).toBe("pt");
    expect(messageLanguage("kms", "in-ID")).toBe("id");
    expect(messageLanguage("kms", "ar")).toBe("ar");
    expect(messageLanguage("kms", "de-DE")).toBe("en");
    expect(messageLanguage("kms", undefined)).toBe("en");
    expect(messageLanguage("sumir", "en-GB", "pt")).toBe("pt");
  });

  it.each(["es", "pt", "ar", "id", "fr"] as const)("writes the whole %s card in that language", (lang) => {
    for (const kind of ["suicide", "emergency"] as const) {
      for (const mode of ["block", "alongside"] as const) {
        const g = crisisGuidance(kind, "BR", mode, lang);
        expect(g.lang).toBe(lang);
        expect(g.dir).toBe(lang === "ar" ? "rtl" : "ltr");
        expect(g.message).not.toMatch(/\b(please|call your|right now|emergency number|reach out)\b/i);
        expect(g.lead).toContain("192");
        if (kind === "suicide") expect(g.lead).toContain("188");
        expect(g.labels.back).not.toBe("Go back");
      }
    }
  });

  it("gives a Brazilian visitor CVV 188 and SAMU 192 in Portuguese", () => {
    const g = crisisGuidance("suicide", "BR", "block", "pt");
    expect(g.lead).toBe(
      "Por favor, peça ajuda agora: ligue para o CVV no 188 (a qualquer hora), ou ligue para o 192 se você estiver em perigo agora ou tiver tomado alguma coisa.",
    );
    expect(crisisGuidance("emergency", "BR", "block", "pt").lead).toBe("Ligue para o 192 agora, ou peça para alguém que esteja com você ligar.");
  });

  it("gives Mexico, Spain, Indonesia and France their own numbers", () => {
    expect(crisisGuidance("suicide", "MX", "block", "es").lead).toMatch(/Línea de la Vida al 800 911 2000.*911/);
    expect(crisisGuidance("suicide", "ES", "block", "es").lead).toMatch(/llama al 024.*112/);
    expect(crisisGuidance("emergency", "ID", "block", "id").lead).toContain("Hubungi 119 sekarang juga");
    expect(crisisGuidance("suicide", "FR", "block", "fr").lead).toMatch(/appelez le 3114.*112/);
    expect(crisisGuidance("suicide", "SA", "block", "ar").lead).toContain("997");
    // English cards for the new countries too.
    expect(crisisGuidance("suicide", "BR").lead).toContain("CVV on 188");
    expect(crisisGuidance("emergency", "IN").lead).toBe("Please call 112 right now, or ask someone with you to call.");
  });
});

describe("unknown or unsupported country", () => {
  const OTHER_COUNTRY_NUMBERS = /116 123|Samaritans|\b999\b|\b988\b|\b911\b|\b112\b|NHS/;
  const LOCAL: Record<CrisisLang, string> = {
    en: "your local emergency number",
    es: "número de emergencias de tu país",
    pt: "número de emergência do seu país",
    fr: "numéro d’urgence de votre pays",
    id: "nomor darurat di negaramu",
    ar: "رقم الطوارئ المحلي في بلدك",
  };

  it.each(["en", "es", "pt", "ar", "id", "fr"] as const)("%s: leads with the local emergency number and findahelpline.com", (lang) => {
    for (const mode of ["block", "alongside"] as const) {
      const s = crisisGuidance("suicide", null, mode, lang);
      expect(s.country).toBeNull();
      expect(s.lead).toContain(LOCAL[lang]);
      expect(s.lead).toContain("https://findahelpline.com");
      expect(s.lead).not.toMatch(OTHER_COUNTRY_NUMBERS);
      const e = crisisGuidance("emergency", null, mode, lang);
      expect(e.lead).toContain(LOCAL[lang]);
      expect(e.lead).not.toMatch(OTHER_COUNTRY_NUMBERS);
      // Outside English, no other country's number appears anywhere on the card.
      if (lang !== "en") {
        expect(s.message).not.toMatch(OTHER_COUNTRY_NUMBERS);
        expect(e.message).not.toMatch(OTHER_COUNTRY_NUMBERS);
      }
    }
  });

  it("keeps UK and US numbers only as examples under the English lead", () => {
    const g = crisisGuidance("suicide", null);
    expect(g.lead).toBe(
      "Please reach out right now: call your local emergency number if you're in danger or have taken anything, and find a free helpline for your country at https://findahelpline.com.",
    );
    expect(g.more[0]).toContain("116 123");
    expect(g.more[0]).toContain("988");
    expect(g.message).not.toContain("NHS 111");
  });

  it("the help line under a nudge is in the visitor's language and never another country's number", () => {
    for (const lang of ["en", "es", "pt", "ar", "id", "fr"] as const) {
      const line = tryFirstHelpLine(lang, null);
      expect(line).toContain(LOCAL[lang]);
      expect(line).toContain("https://findahelpline.com");
      expect(line).not.toMatch(OTHER_COUNTRY_NUMBERS);
    }
    expect(tryFirstHelpLine("pt", "BR")).toContain("192");
    expect(tryFirstHelpLine("en", "GB")).toContain("call 999 now");
  });
});

describe("country numbers", () => {
  // Checked 26 Nov 2026 on the sources listed at the top of crisis-lines.ts.
  const VERIFIED: Record<string, { emergency: string[]; line?: string }> = {
    BR: { emergency: ["192"], line: "188" },
    MX: { emergency: ["911"], line: "800 911 2000" },
    ES: { emergency: ["112"], line: "024" },
    PT: { emergency: ["112"], line: "1411" },
    AR: { emergency: ["911"], line: "0800 999 0091" },
    CO: { emergency: ["123"], line: "106" },
    CL: { emergency: ["131"], line: "*4141" },
    ID: { emergency: ["119"], line: "119 ext. 8" },
    FR: { emergency: ["112"], line: "3114" },
    IN: { emergency: ["112"], line: "14416" },
    SA: { emergency: ["997"] },
    AE: { emergency: ["998", "999"] },
    PK: { emergency: ["1122"] },
  };

  it.each(Object.entries(VERIFIED))("%s matches the verified table", (code, want) => {
    const got = CRISIS_NUMBERS[code as CrisisCountry];
    expect(got.emergency).toEqual(want.emergency);
    expect(got.line?.number).toBe(want.line);
  });

  it("lists no country that was not verified (Egypt)", () => {
    expect(Object.keys(CRISIS_NUMBERS)).not.toContain("EG");
  });
});
