/**
 * COPIED from nura-app/lib/domain/crisis-screen-i18n.ts at cfe2ef5 (PR #100, 26 Nov 2026), unchanged
 * apart from this note. The two apps deploy separately and share no package, so a fix to the
 * wording belongs in both copies; `diff` the two files to check they still agree.
 *
 * Crisis and emergency wording in Spanish, Portuguese (Brazil and Portugal), French, Indonesian and
 * Arabic (Modern Standard plus common Egyptian and Levantine forms), for the deterministic screen
 * in crisis-lines.ts.
 *
 * 26 Nov 2026 check: the screen was English keyword rules plus a few literal foreign phrases. On 8
 * non-English crisis messages it caught 1, and its emergency rules were English only.
 *
 * Every pattern here is matched against folded text (see `foldText`): lower case, accents and
 * Arabic vowel marks removed, Arabic letter variants merged. Patterns are written the natural way
 * (with accents and hamzas) and folded the same way by `rx`, so the two always agree.
 */

export type CrisisLang = "en" | "es" | "pt" | "ar" | "id" | "fr";

export type LangRule = {
  re: RegExp;
  /** When this also matches, the hit only adds the lines (it never blocks on its own). */
  soft?: RegExp;
  lang: CrisisLang;
};

/**
 * Lower case, apostrophes unified, accents and Arabic vowel marks stripped ("não" → "nao",
 * "أَموت" → "اموت"), alef/hamza forms merged, ى → ي, ة → ه, tatweel removed, spaces collapsed.
 */
export function foldText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

/** A pattern written naturally, folded like the text it will be tested on. No upper-case escapes. */
function rx(source: string, flags = "") {
  return new RegExp(foldText(source), flags);
}

function rules(lang: CrisisLang, list: Array<string | [string, RegExp]>): LangRule[] {
  return list.map((item) => (typeof item === "string" ? { re: rx(item), lang } : { re: rx(item[0]), soft: item[1], lang }));
}

/** "Me voy a matar trabajando", "me matar de estudar", "me tuer au travail": overwork, not a plan. */
const ES_KILL_IDIOM = rx("\\b(matar|matarme|mato|matando) (me )?(estudiando|trabajando|entrenando|a trabajar|a estudiar|en el gimnasio|en el trabajo|de risa)\\b");
const PT_KILL_IDIOM = rx("\\bme mat(ar|o|ando|ei) (de |na |no )?(trabalhar|estudar|trabalho|academia|estudando|trabalhando|rir)\\b");
const FR_KILL_IDIOM = rx("\\bme tue[r]? (au travail|à la tâche|au boulot|à travailler|à réviser)\\b");

const ID_NOT = "(tidak|nggak|gak|ga|ngga|enggak|tak|ndak)";
const ID_WANT = "(mau|ingin|pengen|pingin|pengin|kepengen|kepingin|pgn|pengennya)";

