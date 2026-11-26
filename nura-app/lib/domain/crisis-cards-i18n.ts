import type { CrisisLang } from "@/lib/domain/crisis-screen-i18n";

/**
 * The crisis and emergency cards in Spanish, Portuguese, French, Indonesian and Arabic (26 Nov
 * 2026: the cards were fixed English text that led with UK numbers for every other country).
 * English wording lives in crisis-lines.ts. Numbers are passed in; none are written here.
 *
 * `call` is the crisis line clause from `callLine` (null when the country has no verified line);
 * `emergency` is the emergency number(s) (null when the country is unknown or unsupported, which
 * always reads "your local emergency number" plus findahelpline.com, never another country's number).
 */
export type CardStrings = {
  dir: "ltr" | "rtl";
  /** Joins two emergency numbers ("112 o 999"). */
  or: string;
  callLine: (name: string | undefined, number: string) => string;
  suicide: {
    title: string;
    lead: (call: string | null, emergency: string | null) => string;
    tablets: string;
    someoneElse: string;
  };
  emergency: {
    title: string;
    lead: (emergency: string | null) => string;
    cantHelp: string;
  };
  alongside: {
    suicideTitle: string;
    suicideLead: (call: string | null, emergency: string | null) => string;
    emergencyTitle: string;
    emergencyLead: (emergency: string | null) => string;
  };
  /** Shown when the country is known, for someone who is travelling. */
  elsewhere: string;
  /** One quiet line under a "write a little more" or off-topic nudge. */
  help: (emergency: string | null) => string;
  labels: CrisisLabels;
};

/** The card's fixed words, so the whole card is in one language. */
export type CrisisLabels = {
  tagSuicide: string;
  tagEmergency: string;
  back: string;
  notEmergency: string;
  fineprint: string;
};

export const FIND_A_HELPLINE = "https://findahelpline.com";

export const EN_LABELS: CrisisLabels = {
  tagSuicide: "You’re not alone",
  tagEmergency: "Get help now",
  back: "Go back",
  notEmergency: "It isn’t an emergency: show me the plan",
  fineprint: "Nura is a wellbeing companion, not an emergency service.",
};