export const FOREIGN_SUICIDE: LangRule[] = [
  // Spanish
  ...rules("es", [
    [
      "\\b(me )?(quiero|quisiera|querría|quería|voy a|pienso|pensando en|pensado en|ganas de|deseo|prefiero|preferiría) (morir|morirme|matarme|suicidarme|quitarme la vida|acabar con (mi vida|todo)|terminar con (mi vida|todo)|dejar de (vivir|existir))\\b",
      ES_KILL_IDIOM,
    ],
    ["\\bme (quiero|voy a|quisiera|quería|pienso) (morir|matar|suicidar|quitar la vida)\\b", ES_KILL_IDIOM],
    "\\b(quitarme|me quito|me quité) la vida\\b",
    ["\\b(suicidarme|me suicido|matarme)\\b", ES_KILL_IDIOM],
    "\\bno quiero (seguir )?(viviendo|vivir|existir|estar aquí)( más| así)?\\b(?! (en|con|sin|solo|sola|allí|ahí|lejos|cerca|de|para)\\b)",
    "\\b(estar|estuviera) (muerto|muerta)\\b",
    "\\bno haber nacido\\b",
    "\\bmejor sin mí\\b",
    "\\b(soy|siento que soy|me siento) (una|un) (carga|estorbo)\\b",
    "\\b(una carga|un estorbo) para (todos|todo el mundo|mi familia|los demás|mis hijos)\\b",
    "\\b(dormir|dormirme|acostarme) y no (despertar|despertarme)\\b",
    "\\bno (despertar|despertarme) (nunca|más|jamás)\\b",
    "\\b(cansado|cansada|harto|harta|agotado|agotada) de (vivir|la vida|esta vida)\\b",
    "\\bno (tengo|hay|encuentro|le veo|veo) (ninguna |ningún |más )?(razón|razones|motivo|motivos|sentido|ganas) (para|de|a) (vivir|seguir( viviendo| adelante| aquí)?)\\b",
    "\\b(mi|la) vida (ya )?no tiene sentido\\b",
    "\\b(no vale la pena vivir|la vida no vale la pena)\\b",
    "\\b(cortarme|me corto) (las venas|las muñecas|los brazos|a propósito)\\b",
    "\\bautolesi\\w+",
    "\\b(hacerme|me hago|haciéndome) daño (a mí mismo|a mí misma|a propósito)\\b",
    "\\b(guardando|juntando|acumulando) (las |mis |unas |muchas )?(pastillas|medicinas|medicamentos)\\b",
  ]),
  // Portuguese
  ...rules("pt", [
    [
      "\\b(quero|queria|vou|penso em|pensando em|pensei em|vontade de|pretendo|prefiro|preferia) (morrer|me matar|matar-me|me suicidar|suicidar-me|tirar (a )?minha (própria )?vida|acabar com (a )?minha vida|acabar com tudo|dar fim (à|na) minha vida)\\b",
      PT_KILL_IDIOM,
    ],
    ["\\b(me matar|matar-me|me suicidar|suicidar-me)\\b", PT_KILL_IDIOM],
    "\\btirar (a )?minha (própria )?vida\\b",
    "\\bpôr (termo|fim) à (minha )?vida\\b",
    "\\bnão quero (mais )?(viver|existir|estar aqui)( mais)?\\b(?! (em|com|sem|sozinho|sozinha|longe|perto|de|para|pra|no|na)\\b)",
    "\\b(queria|preferia|quero) estar (morto|morta)\\b",
    "\\bnão ter nascido\\b",
    "\\b(melhor|melhores) sem mim\\b",
    "\\b(sou|virei|me sinto|sinto que sou) (um|uma) (peso|fardo|estorvo)\\b",
    "\\b(um peso|um fardo) (pra|para) (todo mundo|todos|toda a gente|a minha família|minha família|os outros|meus filhos)\\b",
    "\\bdormir e (não|nunca) (mais )?acordar\\b",
    "\\b(não acordar (mais|nunca mais)|nunca mais acordar)\\b",
    "\\b(cansado|cansada|farto|farta|exausto|exausta) de viver\\b",
    "\\b(cansado|cansada|farto|farta) da vida\\b",
    "\\bnão (tenho|há|vejo|encontro|tem) (nenhum |nenhuma |mais )?(razão|razões|motivo|motivos|sentido|vontade) (pra|para|de|em) (viver|continuar|seguir)\\b",
    "\\b(minha|a) vida não (tem|faz) (mais )?sentido\\b",
    "\\bnão vale a pena viver\\b",
    "\\b(cortar|cortando|corto) os pulsos\\b",
    "\\bme cort(o|ar|ando) de propósito\\b",
    "\\b(automutila\\w+|autoles\\w+)",
    "\\bme machuc(o|ar|ando) de propósito\\b",
    "\\b(guardando|juntando|acumulando) (os |meus |uns |muitos )?(remédios|comprimidos)\\b",
  ]),
  // French
  ...rules("fr", [
    [
      "\\b(je veux|je voudrais|j'ai envie de|envie de|je vais|je pense à|je songe à|je préférerais) (mourir|me tuer|me suicider|en finir|mettre fin à (mes jours|ma vie)|me foutre en l'air)\\b",
      FR_KILL_IDIOM,
    ],
    ["\\b(me suicider|me tuer)\\b", FR_KILL_IDIOM],
    "\\bmettre fin à (mes jours|ma vie)\\b",
    "\\ben finir avec (la vie|ma vie|tout)\\b",
    "\\bje (ne |n')?veux plus (vivre|être là|exister)\\b(?! (ici|dans|avec|chez|à|en|seul|seule)\\b)",
    "\\bmieux sans moi\\b",
    "\\bj'aimerais (être mort|être morte|ne jamais être né|ne jamais être née)\\b",
    "\\b(je suis|d'être|être) (un fardeau|un poids|une charge)\\b",
    "\\b(un fardeau|un poids) pour (tout le monde|tous|ma famille|les autres|mes proches|mes enfants)\\b",
    "\\b(m'endormir|dormir) et ne (plus )?(jamais )?(me )?réveiller\\b",
    "\\bne (plus|jamais)( jamais)? me réveiller\\b",
    "\\b(envie d'en finir|je vais en finir|je veux en finir)\\b",
    "\\b(fatigué|fatiguée|las|lasse|marre|ras le bol) de (vivre|la vie|cette vie)\\b",
    "\\b(aucune|plus de|pas de|plus aucune) raison de vivre\\b",
    "\\bma vie n'a (plus )?(aucun|de) sens\\b",
    "\\bla vie ne vaut (plus |pas )?la peine\\b",
    "\\b(me scarifi\\w+|scarification\\w*|automutil\\w+)",
    "\\b(me couper|m'ouvrir|me tailler) les veines\\b",
    "\\bme faire du mal\\b",
    "\\b(je garde|j'ai gardé|je mets de côté|j'ai mis de côté|j'accumule) (des|mes|les) (médicaments|cachets|comprimés)\\b",
  ]),
  // Indonesian
  ...rules("id", [
    "\\bbunuh diri\\b",
    `\\b(${ID_WANT}|rasanya ${ID_WANT}|lebih baik|mending|mendingan) (aku |saya |gue |gw )?mati( aja| saja)?\\b`,
    "\\b(mengakhiri|akhiri|ngakhirin|mengakhirin) (hidup|nyawa)(ku| saya| aku|nya)?\\b",
    `\\b${ID_NOT} (mau|ingin|pengen|pengin|sanggup|kuat) hidup( lagi)?\\b`,
    "\\bbeban (buat|bagi|untuk) (semua orang|keluarga|orang lain|orang tua|semuanya|mereka|semua)\\b",
    `\\btidur (dan|terus|lalu|trus|tanpa) ${ID_NOT} (pernah |usah )?bangun( lagi)?\\b`,
    `\\b${ID_NOT} (usah |pernah |mau )?bangun lagi\\b`,
    "\\b(capek|cape|capai|lelah|bosan|bosen|muak) (dengan |sama )?hidup\\b",
    `\\b${ID_NOT} ada (alasan|gunanya|artinya|guna) (lagi )?(untuk |buat )?hidup\\b`,
    `\\bhidup(ku| saya| aku)? (sudah |udah )?${ID_NOT} (ada artinya|berarti|berguna|ada gunanya)\\b`,
    `\\blebih baik (aku|saya|gue|gw) ${ID_NOT} ada\\b`,
    "\\b(menyakiti|nyakitin|melukai|lukai|ngelukain) diri( sendiri|ku)?\\b",
    "\\b(menyayat|nyayat|sayat|menyilet|nyilet|silet) (tangan|pergelangan|nadi|lengan)\\b",
    "\\bpotong (urat )?nadi\\b",
    "\\b(mengumpulkan|ngumpulin|menimbun|nimbun) (obat|pil)\\b",
  ]),
  // Arabic: Modern Standard, Egyptian, Levantine and Gulf forms. No word boundaries (prefixes join).
  ...rules("ar", [
    "انتحر|انتحار|ينتحر|تنتحر|بنتحر|هنتحر",
    "(أريد|أبغى|أبي|عايز|عايزة|عاوز|عاوزة|بدي|نفسي|ودي|أتمنى|حابب|حابة|ناوي|ناوية|أفكر في|بفكر في|أفكر ب) ?(أن |أني |إني |انو |إنه )?(أموت|الموت|موت)",
    "(سأنهي|أنهي|إنهاء|بنهي|هنهي|أخلص من|أتخلص من|أضع حدا ل) ?(حياتي|عمري|نفسي)",
    "(أقتل|بقتل|هقتل|سأقتل|حقتل|أموت|هموت|موت) (نفسي|حالي|روحي)",
    "(لا أريد|ما بدي|مابدي|مش عايز|مش عايزة|مش عاوز|مش عاوزة|ما أبي|ما أبغى|مابي|مو حاب|مش حابب|ما عاد بدي) ?(أن |أني )?(أعيش|العيش|عيش|الحياة|أكمل|أضل عايش|أبقى عايش)",
    "(عبء|عالة) على (الجميع|الكل|أهلي|عائلتي|عيلتي|أسرتي|الناس|غيري|الآخرين|من حولي|اللي حولي|أولادي|زوجي|زوجتي|كل)",
    "(حمل|تقل) (تقيل|ثقيل) على",
    "تقيل على (الكل|أهلي|الناس|كل الناس)",
    "(أنام|نام) ?(و|ثم )?(لا|ما|مش|مو) ?(أستيقظ|أصحى|أصحا|أفيق|أقوم|فيق)",
    "ومصحاش|وما أصحاش|وما أصحى",
    "(تعبت|تعبان|تعبانة|زهقت|زهقان|مليت|مللت|كرهت|سئمت|قرفت|طفشت) (من )?(ال)?(حياة|عيشة|دنيا|حياتي|عيشتي)",
    "(سبب|داعي|معنى|فايدة|فائدة) (للعيش|لعيش|للحياة|لحياتي|أعيش|أني أعيش|أن أعيش|للبقاء|من حياتي|من عيشتي)",
    "حياتي (ما لها|مالها|ملهاش|مالهاش|ليس لها|بلا|بدون) ?(أي )?(معنى|قيمة|طعم|لازمة)",
    "(أؤذي|أذي|بأذي|إيذاء|أجرح|بجرح|أشرط|بشرط|أقطع) (نفسي|حالي|روحي|شراييني|عروقي)",
  ]),
];

/** Wording that may be distress rather than a plan: adds the lines next to a plan. */
export const FOREIGN_SUICIDE_WEAK: LangRule[] = [
  ...rules("es", ["\\b(quiero|quisiera|quería|ganas de) desaparecer\\b", "\\b(ya )?no (puedo|aguanto|soporto) más\\b"]),
  ...rules("pt", ["\\b(quero|queria|vontade de) (sumir|desaparecer)\\b", "\\bnão (aguento|suporto|consigo) mais\\b"]),
  ...rules("fr", ["\\b(je veux|je voudrais|envie de) disparaître\\b", "\\b(je n'en peux plus|j'en peux plus)\\b"]),
  ...rules("id", [
    `\\b${ID_WANT} (menghilang|hilang|lenyap)( saja| aja)?\\b`,
    `\\b(sudah |udah )?${ID_NOT} (kuat|sanggup|tahan) lagi\\b`,
  ]),
  ...rules("ar", [
    "(أريد|بدي|عايز|عايزة|عاوز|نفسي|أبغى|ودي) ?(أن )?(أختفي|الاختفاء)",
    "(لم أعد|ما عدت|مش قادر|مش قادرة|مو قادر|ما عاد فيني|مابقدر|ما بقدر) ?(أحتمل|أتحمل|أستحمل|أكمل)",
  ]),
];