export const CARD_STRINGS: Record<Exclude<CrisisLang, "en">, CardStrings> = {
  es: {
    dir: "ltr",
    or: " o ",
    callLine: (name, number) => (name ? `llama a ${name} al ${number}` : `llama al ${number}`),
    suicide: {
      title: "Me alegra mucho que me lo hayas contado. No tienes que pasar por esto sin ayuda.",
      lead: (call, emergency) =>
        !emergency
          ? `Por favor, pide ayuda ahora mismo: llama al número de emergencias de tu país si estás en peligro o has tomado algo, y busca una línea de ayuda gratuita en tu país en ${FIND_A_HELPLINE}.`
          : call
            ? `Por favor, pide ayuda ahora mismo: ${call} (a cualquier hora), o llama al ${emergency} si estás en peligro ahora mismo o has tomado algo.`
            : `Por favor, pide ayuda ahora mismo: llama al ${emergency} si estás en peligro ahora mismo o has tomado algo, y cuéntaselo a alguien de confianza que pueda estar contigo.`,
      tablets: "Si has guardado pastillas, ponlas fuera de tu alcance o dáselas a alguien, y cuéntale a alguien de confianza cómo te sientes.",
      someoneElse: "Si se trata de otra persona, quédate con ella si puedes y pide ayuda ahora.",
    },
    emergency: {
      title: "Esto parece necesitar ayuda ahora mismo.",
      lead: (emergency) =>
        emergency
          ? `Llama al ${emergency} ahora mismo, o pide a alguien que esté contigo que llame.`
          : "Llama ahora mismo al número de emergencias de tu país, o pide a alguien que esté contigo que llame.",
      cantHelp: "Nura no puede ayudar en una emergencia. No esperes a ver si se pasa.",
    },
    alongside: {
      suicideTitle: "Si ahora mismo sientes que es demasiado",
      suicideLead: (call, emergency) =>
        "Si tienes pensamientos de suicidio o de hacerte daño, o te preocupa que alguien los tenga: " +
        (!emergency
          ? `llama al número de emergencias de tu país si hay peligro inmediato, y busca una línea de ayuda gratuita en ${FIND_A_HELPLINE}.`
          : call
            ? `${call} (a cualquier hora), o llama al ${emergency} si hay peligro inmediato.`
            : `llama al ${emergency} si hay peligro inmediato, y cuéntaselo a alguien de confianza.`),
      emergencyTitle: "Si esto está pasando ahora",
      emergencyLead: (emergency) =>
        emergency
          ? `Si alguien necesita ayuda ahora mismo, llama al ${emergency}, o pide a alguien que esté contigo que llame.`
          : "Si alguien necesita ayuda ahora mismo, llama al número de emergencias de tu país, o pide a alguien que esté contigo que llame.",
    },
    elsewhere: "Si estás en otro país, llama al número de emergencias local.",
    help: (emergency) =>
      `Si tú u otra persona están en peligro o pensando en el suicidio, llama ${emergency ? `al ${emergency}` : "al número de emergencias de tu país"} ahora, o busca una línea de ayuda gratuita en ${FIND_A_HELPLINE}.`,
    labels: {
      tagSuicide: "No tienes que pasar por esto sin ayuda",
      tagEmergency: "Pide ayuda ahora",
      back: "Volver",
      notEmergency: "No es una emergencia: muéstrame el plan",
      fineprint: "Nura es una compañía de bienestar, no un servicio de emergencias.",
    },
  },
  pt: {
    dir: "ltr",
    or: " ou ",
    callLine: (name, number) => (name ? `ligue para o ${name} no ${number}` : `ligue para o ${number}`),
    suicide: {
      title: "Que bom que você me contou. Você não precisa passar por isso sem ajuda.",
      lead: (call, emergency) =>
        !emergency
          ? `Por favor, peça ajuda agora: ligue para o número de emergência do seu país se estiver em perigo ou tiver tomado alguma coisa, e procure uma linha de apoio gratuita no seu país em ${FIND_A_HELPLINE}.`
          : call
            ? `Por favor, peça ajuda agora: ${call} (a qualquer hora), ou ligue para o ${emergency} se você estiver em perigo agora ou tiver tomado alguma coisa.`
            : `Por favor, peça ajuda agora: ligue para o ${emergency} se você estiver em perigo agora ou tiver tomado alguma coisa, e conte para alguém de confiança que possa ficar com você.`,
      tablets: "Se você guardou comprimidos, deixe-os fora do alcance ou entregue a alguém, e conte para alguém de confiança como você está se sentindo.",
      someoneElse: "Se for sobre outra pessoa, fique com ela se puder e peça ajuda agora.",
    },
    emergency: {
      title: "Isso parece precisar de ajuda agora.",
      lead: (emergency) =>
        emergency
          ? `Ligue para o ${emergency} agora, ou peça para alguém que esteja com você ligar.`
          : "Ligue agora para o número de emergência do seu país, ou peça para alguém que esteja com você ligar.",
      cantHelp: "A Nura não pode ajudar em uma emergência. Não espere para ver se passa.",
    },
    alongside: {
      suicideTitle: "Se as coisas estiverem pesadas demais agora",
      suicideLead: (call, emergency) =>
        "Se você estiver pensando em suicídio ou em se machucar, ou se preocupa com alguém nessa situação: " +
        (!emergency
          ? `ligue para o número de emergência do seu país se houver perigo imediato, e procure uma linha de apoio gratuita em ${FIND_A_HELPLINE}.`
          : call
            ? `${call} (a qualquer hora), ou ligue para o ${emergency} se houver perigo imediato.`
            : `ligue para o ${emergency} se houver perigo imediato, e conte para alguém de confiança.`),
      emergencyTitle: "Se isso estiver acontecendo agora",
      emergencyLead: (emergency) =>
        emergency
          ? `Se alguém precisar de ajuda agora, ligue para o ${emergency}, ou peça para alguém que esteja com você ligar.`
          : "Se alguém precisar de ajuda agora, ligue para o número de emergência do seu país, ou peça para alguém que esteja com você ligar.",
    },
    elsewhere: "Se você estiver em outro país, ligue para o número de emergência local.",
    help: (emergency) =>
      `Se você ou outra pessoa estiver em perigo ou pensando em suicídio, ligue agora para ${emergency ? `o ${emergency}` : "o número de emergência do seu país"}, ou procure uma linha de apoio gratuita em ${FIND_A_HELPLINE}.`,
    labels: {
      tagSuicide: "Você não precisa passar por isso sem ajuda",
      tagEmergency: "Peça ajuda agora",
      back: "Voltar",
      notEmergency: "Não é uma emergência: mostre o plano",
      fineprint: "A Nura é uma companhia de bem-estar, não um serviço de emergência.",
    },
  },
  fr: {
    dir: "ltr",
    or: " ou ",
    callLine: (name, number) => (name ? `appelez ${name} au ${number}` : `appelez le ${number}`),
    suicide: {
      title: "Merci de me l’avoir dit. Vous n’avez pas à traverser cela sans aide.",
      lead: (call, emergency) =>
        !emergency
          ? `Demandez de l’aide tout de suite : appelez le numéro d’urgence de votre pays si vous êtes en danger ou si vous avez pris quelque chose, et trouvez une ligne d’écoute gratuite dans votre pays sur ${FIND_A_HELPLINE}.`
          : call
            ? `Demandez de l’aide tout de suite : ${call} (à toute heure), ou appelez le ${emergency} si vous êtes en danger maintenant ou si vous avez pris quelque chose.`
            : `Demandez de l’aide tout de suite : appelez le ${emergency} si vous êtes en danger maintenant ou si vous avez pris quelque chose, et parlez-en à une personne de confiance qui peut rester avec vous.`,
      tablets: "Si vous avez mis des médicaments de côté, mettez-les hors de portée ou confiez-les à quelqu’un, et dites à une personne de confiance ce que vous ressentez.",
      someoneElse: "S’il s’agit de quelqu’un d’autre, restez avec cette personne si vous le pouvez et appelez les secours maintenant.",
    },
    emergency: {
      title: "Cela semble nécessiter de l’aide tout de suite.",
      lead: (emergency) =>
        emergency
          ? `Appelez le ${emergency} tout de suite, ou demandez à quelqu’un près de vous d’appeler.`
          : "Appelez tout de suite le numéro d’urgence de votre pays, ou demandez à quelqu’un près de vous d’appeler.",
      cantHelp: "Nura ne peut pas aider en cas d’urgence. N’attendez pas de voir si ça passe.",
    },
    alongside: {
      suicideTitle: "Si c’est trop lourd en ce moment",
      suicideLead: (call, emergency) =>
        "Si vous avez des pensées suicidaires ou envie de vous faire du mal, ou si vous vous inquiétez pour quelqu’un : " +
        (!emergency
          ? `appelez le numéro d’urgence de votre pays en cas de danger immédiat, et trouvez une ligne d’écoute gratuite sur ${FIND_A_HELPLINE}.`
          : call
            ? `${call} (à toute heure), ou appelez le ${emergency} en cas de danger immédiat.`
            : `appelez le ${emergency} en cas de danger immédiat, et parlez-en à une personne de confiance.`),
      emergencyTitle: "Si cela se passe maintenant",
      emergencyLead: (emergency) =>
        emergency
          ? `Si quelqu’un a besoin d’aide tout de suite, appelez le ${emergency}, ou demandez à quelqu’un près de vous d’appeler.`
          : "Si quelqu’un a besoin d’aide tout de suite, appelez le numéro d’urgence de votre pays, ou demandez à quelqu’un près de vous d’appeler.",
    },
    elsewhere: "Si vous êtes dans un autre pays, appelez le numéro d’urgence local.",
    help: (emergency) =>
      `Si vous ou quelqu’un d’autre êtes en danger ou pensez au suicide, appelez ${emergency ? `le ${emergency}` : "le numéro d’urgence de votre pays"} maintenant, ou trouvez une ligne d’écoute gratuite sur ${FIND_A_HELPLINE}.`,
    labels: {
      tagSuicide: "Vous n’avez pas à traverser cela sans aide",
      tagEmergency: "Demandez de l’aide maintenant",
      back: "Retour",
      notEmergency: "Ce n’est pas une urgence : montrez-moi le plan",
      fineprint: "Nura est un compagnon de bien-être, pas un service d’urgence.",
    },
  },
  id: {
    dir: "ltr",
    or: " atau ",
    callLine: (name, number) => (name ? `hubungi ${name} di ${number}` : `hubungi ${number}`),
    suicide: {
      title: "Terima kasih sudah bercerita. Kamu tidak harus menghadapi ini sendirian.",
      lead: (call, emergency) =>
        !emergency
          ? `Tolong cari bantuan sekarang juga: hubungi nomor darurat di negaramu kalau kamu dalam bahaya atau sudah menelan sesuatu, dan cari layanan bantuan gratis di negaramu di ${FIND_A_HELPLINE}.`
          : call
            ? `Tolong cari bantuan sekarang juga: ${call} (kapan saja), atau hubungi ${emergency} kalau kamu dalam bahaya sekarang atau sudah menelan sesuatu.`
            : `Tolong cari bantuan sekarang juga: hubungi ${emergency} kalau kamu dalam bahaya sekarang atau sudah menelan sesuatu, dan ceritakan kepada orang yang kamu percaya dan bisa menemanimu.`,
      tablets: "Kalau kamu menyimpan obat, jauhkan dari jangkauan atau titipkan ke orang lain, dan ceritakan perasaanmu kepada orang yang kamu percaya.",
      someoneElse: "Kalau ini tentang orang lain, temani dia kalau bisa dan segera minta bantuan.",
    },
    emergency: {
      title: "Sepertinya ini butuh bantuan sekarang juga.",
      lead: (emergency) =>
        emergency
          ? `Hubungi ${emergency} sekarang juga, atau minta orang di dekatmu untuk menelepon.`
          : "Hubungi nomor darurat di negaramu sekarang juga, atau minta orang di dekatmu untuk menelepon.",
      cantHelp: "Nura tidak bisa membantu dalam keadaan darurat. Jangan menunggu sampai membaik sendiri.",
    },
    alongside: {
      suicideTitle: "Kalau saat ini terasa terlalu berat",
      suicideLead: (call, emergency) =>
        "Kalau kamu punya pikiran untuk bunuh diri atau menyakiti diri, atau khawatir tentang seseorang: " +
        (!emergency
          ? `hubungi nomor darurat di negaramu kalau ada bahaya, dan cari layanan bantuan gratis di ${FIND_A_HELPLINE}.`
          : call
            ? `${call} (kapan saja), atau hubungi ${emergency} kalau ada bahaya.`
            : `hubungi ${emergency} kalau ada bahaya, dan ceritakan kepada orang yang kamu percaya.`),
      emergencyTitle: "Kalau ini sedang terjadi sekarang",
      emergencyLead: (emergency) =>
        emergency
          ? `Kalau ada yang butuh bantuan sekarang, hubungi ${emergency}, atau minta orang di dekatmu untuk menelepon.`
          : "Kalau ada yang butuh bantuan sekarang, hubungi nomor darurat di negaramu, atau minta orang di dekatmu untuk menelepon.",
    },
    elsewhere: "Kalau kamu berada di negara lain, hubungi nomor darurat setempat.",
    help: (emergency) =>
      `Kalau kamu atau orang lain dalam bahaya atau berpikir untuk bunuh diri, hubungi ${emergency ?? "nomor darurat di negaramu"} sekarang, atau cari layanan bantuan gratis di ${FIND_A_HELPLINE}.`,
    labels: {
      tagSuicide: "Kamu tidak sendirian",
      tagEmergency: "Cari bantuan sekarang",
      back: "Kembali",
      notEmergency: "Ini bukan keadaan darurat: tampilkan rencananya",
      fineprint: "Nura adalah teman kesejahteraan, bukan layanan darurat.",
    },
  },
  ar: {
    dir: "rtl",
    or: " أو ",
    callLine: (name, number) => (name ? `اتصل بـ ${name} على الرقم ${number}` : `اتصل بالرقم ${number}`),
    suicide: {
      title: "شكراً لأنك أخبرتني. لست مضطراً لمواجهة هذا وحدك.",
      lead: (call, emergency) =>
        !emergency
          ? `من فضلك اطلب المساعدة الآن: اتصل برقم الطوارئ المحلي في بلدك إذا كنت في خطر أو تناولت شيئاً، وابحث عن خط مساعدة مجاني في بلدك على ${FIND_A_HELPLINE}`
          : call
            ? `من فضلك اطلب المساعدة الآن: ${call} (في أي وقت)، أو اتصل بالرقم ${emergency} إذا كنت في خطر الآن أو تناولت شيئاً.`
            : `من فضلك اطلب المساعدة الآن: اتصل بالرقم ${emergency} إذا كنت في خطر الآن أو تناولت شيئاً، وأخبر شخصاً تثق به ليكون معك.`,
      tablets: "إذا كنت قد جمعت حبوباً أو أدوية، ضعها بعيداً عن متناولك أو أعطها لشخص آخر، وأخبر شخصاً تثق به بما تشعر به.",
      someoneElse: "إذا كان الأمر يخص شخصاً آخر، ابقَ معه إن استطعت واطلب المساعدة الآن.",
    },
    emergency: {
      title: "يبدو أن هذا يحتاج إلى مساعدة الآن.",
      lead: (emergency) =>
        emergency
          ? `اتصل بالرقم ${emergency} الآن، أو اطلب من شخص بجانبك أن يتصل.`
          : "اتصل الآن برقم الطوارئ المحلي في بلدك، أو اطلب من شخص بجانبك أن يتصل.",
      cantHelp: "لا تستطيع Nura المساعدة في حالات الطوارئ. لا تنتظر لترى إن كان الأمر سيزول.",
    },
    alongside: {
      suicideTitle: "إذا شعرت أن الأمور فوق طاقتك الآن",
      suicideLead: (call, emergency) =>
        "إذا كانت تراودك أفكار عن الانتحار أو إيذاء النفس، أو كنت قلقاً على شخص آخر: " +
        (!emergency
          ? `اتصل برقم الطوارئ المحلي في بلدك إذا كان هناك خطر، وابحث عن خط مساعدة مجاني على ${FIND_A_HELPLINE}`
          : call
            ? `${call} (في أي وقت)، أو اتصل بالرقم ${emergency} إذا كان هناك خطر.`
            : `اتصل بالرقم ${emergency} إذا كان هناك خطر، وأخبر شخصاً تثق به.`),
      emergencyTitle: "إذا كان هذا يحدث الآن",
      emergencyLead: (emergency) =>
        emergency
          ? `إذا كان أحد يحتاج إلى مساعدة الآن، اتصل بالرقم ${emergency}، أو اطلب من شخص بجانبك أن يتصل.`
          : "إذا كان أحد يحتاج إلى مساعدة الآن، اتصل برقم الطوارئ المحلي في بلدك، أو اطلب من شخص بجانبك أن يتصل.",
    },
    elsewhere: "إذا كنت في بلد آخر، اتصل برقم الطوارئ المحلي.",
    help: (emergency) =>
      `إذا كنت أنت أو شخص آخر في خطر أو تفكر في الانتحار، اتصل ${emergency ? `بالرقم ${emergency}` : "برقم الطوارئ المحلي في بلدك"} الآن، أو ابحث عن خط مساعدة مجاني على ${FIND_A_HELPLINE}`,
    labels: {
      tagSuicide: "لست وحدك",
      tagEmergency: "اطلب المساعدة الآن",
      back: "رجوع",
      notEmergency: "ليست حالة طارئة: أرني الخطة",
      fineprint: "Nura رفيق للعافية، وليست خدمة طوارئ.",
    },
  },
};