/** Breathless from stress or effort, not choking or an asthma attack. */
const FOREIGN_BREATH_CONTEXT = rx(
  "\\b(ansiedad|ansioso|ansiosa|estrés|pánico|nervios\\w*|cuando corro|escaleras|ejercicio|ansiedade|estresse|nervos\\w*|quando corro|escadas|exercício|anxiété|angoisse\\w*|stress\\w*|panique|quand je cours|escaliers|cemas|panik|stres|gugup|olahraga|lari|tangga)\\b|قلق|توتر|هلع|الدرج|السلم|الرياضة",
);

export const FOREIGN_EMERGENCY: LangRule[] = [
  // Spanish
  ...rules("es", [
    "\\b(dolor|dolores) (muy |tan )?(fuerte |fuertes |intenso |agudo |opresivo |terrible )?(en|de|del) (el |mi |su )?pecho\\b",
    "\\b(presión|opresión) en el pecho\\b",
    "\\b(me|le) duele (mucho )?el pecho\\b",
    "\\b(le|me) está dando un (infarto|ataque al corazón|derrame|ictus|acv)\\b",
    "\\b(creo|parece) que (es|tiene|le está dando|me está dando) un (infarto|ataque al corazón|derrame)\\b",
    ["\\bno (puedo|puede|pueden|podía|logra|logro) respirar\\b", FOREIGN_BREATH_CONTEXT],
    ["\\b(le|me) cuesta (mucho )?respirar\\b", FOREIGN_BREATH_CONTEXT],
    "\\b(no respira|no está respirando|dejó de respirar)\\b",
    "\\b(se está|se|me estoy) (ahogando|asfixiando|atragantando|atragantó)\\b",
    "\\blabios (azules|morados)\\b",
    "\\b(boca|cara) (torcida|chueca|caída|de lado|paralizada)\\b",
    "\\b(se le|se me) (torció|cayó|durmió|paralizó) (la |el |un lado de la )?(boca|cara|brazo)\\b",
    "\\bno (puede|puedo) (levantar|mover) (el|un|su|mi) brazo\\b",
    "\\b(arrastra las palabras|arrastrando las palabras|habla (enredado|raro|trabado|arrastrado)|no puede hablar( bien)?)\\b",
    "\\b(inconsciente|no reacciona|perdió el conocimiento|se desplomó)\\b",
    "\\bno (se )?despierta\\b(?! (temprano|a tiempo|con|hasta|antes)\\b)",
    "\\b(sangra|sangrando|sangrado) (mucho|muchísimo|sin parar|abundante|fuerte|a chorros)\\b",
    "\\bno (para|deja) de sangrar\\b",
    "\\bhemorragia\\b",
    "\\bsobredosis\\b",
    "\\b(tomó|tomé|tragó|tragué) (muchas|demasiadas|todas las|todas sus|un montón de|un frasco de|una caja de) (pastillas|medicinas|medicamentos)\\b",
    "\\bconvulsion\\w*",
  ]),
  // Portuguese
  ...rules("pt", [
    "\\b(dor|dores) (muito |tão )?(forte |fortes |intensa |aguda |terrível )?(no|em|do) (meu |seu )?peito\\b",
    "\\b(aperto|pressão) no peito\\b",
    "\\b(está|estou|tá|tô) (tendo|a ter) um (infarto|enfarte|ataque cardíaco|derrame|avc)\\b",
    "\\b(acho|parece) que (é|está tendo|estou tendo) um (infarto|enfarte|derrame|avc)\\b",
    ["\\bnão (consigo|consegue|conseguem|conseguia|dá para|dá pra) respirar\\b", FOREIGN_BREATH_CONTEXT],
    ["\\bfalta de ar\\b", FOREIGN_BREATH_CONTEXT],
    "\\b(não respira|não está respirando|não tá respirando|parou de respirar)\\b",
    "\\b(se )?(engasgando|engasgado|engasgada|engasgou|sufocando|asfixiando)\\b",
    "\\blábios (roxos|azuis|azulados)\\b",
    "\\b(boca|rosto|cara) (torta|torto|caída|caído|de lado|paralisada|paralisado)\\b",
    "\\bnão (consegue|consigo) (levantar|mexer|mover|erguer) o braço\\b",
    "\\b(fala|falando|voz) (enrolado|enrolada|arrastado|arrastada|embolado|embolada|embaralhada|pastosa)\\b",
    "\\b(inconsciente|desacordado|desacordada|não reage|perdeu a consciência|perdeu os sentidos)\\b",
    "\\bnão acorda\\b(?! (cedo|na hora|a tempo|com|antes|sozinho|sozinha)\\b)",
    "\\b(sangrando|sangra|sangramento) (muito|demais|sem parar|forte|intenso|grave)\\b",
    "\\bnão para de sangrar\\b",
    "\\bhemorragia\\b",
    "\\bsuperdosagem\\b",
    "\\b(tomou|tomei|engoliu|engoli) (muitos|demais|todos os|um monte de|uma caixa de|um vidro de) (remédios|comprimidos)\\b",
    "\\bconvuls\\w+",
  ]),
  // French
  ...rules("fr", [
    "\\b(douleur|douleurs) (très |si )?(forte |fortes |intense |vive |aiguë |violente )?(à|dans) la poitrine\\b",
    "\\b(mal|serrement|oppression|pression) (à|dans) la poitrine\\b",
    "\\bdouleur thoracique\\b",
    "\\b(fait|faire|en train de faire) (une crise cardiaque|un infarctus|un avc)\\b",
    ["\\b(n'arrive|n'arrivent|arrive) (pas|plus) à respirer\\b", FOREIGN_BREATH_CONTEXT],
    ["\\b(ne peut|ne peux|peut|peux) (pas|plus) respirer\\b", FOREIGN_BREATH_CONTEXT],
    ["\\b(du mal|des difficultés|de la peine) à respirer\\b", FOREIGN_BREATH_CONTEXT],
    "\\bne respire (plus|pas)\\b",
    "\\b(s'étouffe|en train de s'étouffer|m'étouffe)\\b",
    "\\blèvres (bleues|violettes)\\b",
    "\\b(bouche|visage) (est |qui )?(tordu|tordue|de travers|tombe|s'affaisse|affaissé|déformé|déformée|paralysé|paralysée)\\b",
    "\\b(n'arrive|arrive) (pas|plus) à (lever|bouger) (le|son|mon) bras\\b",
    "\\bne (peut|peux) (pas|plus) (lever|bouger) (le|son|mon) bras\\b",
    "\\b(n'arrive (pas|plus) à parler|du mal à parler|parle bizarrement|parole pâteuse|élocution (difficile|pâteuse|confuse))\\b",
    "\\b(inconscient|inconsciente|ne réagit (plus|pas)|a perdu connaissance|perdu connaissance|s'est effondré|s'est effondrée)\\b",
    "\\bne répond (plus|pas)\\b(?! (à|au|aux)\\b)",
    "\\bne se réveille (pas|plus)\\b(?! (le matin|à l'heure|tôt)\\b)",
    "\\b(saigne|saignement) (beaucoup|abondamment|abondant|sans arrêt|fort|énormément)\\b",
    "\\bn'arrête pas de saigner\\b",
    "\\bhémorragie\\b",
    "\\bsurdose\\b",
    "\\ba (pris|avalé) (trop de|beaucoup de|tous ses|toute une boîte de|plein de) (médicaments|cachets|comprimés)\\b",
  ]),
  // Indonesian
  ...rules("id", [
    "\\b(nyeri|sakit|sesak|tertekan) (hebat )?(di |pada )?(bagian )?dada\\b",
    "\\bdada(nya| saya| aku|ku)? (terasa |rasanya )?(sakit|nyeri|sesak|tertekan|seperti ditekan|berat)\\b",
    "\\b(kena|terkena|mengalami|sedang) (serangan jantung|stroke)\\b",
    "\\b(gejala|tanda|tanda-tanda|serangan) stroke\\b",
    [`\\b(${ID_NOT}|susah|sulit|sesak) (bisa )?(ber)?na[pf]as\\b`, FOREIGN_BREATH_CONTEXT],
    `\\b(${ID_NOT} berna[pf]as|berhenti berna[pf]as)\\b`,
    "\\btersedak\\b",
    "\\bbibir(nya)? (biru|membiru|kebiruan)\\b",
    "\\b(mulut|wajah|muka|bibir)(nya)? (mencong|perot|miring|merot|menceng|turun sebelah)\\b",
    `\\b(tangan|lengan|kaki)( kanan| kiri)?(nya)? (lemas|lemah|lumpuh|mati rasa|${ID_NOT} bisa (diangkat|digerakkan))\\b`,
    `\\bbicara(nya)? (pelo|cadel|pelat|ngawur|${ID_NOT} jelas)\\b`,
    `\\b(pingsan|${ID_NOT} sadar(kan diri)?|${ID_NOT} merespon[s]?|${ID_NOT} bangun-bangun)\\b`,
    `\\b(ber)?darah(nya)? (banyak|terus|deras|${ID_NOT} berhenti)\\b`,
    "\\b(perdarahan|pendarahan) (hebat|banyak|berat)\\b",
    "\\bminum (obat )?(terlalu banyak|kebanyakan|semua) (obat|pil)\\b",
    "\\bkejang(-kejang)?\\b",
  ]),
  // Arabic
  ...rules("ar", [
    "(ألم|وجع|آلام|ضغط|ضيق|نغزة) ([^ ]+ ){0,2}(في|ب) ?(ال)?صدر",
    "(صدري|صدره|صدرها) (يؤلمني|يؤلمه|يؤلمها|بيوجعني|بيوجعه|بيوجعها|يوجعني|واجعني)",
    ["(لا|ما|مش|مو) ?(عم )?(أستطيع|يستطيع|تستطيع|أقدر|يقدر|تقدر|بقدر|بيقدر|بتقدر|قادر|قادرة|عارف|عارفة) (أن |أني |أنه )?(أ|ي|ت)?تنفس", FOREIGN_BREATH_CONTEXT],
    ["(صعوبة|ضيق|ضيقة) (في |ب)?(ال)?تنفس", FOREIGN_BREATH_CONTEXT],
    "(توقف|وقف) (عن )?(ال)?تنفس|لا يتنفس|مش بيتنفس|ما عم يتنفس|ما يتنفس",
    "يختنق|تختنق|بيختنق|بتختنق|عم يختنق|عم تختنق",
    "شفا(ه|يف)[^ ]* (زرقاء|زرقا|زرق|أزرق)",
    "(وجه|فم|بق|بوز|تم|وش)[^ ]* (مائل|معوج|ملتوي|منحرف|أعوج|مرتخي|نازل)",
    "(اعوجاج|ارتخاء|ميلان|انحراف) (في )?(ال)?(وجه|فم)",
    "(ذراع|يد|إيد|رجل|ساق)[^ ]* (ضعيف|ضعيفة|مشلول|مشلولة|مخدر|مخدرة|خدرانة|ثقيلة|مرتخية)",
    "(لا|ما|مش|مو) ?(يستطيع|تستطيع|يقدر|تقدر|بيقدر|بتقدر|قادر|قادرة|عارف|عارفة) (أن )?(ي|ت)?(رفع|حرك) (ال)?(ذراع|يد|إيد)",
    "(كلام|نطق|حكي)[^ ]* (غير واضح|مش واضح|مو واضح|ثقيل|تقيل|متلعثم|ملخبط|مش مفهوم|غير مفهوم)|يتلعثم|تتلعثم|بيتلعثم",
    "(فاقد|فاقدة|فقد|فقدت) (ال)?وعي|مغمى علي|أغمي علي|غايب عن الوعي|لا يستجيب|لا يستيقظ|ما بيصحى",
    "(ينزف|تنزف|بينزف|بتنزف|نزيف|نزف) ([^ ]+ )?(بشدة|شديد|حاد|كثير|كتير|بغزارة|جامد|قوي|ما بيوقف|لا يتوقف|مش بيقف)",
    "جرعة (زائدة|زايدة)",
    "(أخذ|أخد|أخذت|أخدت|ابتلع|بلع|بلعت|تناول|تناولت) ([^ ]+ )?(كثير|كتير|كل|علبة|شريط) ([^ ]+ )?(حبوب|دواء|أدوية|برشام|أقراص)",
    "تشنج|نوبة صرع",
  ]),
];

/** Emergency words that are often not an emergency happening now: add the lines next to a plan. */
export const FOREIGN_EMERGENCY_WEAK: LangRule[] = [
  ...rules("es", ["\\b(infarto|ataque al corazón|derrame cerebral|ictus|se desmayó|desmayo)\\b"]),
  ...rules("pt", ["\\b(infarto|enfarte|ataque cardíaco|derrame|avc|desmaiou|desmaio)\\b"]),
  ...rules("fr", ["\\b(crise cardiaque|infarctus|avc|s'est évanoui|s'est évanouie|évanouissement)\\b"]),
  // Not "stroke" on its own: it is also the English word ("recovering from a stroke").
  ...rules("id", ["\\bserangan jantung\\b"]),
  ...rules("ar", ["(نوبة|جلطة|أزمة|سكتة) (قلبية|دماغية)|ذبحة صدرية|جلطة"]),
];

/** Figures of speech removed before screening ("me muero de risa", "morrendo de fome", "mati lampu"). */
export const FOREIGN_IDIOMS: RegExp[] = [
  rx(
    "\\b(me muero|me estoy muriendo|me moría|muriendo|muerto|muerta|morir|morirme) de (la )?(risa|hambre|sueño|ganas|vergüenza|calor|frío|cansancio|miedo|sed|aburrimiento|amor|envidia|pena|nervios|curiosidad)\\b",
    "g",
  ),
  rx("\\b(casi|por poco) me (da|dio) (un infarto|un ataque|algo)\\b", "g"),
  rx("\\bme (dio|da|va a dar) (un infarto|algo) (cuando|al ver|de la risa|del susto)\\b", "g"),
  rx(
    "\\b(morrendo|morro|morri|morrer|morta|morto) de (fome|rir|riso|sono|saudade|saudades|vontade|calor|frio|medo|cansaço|sede|vergonha|tédio|amor|amores|inveja|curiosidade|ansiedade)\\b",
    "g",
  ),
  rx("\\bquase (tive|tenho|me deu) um (infarto|enfarte|ataque|troço)\\b", "g"),
  rx("\\bmatar (a |as )?(saudade|saudades|fome|sede|tempo|aula)\\b", "g"),
  rx("\\b(mort|morte|mourir|meurs|crève|crever) de (rire|faim|fatigue|soif|honte|peur|froid|chaud|ennui|trouille|sommeil)\\b", "g"),
  rx("\\b(j'ai )?failli (faire|avoir) (une crise cardiaque|un infarctus)\\b", "g"),
  rx("\\btu me tues\\b", "g"),
  rx("\\bmati (lampu|listrik|gaya|rasa|kutu|suri|air)\\b", "g"),
  rx("\\b(setengah mati|mati-matian)\\b", "g"),
  rx("\\b(ketawa|ngakak|lapar|laper|ngantuk|malu|kangen|bosan|bosen|takut|capek|cape) (sampai |setengah )?mati\\b", "g"),
  rx("\\b(hampir|nyaris|bikin|hampir kena) (serangan jantung|jantungan)\\b", "g"),
  rx("(أموت|هموت|حموت|بموت|رح موت|ميت|ميتة|متنا|مت) من (ال)?(ضحك|جوع|تعب|حر|برد|خوف|زهق|ملل|نعس|عطش|فرح)", "g"),
  rx("(بموت|أموت|هموت) (فيك|فيكي|فيه|فيها|عليك|عليكي)", "g"),
];

/** A past event, not something happening now ("el año pasado", "há dois anos", "tahun lalu"). */
export const FOREIGN_PAST = rx(
  "\\b(el año pasado|el mes pasado|la semana pasada|hace (\\w+ )?(años|meses|semanas)|hace tiempo|solía|cuando era (joven|niño|niña|adolescente)|en el pasado|se está recuperando|recuperándose|ya se recuperó" +
    "|ano passado|mês passado|semana passada|(há|faz) (\\w+ )?(anos|meses|semanas)|anos atrás|meses atrás|antigamente|costumava|quando era (jovem|criança|adolescente)|no passado|se recuperando|em recuperação|já se recuperou" +
    "|l'année dernière|l'an dernier|le mois dernier|la semaine dernière|il y a (\\w+ )?(ans|mois|semaines|longtemps)|autrefois|quand j'étais (jeune|ado|adolescent|adolescente)|dans le passé|se remet|en convalescence|s'est remis|s'est remise" +
    "|(\\w+ )?(tahun|bulan|minggu) (yang )?lalu|dulu|dahulu|waktu (kecil|muda|remaja|sma|smp)|pernah (mencoba|coba)|sudah (sembuh|pulih)|masa lalu)\\b" +
    "|العام الماضي|السنة الماضية|السنة اللي فاتت|الشهر الماضي|الأسبوع الماضي|قبل (سنوات|سنين|سنة|شهور|أشهر|أسابيع)|من (سنين|زمان|سنوات)|في الماضي|لما كنت (صغير|صغيرة)|يتعافى|تتعافى|بيتعافى|بتتعافى|تعافى",
);

/** ...unless it's also happening now. */
export const FOREIGN_PRESENT = rx(
  "\\b(ahora|ahora mismo|esta noche|hoy|otra vez|de nuevo|en este momento|agora|hoje|esta noite|de novo|outra vez|neste momento|maintenant|ce soir|aujourd'hui|encore|en ce moment|sekarang|malam ini|hari ini|saat ini)\\b" +
    "|الآن|الليلة|اليوم|حاليا|دلوقتي|هلق|هلأ|مرة (ثانية|تانية)",
);

/** A song, film or book title or quote, not the person's own words. */
export const FOREIGN_QUOTE = rx(
  "\\b(canción|canciones|película|libro|novela|poema|música|filme|livro|chanson|paroles|film|livre|roman|poème|lagu|lirik|buku|novel|sinetron|puisi|judul)\\b|أغنية|فيلم|كتاب|رواية|مسلسل|قصيدة",
);

/** Words that show the message is also about everyday care: a plan can go next to the lines. */
export const FOREIGN_CARE = rx(
  "\\b(mamá|madre|papá|padre|abuelo|abuela|hijo|hija|esposo|esposa|marido|pareja|amigo|amiga|hermano|hermana|familia|trabajo|estrés|rutina|ejercicio|caminar|estudios|exámenes" +
    "|mãe|pai|avó|avô|filho|filha|esposa|amiga|irmão|irmã|família|trabalho|estresse|rotina|exercício|caminhar|estudos|provas" +
    "|mère|père|maman|grand-mère|grand-père|fils|fille|mari|femme|ami|amie|frère|sœur|famille|travail|stress|routine|exercice|marcher|études|examens" +
    "|ibu|ayah|bapak|nenek|kakek|anak|suami|istri|teman|kakak|adik|keluarga|kerja|kerjaan|pekerjaan|stres|rutinitas|olahraga|kuliah|sekolah|ujian)\\b" +
    "|أمي|والدي|والدتي|جدتي|جدي|ابني|بنتي|زوجي|زوجتي|صديق|أخي|أختي|عائلتي|العمل|الشغل|روتين|دراسة|امتحان",
);

/** Sentence and clause breaks, including Arabic punctuation and "but" in each language. */
export const FOREIGN_CLAUSE_SPLIT = rx("[.!?;,\\n،؛؟]+|\\b(?:pero|porém|tapi|tetapi|namun)\\b|لكن");

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

/** Common words per language (folded), enough to tell a short message's language. */
const LANG_WORDS: Record<Exclude<CrisisLang, "ar">, Set<string>> = {
  en: new Set(
    "the a an i i'm my me you your is am are was to of and in it that this have has for with not but on do want can't don't he she his her mum mom dad feel been what how".split(" "),
  ),
  es: new Set(
    foldText(
      "el los las una y que en no me mi mis tu es está estoy tengo tiene para por con pero como muy más ya quiero hace todo todos siento solo se lo le su al del yo nunca puedo puede qué hago mamá papá vida morir dolor pecho respirar desaparecer aguanto noche",
    ).split(" "),
  ),
  pt: new Set(
    foldText(
      "o os as um uma e que em não me meu minha você está estou tenho tem para pra por com mas como muito mais já quero queria faz tudo todos sinto só se do da no na eu nunca posso consigo consegue faço mãe pai vida morrer sumir dor peito respirar aguento hoje noite",
    ).split(" "),
  ),
  fr: new Set(
    foldText(
      "le la les un une des que et en ne pas plus je j'ai me mon ma mes tu est suis ai pour par avec mais comme très veux fait tout tous au du il elle on ce que faire mère père vie mourir douleur poitrine respirer disparaître",
    ).split(" "),
  ),
  id: new Set(
    "aku saya kamu yang dan di ke dari ini itu tidak nggak gak ga sudah udah mau ingin pengen pengin bisa ada untuk buat dengan sama lagi jadi karena tapi juga akan orang rasanya aja saja banget ibu ayah hidup mati capek tidur bunuh diri sakit dada napas harus bagaimana malam".split(
      " ",
    ),
  ),
};

const SUPPORTED_LANGS = new Set<string>(["en", "es", "pt", "ar", "id", "fr"]);

/** The supported language of a browser locale ("pt-BR" → pt, "in" → id), or null. */
export function languageFromLocale(locale: string | null | undefined): CrisisLang | null {
  const lang = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
  if (lang === "in") return "id";
  return SUPPORTED_LANGS.has(lang) ? (lang as CrisisLang) : null;
}

/**
 * The language to answer a message in: its script (Arabic) or its commonest words, then the rule
 * that caught it (`hint`), then the browser language, then English.
 */
export function messageLanguage(text: string, locale?: string | null, hint?: CrisisLang | null): CrisisLang {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const arabic = (text.match(ARABIC_SCRIPT) ?? []).length;
  if (arabic >= 2 && arabic / Math.max(letters, 1) >= 0.3) return "ar";

  const tokens = foldText(text).match(/[a-z']+/g) ?? [];
  let best: CrisisLang | null = null;
  let bestScore = 0;
  let tie = false;
  for (const lang of Object.keys(LANG_WORDS) as Array<Exclude<CrisisLang, "ar">>) {
    const score = tokens.filter((w) => LANG_WORDS[lang].has(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  if (best && !tie) return best;
  return hint ?? languageFromLocale(locale) ?? best ?? "en";
}
