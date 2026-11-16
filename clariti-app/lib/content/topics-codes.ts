/**
 * "<code> meaning" pages (wave 3, 16 Nov 2026): one /guides page per billing code
 * people actually type into search — "cpt 99214" alone is 8,100 searches a month
 * worldwide (Keyword Planner, Nov 2025–Oct 2026), and Google autocomplete fills
 * "cpt 99…", "cpt 8…", "cpt 9…" with exactly these codes.
 *
 * Rules on top of topics.ts:
 * - CPT descriptors are AMA copyright. Paraphrase what a code covers in plain words;
 *   never paste the official descriptor.
 * - Facts about levels, times and add-ons come from the CMS and AMA pages listed in
 *   each page's sources (E/M times: 2021 AMA office-visit guidelines as CMS's MLN
 *   E/M guide applies them; timed therapy units: Medicare Claims Processing Manual
 *   ch. 5; G2211: CMS's G2211 FAQ).
 * - Never quote a price as what someone will pay. Point to the CMS fee schedule
 *   look-up and the person's own EOB instead.
 * - Imports from topics.ts are type-only (topics.ts spreads this list into TOPICS).
 */

import { SHOT_BILL_CHARGES } from "@/lib/content/guide-shots";
import type { TopicGuide, TopicSource } from "@/lib/content/topics";

const S = {
  ama: { label: "AMA — CPT code overview", url: "https://www.ama-assn.org/practice-management/cpt/cpt-overview-and-code-approval" },
  amaEm: { label: "AMA — CPT evaluation and management (E/M) guidelines", url: "https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management" },
  hcpcs: { label: "CMS.gov — HCPCS (CPT and Level II codes)", url: "https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system" },
  emGuide: { label: "CMS MLN — Evaluation and Management Services Guide", url: "https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf" },
  pfs: { label: "CMS.gov — Physician Fee Schedule look-up tool", url: "https://www.cms.gov/medicare/physician-fee-schedule/search" },
  clfs: { label: "CMS.gov — Clinical Laboratory Fee Schedule", url: "https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory-fee-schedule-clfs" },
  g2211: { label: "CMS — HCPCS add-on code G2211 FAQ", url: "https://www.cms.gov/files/document/hcpcs-g2211-faq.pdf" },
  preventive: { label: "HealthCare.gov — Preventive care benefits", url: "https://www.healthcare.gov/coverage/preventive-care-benefits/" },
  wellness: { label: "Medicare.gov — Yearly “Wellness” visits", url: "https://www.medicare.gov/coverage/yearly-wellness-visits" },
  welcome: { label: "Medicare.gov — “Welcome to Medicare” preventive visit", url: "https://www.medicare.gov/coverage/welcome-to-medicare-preventive-visit" },
  venipuncture: { label: "MedlinePlus — Venipuncture", url: "https://medlineplus.gov/ency/article/003423.htm" },
  cbc: { label: "MedlinePlus — Complete blood count (CBC)", url: "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/" },
  cmp: { label: "MedlinePlus — Comprehensive metabolic panel (CMP)", url: "https://medlineplus.gov/lab-tests/comprehensive-metabolic-panel-cmp/" },
  bmp: { label: "MedlinePlus — Basic metabolic panel (BMP)", url: "https://medlineplus.gov/lab-tests/basic-metabolic-panel-bmp/" },
  cholesterol: { label: "MedlinePlus — Cholesterol levels", url: "https://medlineplus.gov/lab-tests/cholesterol-levels/" },
  cvScreen: { label: "Medicare.gov — Cardiovascular disease screenings", url: "https://www.medicare.gov/coverage/cardiovascular-disease-screenings" },
  a1c: { label: "MedlinePlus — Hemoglobin A1C (HbA1c) test", url: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/" },
  diabetesScreen: { label: "Medicare.gov — Diabetes screenings", url: "https://www.medicare.gov/coverage/diabetes-screenings" },
  vitD: { label: "MedlinePlus — Vitamin D test", url: "https://medlineplus.gov/lab-tests/vitamin-d-test/" },
  abn: { label: "CMS.gov — Advance Beneficiary Notice of Non-coverage (ABN)", url: "https://www.cms.gov/medicare/medicare-general-information/bni/abn" },
  ecg: { label: "MedlinePlus — Electrocardiogram", url: "https://medlineplus.gov/ency/article/003868.htm" },
  chestXray: { label: "MedlinePlus — Chest x-ray", url: "https://medlineplus.gov/ency/article/003804.htm" },
  biopsy: { label: "National Cancer Institute — Biopsy (definition)", url: "https://www.cancer.gov/publications/dictionaries/cancer-terms/def/biopsy" },
  billRights: { label: "CMS.gov — Medical bill rights (No Surprises Act)", url: "https://www.cms.gov/medical-bill-rights" },
  psychotherapy: { label: "NIMH — Psychotherapies", url: "https://www.nimh.nih.gov/health/topics/psychotherapies" },
  medicareMh: { label: "Medicare.gov — Outpatient mental health coverage", url: "https://www.medicare.gov/coverage/mental-health-care-outpatient" },
  therapyUnits: {
    label: "CMS — Medicare Claims Processing Manual, ch. 5 (timed therapy codes)",
    url: "https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/clm104c05.pdf",
  },
  pt: { label: "Medicare.gov — Physical therapy coverage", url: "https://www.medicare.gov/coverage/physical-therapy-services" },
} satisfies Record<string, TopicSource>;

type CodeInput = {
  code: string;
  /** "CPT" for five-digit Level I codes, "HCPCS" for Level II (letter + four digits). */
  system: "CPT" | "HCPCS";
  /** The code in a few plain words, for the title and kicker: "established patient office visit". */
  short: string;
  metaTitle: string;
  metaDescription: string;
  answer: string;
  why: string[];
  reading: string[];
  example?: TopicGuide["example"];
  notMean: string[];
  /** Added to the standard “where you’ll see it” lines. */
  whereSeen?: string[];
  /** Questions specific to this code, asked of the billing office. */
  ask: string[];
  faqs: TopicGuide["faqs"];
  sources: TopicSource[];
  related: string[];
};

/**
 * Builds a code page in the topics.ts shape. Everything that has to be specific to
 * the code (answer, why, reading, misreadings, FAQs) comes from the input; only the
 * framing every bill-line question shares is filled in here.
 */
function codePage(input: CodeInput): TopicGuide {
  const label = `${input.system} ${input.code}`;
  return {
    slug: `${input.system.toLowerCase()}-${input.code.toLowerCase()}`,
    category: "codes",
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    kicker: label,
    h1: `What does ${input.system} code ${input.code} mean on my bill?`,
    answer: input.answer,
    why: input.why,
    reading: input.reading,
    example: input.example,
    notMean: input.notMean,
    whereSeen: [
      `Itemized bills, next to the charge for the ${input.short}.`,
      `Your insurer’s EOB, in the “service” or “procedure code” column for ${input.code}.`,
      ...(input.whereSeen ?? []),
    ],
    questions: [
      { who: "Ask the billing office", items: input.ask },
      {
        who: "Ask your insurer",
        items: [`How did you process ${input.code} on this claim, and what is my share?`, "Was it processed as in-network, and did any of it go to my deductible?"],
      },
    ],
    clariti: `Attach or photograph the bill or EOB and Clariti explains every line in plain words — ${input.code} included — quoting the line it is reading, then flags charges worth checking and lists what to ask. It reads codes as they appear on your document; it doesn’t decide whether a code was chosen correctly.`,
    ctaPrompt: `Seeing ${input.code} on a bill or EOB? Attach it or take a photo, and Clariti will explain each charge in plain language.`,
    faqs: input.faqs,
    sources: input.sources,
    related: input.related,
    media: {
      ...SHOT_BILL_CHARGES,
      caption: `Clariti’s line-by-line explanation of an invented clinic bill — the 99214 visit, an X-ray and its reading, a metabolic panel and a vague supply charge. A bill with ${input.code} gets the same treatment.`,
      link: { href: "/example", label: "See a full example analysis" },
    },
  };
}

// ——— Office visits (evaluation and management) ———

const VISIT_LEVELS =
  "Since 2021 the level of an office visit is chosen either by the complexity of the medical decision-making or by the practitioner’s total time on the day of the visit (including reviewing results and writing notes, not only face-to-face time).";

const officeVisit = (o: {
  code: string;
  patient: "new" | "established";
  level: "straightforward" | "low" | "moderate" | "high";
  minutes: number;
  answerTail: string;
  why: string[];
  reading: string[];
  notMean: string[];
  ask: string[];
  faqs: TopicGuide["faqs"];
  related: string[];
  metaTitle: string;
  metaDescription: string;
  example?: TopicGuide["example"];
}) =>
  codePage({
    code: o.code,
    system: "CPT",
    short: `${o.patient} patient office visit`,
    metaTitle: o.metaTitle,
    metaDescription: o.metaDescription,
    answer: `CPT ${o.code} is the billing code for an office or outpatient visit with ${o.patient === "new" ? "a new patient" : "an established patient"} that involved ${o.level} medical decision-making, or at least ${o.minutes} minutes of the practitioner’s total time that day. ${o.answerTail}`,
    why: o.why,
    reading: [VISIT_LEVELS, ...o.reading],
    example: o.example,
    notMean: o.notMean,
    ask: o.ask,
    faqs: o.faqs,
    sources: [S.amaEm, S.emGuide, S.pfs],
    related: o.related,
  });

const NEW_PATIENT_RULE =
  "“New patient” is a billing term: broadly, you haven’t had professional services from that practitioner, or another of exactly the same specialty in the same group, in the past three years. A first visit to a new clinic can still be billed as established if you saw a colleague of the same specialty there recently.";

export const CODE_TOPICS: TopicGuide[] = [
  officeVisit({
    code: "99214",
    patient: "established",
    level: "moderate",
    minutes: 30,
    metaTitle: "CPT 99214 meaning: the level-4 office visit, explained",
    metaDescription:
      "99214 is a level-4 office visit for an established patient: moderate complexity or 30+ minutes. What it covers, why it’s common and what to ask.",
    answerTail:
      "It is the fourth of five levels for established patients (99211–99215) and one of the most commonly billed visit codes, which is why it appears on so many bills and EOBs.",
    why: [
      "The bill usually shows only “OFFICE/OUTPATIENT VISIT EST” and a price, so it isn’t clear why this visit was a level 4 and the last one a level 3.",
      "“Moderate” sounds like a judgement about how ill you were. It isn’t: it describes how complex the decisions in the visit were, as documented — for example managing more than one ongoing condition, or adjusting a prescription.",
    ],
    reading: [
      "For 99214, AMA’s guidelines describe moderate decision-making: for instance one or more chronic illnesses that are getting worse, two or more stable chronic illnesses, or a new problem with an uncertain outlook — combined with things like reviewing tests or managing prescription medicines.",
      "If the level was chosen on time, the practitioner’s total time that day should be at least 30 minutes. The next level up, 99215, needs high complexity or at least 40 minutes.",
      "You may see a small add-on line next to it: G2211 (Medicare’s add-on for ongoing care relationships) or a modifier such as -25 when a procedure or preventive visit was billed the same day.",
    ],
    example: {
      caption: "An invented office bill. Not anyone’s real bill.",
      rows: [
        { label: "99214", value: "$180.00", reading: "Level-4 visit for an established patient." },
        { label: "G2211", value: "$16.00", reading: "Medicare add-on for an ongoing care relationship." },
        { label: "36415", value: "$12.00", reading: "Blood drawn for tests ordered at the visit." },
      ],
      takeaway: "Each line is a separate charge. Your EOB shows how much of each the plan allowed and left for you.",
    },
    notMean: [
      "That your condition is serious. The level is about the complexity of the visit as documented.",
      "That you spent 30 minutes face to face. Time counts everything the practitioner did for you that day.",
      "That it was billed wrongly because the visit felt short. If it seems high, ask how the level was chosen.",
    ],
    ask: ["Was this visit billed on complexity or on time?", "Why was this a level 4 when my last visit was a level 3?", "Is the G2211 or -25 line on my bill part of the same visit?"],
    faqs: [
      {
        question: "How long is a 99214 visit?",
        answer: "If billed on time, at least 30 minutes of the practitioner’s total time on the day of the visit. It can also be billed on moderate decision-making regardless of time.",
      },
      {
        question: "What is the difference between 99213 and 99214?",
        answer: "99213 is low-complexity decision-making or at least 20 minutes; 99214 is moderate complexity or at least 30 minutes. 99214 is usually paid at a higher rate.",
      },
      {
        question: "How much does a 99214 cost?",
        answer: "It depends on your plan and provider. Your EOB shows the allowed amount and your share; CMS’s Physician Fee Schedule look-up shows what Medicare pays.",
      },
    ],
    related: ["cpt-99213", "cpt-99215", "hcpcs-g2211"],
  }),
  officeVisit({
    code: "99213",
    patient: "established",
    level: "low",
    minutes: 20,
    metaTitle: "CPT 99213 meaning: a level-3 office visit, explained",
    metaDescription:
      "99213 is a level-3 office visit for an established patient: low complexity or 20+ minutes. What it covers on your bill and how it differs from 99214.",
    answerTail: "It is the middle of the five established-patient levels (99211–99215) and one of the most common codes on doctors’ bills.",
    why: [
      "On a bill it appears as a short abbreviation — often “OFFICE O/P EST LOW” — that tells you almost nothing about what happened in the room.",
      "People often compare it with a previous visit billed as 99214 and wonder why the price changed for what felt like the same appointment.",
    ],
    reading: [
      "For 99213, AMA’s guidelines describe low-complexity decision-making: for example a stable long-term condition, an uncomplicated new illness or injury, or two or more minor problems — with limited tests or records reviewed.",
      "If chosen on time, the practitioner’s total time that day should be at least 20 minutes.",
      "Check the date and the provider name, and that it appears once. A 99213 and a 99214 on the same date from the same practitioner would be worth asking about.",
    ],
    notMean: [
      "That your visit was rushed or low quality. Level 3 describes the complexity of decisions, not the care.",
      "That you were seen for 20 minutes face to face. Time counts all the practitioner’s work for you that day.",
      "That it’s the same price everywhere. What you pay depends on your plan’s allowed amount and your cost-sharing.",
    ],
    ask: ["Was this visit billed on complexity or on time?", "Is this the only visit charge for that date?", "Has my insurer’s payment been applied to it?"],
    faqs: [
      {
        question: "How long is a 99213 visit?",
        answer: "If billed on time, at least 20 minutes of the practitioner’s total time that day. It can also be billed on low-complexity decision-making.",
      },
      {
        question: "Is 99213 a new or established patient code?",
        answer: "Established. The matching new-patient level is 99203.",
      },
      {
        question: "Can 99213 be billed for a telehealth visit?",
        answer: "Office visit codes can be used for some telehealth visits, usually with a modifier or place-of-service code that shows it was virtual. Your plan decides how it pays them.",
      },
    ],
    related: ["cpt-99214", "cpt-99212", "cpt-99203"],
  }),
  officeVisit({
    code: "99215",
    patient: "established",
    level: "high",
    minutes: 40,
    metaTitle: "CPT 99215 meaning: the highest-level office visit",
    metaDescription:
      "99215 is the top office visit level for an established patient: high complexity or 40+ minutes. When it’s used, what it costs you and what to ask.",
    answerTail: "It is the highest of the five established-patient levels and is usually paid at the highest rate.",
    why: [
      "Seeing the top level on a bill can be alarming — it reads as if the visit found something serious — or annoying, if the appointment felt routine.",
      "Long visits can also produce a second line: a prolonged-service add-on (99417, or G2212 for Medicare) when time runs well past the 99215 range.",
    ],
    reading: [
      "For 99215, AMA’s guidelines describe high-complexity decision-making: for example a long-term illness that has badly worsened, or a problem that poses a threat to life or bodily function, with decisions such as whether to admit to hospital.",
      "If chosen on time, the practitioner’s total time that day should be at least 40 minutes. CMS’s E/M guide shows Medicare adding G2212 only when time runs at least 15 minutes beyond the top of the range.",
      "If the visit felt short and simple, it is fair to ask how the level was chosen — and, if billed on time, for the time documented.",
    ],
    notMean: [
      "That you have a serious diagnosis. It describes the decisions and time as documented.",
      "That you were seen for 40 minutes face to face. Total time includes work before and after you were in the room.",
      "That a long wait counts. Waiting-room time isn’t practitioner time.",
    ],
    ask: ["Was this billed on complexity or on time, and what was documented?", "Is there a separate prolonged-service charge for the same visit?", "Can I see the visit note?"],
    faqs: [
      {
        question: "How long is a 99215 visit?",
        answer: "If billed on time, at least 40 minutes of the practitioner’s total time that day. It can also be billed on high-complexity decision-making.",
      },
      {
        question: "What is 99417 on my bill with 99215?",
        answer: "A prolonged-service add-on for extra time beyond the 99215 range, billed in 15-minute units. Medicare uses its own code, G2212, instead.",
      },
      {
        question: "Can I ask to see why my visit was a 99215?",
        answer: "Yes. You can ask the practice how the level was chosen and request your visit notes.",
      },
    ],
    related: ["cpt-99214", "cpt-99205", "cpt-code-on-medical-bill"],
  }),
  officeVisit({
    code: "99212",
    patient: "established",
    level: "straightforward",
    minutes: 10,
    metaTitle: "CPT 99212 meaning: a level-2 office visit, explained",
    metaDescription:
      "99212 is a short, straightforward office visit for an established patient (10+ minutes). What it means on your bill, and how it compares with 99213.",
    answerTail: "It is the second of five established-patient levels; 99211 below it is usually a brief visit that may not need a physician present.",
    why: [
      "It often shows up for quick follow-ups — a check after a minor illness, or a short review — and people wonder why a brief visit was charged at all.",
      "It can also appear alongside a procedure on the same day, with a modifier, which looks like being billed twice.",
    ],
    reading: [
      "For 99212, AMA’s guidelines describe straightforward decision-making: for example one minor, self-limited problem.",
      "If chosen on time, the practitioner’s total time that day should be at least 10 minutes.",
      "If it appears with a procedure on the same date, look for modifier -25: it means the practice is saying the visit was a separate, significant service beyond the procedure itself.",
    ],
    notMean: [
      "That there is something wrong with a short visit charge. Every visit level has a code.",
      "That a visit plus a procedure is a duplicate. With modifier -25 they are billed as separate services — though it’s fair to ask why.",
      "That your cost is small. Your copay may be the same whatever the level.",
    ],
    ask: ["Was there a procedure the same day, and is this visit billed separately with -25?", "Was this visit billed on complexity or on time?"],
    faqs: [
      {
        question: "How long is a 99212 visit?",
        answer: "If billed on time, at least 10 minutes of the practitioner’s total time that day.",
      },
      {
        question: "What is the difference between 99211 and 99212?",
        answer: "99211 is a minimal visit that may not require a physician or other qualified practitioner to be present, often a nurse visit. 99212 is a straightforward visit with the practitioner.",
      },
      {
        question: "Will my copay be lower for a 99212?",
        answer: "Not necessarily. Many plans charge the same office-visit copay at every level; coinsurance plans charge a percentage of the allowed amount.",
      },
    ],
    related: ["cpt-99213", "cpt-99214", "cpt-code-on-medical-bill"],
  }),
  officeVisit({
    code: "99203",
    patient: "new",
    level: "low",
    minutes: 30,
    metaTitle: "CPT 99203 meaning: a new patient office visit",
    metaDescription:
      "99203 is a new-patient office visit with low complexity or 30+ minutes. What ‘new patient’ means for billing and how it differs from 99213.",
    answerTail: "New-patient visits run from 99202 to 99205 and are usually paid at a higher rate than the matching established-patient level, 99213.",
    why: [
      "People expect a first visit to cost the same as a follow-up, then see a higher charge and a code they don’t recognise.",
      "Others are surprised to be billed as “new” at a practice they’ve been to before — or as “established” at one they haven’t.",
    ],
    reading: [
      NEW_PATIENT_RULE,
      "For 99203, AMA’s guidelines describe low-complexity decision-making — the same level as 99213 for an established patient — or at least 30 minutes of total time that day.",
    ],
    notMean: [
      "That the new-patient label depends on the building. It depends on whom you saw, their specialty and when.",
      "That the visit was more serious than a follow-up. New-patient codes pay more because there is more to establish.",
      "That it should match your follow-up price. Expect it to be higher.",
    ],
    ask: ["Why was this billed as a new-patient visit?", "Was it billed on complexity or on time?"],
    faqs: [
      {
        question: "How long is a 99203 visit?",
        answer: "If billed on time, at least 30 minutes of the practitioner’s total time that day.",
      },
      {
        question: "What is the established-patient version of 99203?",
        answer: "99213. Both describe low-complexity decision-making.",
      },
      {
        question: "What happened to 99201?",
        answer: "It was deleted from 2021, so new-patient office visits now start at 99202.",
      },
    ],
    related: ["cpt-99204", "cpt-99213", "cpt-99205"],
  }),
  officeVisit({
    code: "99204",
    patient: "new",
    level: "moderate",
    minutes: 45,
    metaTitle: "CPT 99204 meaning: level-4 new patient visit",
    metaDescription:
      "99204 is a new-patient office visit with moderate complexity or 45+ minutes. What it means, how it compares with 99214 and what to ask the practice.",
    answerTail: "It is the new-patient counterpart of 99214, and is often seen on the bill for a first appointment with a specialist.",
    why: [
      "First specialist appointments are often billed at this level, and the charge is noticeably higher than the follow-ups that come after.",
      "Your EOB may show a large difference between the billed and allowed amounts for it, which makes the real cost hard to judge.",
    ],
    reading: [
      NEW_PATIENT_RULE,
      "For 99204, AMA’s guidelines describe moderate decision-making — for example a new problem with an uncertain outcome, or worsening long-term conditions, with tests reviewed or prescriptions managed — or at least 45 minutes of total time that day.",
      "Use your EOB, not the bill’s list price: the allowed amount and your share are what matter.",
    ],
    notMean: [
      "That your condition is serious. The level describes the visit’s complexity as documented.",
      "That you were in the room for 45 minutes. Time includes preparation and documentation on that day.",
      "That later visits will cost the same. Follow-ups are billed with established-patient codes.",
    ],
    ask: ["Why was this billed as a new-patient visit at level 4?", "Was it billed on complexity or on time?", "Has my insurer’s allowed amount been applied?"],
    faqs: [
      {
        question: "How long is a 99204 visit?",
        answer: "If billed on time, at least 45 minutes of the practitioner’s total time that day.",
      },
      {
        question: "What is the difference between 99204 and 99214?",
        answer: "Both are moderate-complexity visits. 99204 is for a new patient (time threshold 45 minutes) and 99214 for an established one (30 minutes).",
      },
      {
        question: "Why is my first specialist visit so expensive?",
        answer: "New-patient codes are paid more than follow-ups. Check your EOB for the allowed amount and your share, and whether it was processed in-network.",
      },
    ],
    related: ["cpt-99203", "cpt-99205", "cpt-99214"],
  }),
  officeVisit({
    code: "99205",
    patient: "new",
    level: "high",
    minutes: 60,
    metaTitle: "CPT 99205 meaning: the highest new patient visit",
    metaDescription:
      "99205 is the top new-patient office visit level: high complexity or 60+ minutes. When it’s billed, what a prolonged-service add-on means, what to ask.",
    answerTail: "It is the highest of the four new-patient levels (99202–99205).",
    why: [
      "It is the most expensive office visit code, so it stands out on a bill — especially for a first appointment that felt like an introduction.",
      "A long first visit can also carry a prolonged-service add-on line, which looks like a second visit.",
    ],
    reading: [
      NEW_PATIENT_RULE,
      "For 99205, AMA’s guidelines describe high-complexity decision-making, or at least 60 minutes of total time that day.",
      "Extra time beyond the 99205 range can be billed with 99417 in 15-minute units, or with G2212 for Medicare; CMS’s E/M guide shows G2212 starting only when time reaches 89 minutes.",
    ],
    notMean: [
      "That you have a serious diagnosis. It describes the visit as documented.",
      "That an add-on line is a duplicate. Prolonged-service codes are add-ons to the same visit.",
      "That the level can’t be questioned. You can ask how it was chosen.",
    ],
    ask: ["Was this billed on complexity or on time, and what was documented?", "Is the prolonged-service line part of the same visit?"],
    faqs: [
      {
        question: "How long is a 99205 visit?",
        answer: "If billed on time, at least 60 minutes of the practitioner’s total time that day.",
      },
      {
        question: "What is the established-patient version of 99205?",
        answer: "99215, the highest established-patient level.",
      },
      {
        question: "What is G2212?",
        answer: "Medicare’s prolonged-service add-on for office visits, used instead of 99417 for Medicare patients.",
      },
    ],
    related: ["cpt-99204", "cpt-99215", "cpt-code-on-medical-bill"],
  }),
  codePage({
    code: "G2211",
    system: "HCPCS",
    short: "visit complexity add-on",
    metaTitle: "G2211 on my bill: Medicare’s visit add-on explained",
    metaDescription:
      "G2211 is a Medicare add-on to an office visit for ongoing care with the same practitioner. Why it’s there, why you may owe coinsurance on it.",
    answer:
      "G2211 is a HCPCS add-on code that Medicare has paid since 2024 alongside an office or outpatient visit when the practitioner is the continuing focal point of your care, or gives ongoing care for a serious or complex condition. It never appears alone, and CMS says the usual Part B deductible and coinsurance apply to it.",
    why: [
      "It appeared on many bills from 2024 with no explanation — a small extra line next to the visit that looks like a fee for nothing.",
      "Because it begins with a letter, it doesn’t look like the visit codes around it. Letter codes are HCPCS Level II codes, which Medicare uses for services that CPT doesn’t describe.",
    ],
    reading: [
      "Look for the visit code on the same date (99202–99205 or 99211–99215). G2211 is an add-on to that visit, recognising the longitudinal relationship — CMS says no specific number of visits is required.",
      "CMS’s FAQ explains when it can’t be added: generally not when the visit is billed with modifier -25 for a same-day procedure, with exceptions since 2025 for same-day preventive services, vaccines and the yearly Wellness visit.",
      "If you have Original Medicare, your Medicare Summary Notice shows the approved amount and the maximum you may owe for it. Other plans may or may not recognise the code.",
    ],
    notMean: [
      "That you were charged for a second visit. It is an add-on to the one visit.",
      "That it is a hidden fee you can refuse. It is a Medicare-recognised code — though you can ask why it applies.",
      "That it’s free. CMS says Part B cost-sharing applies.",
    ],
    whereSeen: ["Medicare Summary Notices and Medicare Advantage EOBs."],
    ask: ["Which visit is G2211 attached to?", "Why does it apply to my care?", "Is it covered by my plan?"],
    faqs: [
      {
        question: "Do I have to pay coinsurance on G2211?",
        answer: "With Original Medicare, yes: CMS says the usual Part B deductible and coinsurance apply.",
      },
      {
        question: "When did G2211 start?",
        answer: "Medicare began paying it from 1 January 2024.",
      },
      {
        question: "Do private insurers pay G2211?",
        answer: "Some do and some don’t. Check your EOB to see how your plan processed it.",
      },
    ],
    sources: [S.g2211, S.hcpcs, S.emGuide],
    related: ["cpt-99214", "cpt-99213", "medicare-summary-notice-eob"],
  }),

  // ——— Preventive visits ———
  codePage({
    code: "99396",
    system: "CPT",
    short: "preventive visit, age 40–64",
    metaTitle: "CPT 99396 meaning: annual physical, ages 40–64",
    metaDescription:
      "99396 is a preventive check-up for an established patient aged 40–64. Why it’s usually $0 in-network, and why a second visit charge can appear.",
    answer:
      "CPT 99396 is the code for a periodic preventive check-up — an annual physical — for an established patient aged 40 to 64. HealthCare.gov says preventive services are generally covered at no cost to you from an in-network provider, but if a new or ongoing problem is also dealt with at the same appointment, a separate office-visit charge can be added, and that part can cost you.",
    why: [
      "People book a “free” annual physical and then get a bill — usually because a second line (99213 or 99214 with modifier -25) was added for a problem discussed during the visit.",
      "Tests ordered at the physical can also be billed separately, and not every test counts as preventive for your age and plan.",
    ],
    reading: [
      "Preventive visit codes are grouped by age and by new or established patient. For established patients: 99395 (18–39), 99396 (40–64), 99397 (65 and over). New patients use 99385, 99386 and 99387.",
      "Check for a second visit code on the same date. With modifier -25, it means the practice billed a problem-focused visit as well as the preventive one — for instance, adjusting a long-term medicine or looking at a new symptom.",
      "Check each lab line on the EOB: preventive screenings are usually paid in full in-network, while diagnostic tests may go to your deductible.",
    ],
    example: {
      caption: "Invented lines from one appointment. Not anyone’s real bill.",
      rows: [
        { label: "99396", value: "$0.00 you owe", reading: "The preventive visit, covered in full in-network." },
        { label: "99213-25", value: "$45.00 you owe", reading: "A separate problem visit at the same appointment — your copay applies." },
        { label: "80061", value: "$0.00 you owe", reading: "A lipid panel processed as a preventive screening." },
      ],
      takeaway: "The physical itself is often free; the extra visit line is where the bill comes from.",
    },
    notMean: [
      "That every charge from the day is preventive. Only the preventive services are.",
      "That the extra visit charge is a mistake. It may be valid if a separate problem was handled — but you can ask.",
      "That out-of-network physicals are free. The no-cost rule is for in-network providers.",
    ],
    ask: ["Why is there a second visit code with -25 on the same day?", "Which tests were billed as preventive and which as diagnostic?"],
    faqs: [
      {
        question: "Is a 99396 physical free?",
        answer: "HealthCare.gov says preventive services are generally covered at no cost to you from an in-network provider, though $0 isn’t guaranteed in all cases. Extra problem visits and some tests can cost you.",
      },
      {
        question: "What is the difference between 99386 and 99396?",
        answer: "Both are preventive visits for ages 40–64. 99386 is for a new patient, 99396 for an established one.",
      },
      {
        question: "Can I ask the practice to remove the extra visit charge?",
        answer: "You can ask why it was added and what was documented. If no separate problem was addressed, ask them to review it.",
      },
    ],
    sources: [S.preventive, S.ama, S.hcpcs],
    related: ["cpt-99395", "cpt-99397", "cpt-80061"],
  }),
  codePage({
    code: "99395",
    system: "CPT",
    short: "preventive visit, age 18–39",
    metaTitle: "CPT 99395 meaning: annual physical, ages 18–39",
    metaDescription:
      "99395 is a preventive check-up for an established patient aged 18–39. What’s covered at no cost, and why a physical can still produce a bill.",
    answer:
      "CPT 99395 is the code for a periodic preventive check-up — an annual physical — for an established patient aged 18 to 39. In-network preventive services are generally covered at no cost to you, but anything treated or investigated at the same visit can be billed on top.",
    why: [
      "Younger adults are the group most likely to book a physical expecting it to be free, and the least likely to have seen how a preventive visit and a problem visit can be billed together.",
      "A few lines on the bill may be routine tests that your plan treats as diagnostic, so they go to your deductible.",
    ],
    reading: [
      "Check the age band. 99395 is 18–39 for an established patient; a new patient in the same band is 99385. If you turned 40 before the visit, 99396 would be expected.",
      "Look for a second visit line the same day (for example 99213-25). It means a separate problem was billed — and it’s where most surprise bills from physicals come from.",
      "Read the EOB for each line. The preventive visit should show $0 for you in-network; other lines show what went to your deductible, copay or coinsurance.",
    ],
    notMean: [
      "That a bill after a physical means the physical wasn’t covered. Check which line you’re being charged for.",
      "That you can’t mention a problem at your physical. You can — just ask whether it will be billed separately.",
      "That every plan covers a yearly physical the same way. Check your plan’s preventive benefits.",
    ],
    ask: ["Was anything at my physical billed as a separate visit?", "Why is this test not processed as preventive?"],
    faqs: [
      {
        question: "Is 99395 covered at 100%?",
        answer: "Preventive services are generally covered at no cost in-network, though HealthCare.gov notes $0 isn’t guaranteed in all cases. Check your EOB.",
      },
      {
        question: "What is 99385?",
        answer: "The new-patient version of the same preventive visit for ages 18–39.",
      },
      {
        question: "How do I avoid a surprise bill at my physical?",
        answer: "If you plan to raise a new problem, ask at booking or at the start whether it will be billed as a separate visit and what that would cost you.",
      },
    ],
    sources: [S.preventive, S.ama],
    related: ["cpt-99396", "cpt-99397", "cpt-99213"],
  }),
  codePage({
    code: "99397",
    system: "CPT",
    short: "preventive visit, age 65+",
    metaTitle: "CPT 99397 meaning: physical at 65+, and Medicare",
    metaDescription:
      "99397 is a preventive check-up for patients 65 and over. Original Medicare doesn’t cover routine physicals; the yearly Wellness visit is different.",
    answer:
      "CPT 99397 is the code for a periodic preventive check-up for an established patient aged 65 or over. It matters because Original Medicare doesn’t cover a routine physical exam: it covers a one-time “Welcome to Medicare” preventive visit and a yearly Wellness visit, which Medicare.gov says isn’t a routine physical. A 99397 billed to Original Medicare may therefore be your cost.",
    why: [
      "Many people turning 65 keep booking “my annual physical” and are surprised by a bill, because the visit was coded as a routine physical rather than Medicare’s yearly Wellness visit.",
      "The two sound similar but are different services: the Wellness visit is a planning conversation and health-risk review, not a hands-on head-to-toe exam.",
    ],
    reading: [
      "Check which visit you had. A Medicare yearly Wellness visit shows as a HCPCS code (G0438 for the first, G0439 after); a routine physical shows as 99397 (or 99387 for a new patient).",
      "Medicare Advantage plans may include a routine physical as an extra benefit. Check your plan’s EOB to see how it was processed.",
      "If the provider expects Original Medicare not to pay for something, they may ask you to sign a notice before the visit. Ask what you’ll owe before agreeing.",
    ],
    notMean: [
      "That Medicare covers no check-ups. It covers the Welcome to Medicare visit and yearly Wellness visits.",
      "That a 99397 bill is an error. It may be the routine physical Medicare doesn’t pay for — ask whether it should have been a Wellness visit.",
      "That Medicare Advantage works the same way. Many plans add benefits; check yours.",
    ],
    whereSeen: ["Medicare Summary Notices, sometimes as a denied or non-covered line."],
    ask: ["Was this booked as a routine physical or as my Medicare yearly Wellness visit?", "Can it be rebilled if it should have been a Wellness visit?"],
    faqs: [
      {
        question: "Does Medicare pay for 99397?",
        answer: "Original Medicare doesn’t cover a routine physical exam. It covers the Welcome to Medicare preventive visit and yearly Wellness visits instead. Some Medicare Advantage plans cover routine physicals.",
      },
      {
        question: "What is the difference between a Wellness visit and a physical?",
        answer: "Medicare.gov says the yearly Wellness visit isn’t a routine physical exam; it is a visit to develop or update a plan to prevent disease, based on your current health and risk factors.",
      },
      {
        question: "What codes are used for the Medicare Wellness visit?",
        answer: "G0438 for the first yearly Wellness visit and G0439 for later ones.",
      },
    ],
    sources: [S.wellness, S.welcome, S.abn],
    related: ["cpt-99396", "medicare-summary-notice-eob", "hcpcs-g2211"],
  }),

  // ——— Labs ———
  codePage({
    code: "36415",
    system: "CPT",
    short: "blood draw",
    metaTitle: "CPT 36415 meaning: the blood draw charge on your bill",
    metaDescription:
      "36415 is the charge for drawing blood from a vein. Why it’s billed separately from the tests, and why it can appear on a different bill from the lab.",
    answer:
      "CPT 36415 is the code for collecting a blood sample from a vein with a needle (venipuncture). It pays for the draw itself, not the tests; each test run on the sample is billed under its own code — often by a different lab.",
    why: [
      "It looks like a duplicate: a small charge for “venipuncture” next to the test charges, sometimes on the doctor’s bill while the tests come on a lab’s bill.",
      "It can be billed once per visit even if several tubes were taken, so people with several tests wonder if they were charged once or many times.",
    ],
    reading: [
      "Look for one 36415 per encounter. Several draws on the same day can sometimes be valid (for example, timed tests), but more than one is worth asking about.",
      "Match it to the tests: the draw is usually on the bill of whoever took the blood; the tests (85025, 80053, 80061 and so on) on the bill of whoever ran them.",
      "Check the EOB: if the tests were preventive, ask whether the draw was processed the same way.",
    ],
    notMean: [
      "That you were charged for the tests twice. The draw and the tests are separate services.",
      "That every tube is a separate 36415. It is normally once per draw.",
      "That it shows which tests were done. Look for the lab codes for that.",
    ],
    ask: ["Is 36415 billed once for this visit?", "Which bill has the tests on it?"],
    faqs: [
      {
        question: "Why am I charged for a blood draw and the blood test?",
        answer: "Collecting the sample and running the test are separate services with separate codes, sometimes by different providers.",
      },
      {
        question: "Is the blood draw covered if the test is preventive?",
        answer: "It depends on your plan. Ask your insurer how the draw was processed alongside a preventive screening.",
      },
      {
        question: "What does venipuncture mean?",
        answer: "Drawing blood from a vein with a needle, usually from the inside of the elbow or the back of the hand.",
      },
    ],
    sources: [S.venipuncture, S.clfs, S.ama],
    related: ["cpt-85025", "cpt-80053", "why-two-bills-for-one-hospital-visit"],
  }),
  codePage({
    code: "85025",
    system: "CPT",
    short: "complete blood count (CBC)",
    metaTitle: "CPT 85025 meaning: complete blood count with diff",
    metaDescription:
      "85025 is a complete blood count (CBC) with an automated differential — the most common blood test. What it measures, and 85025 vs 85027.",
    answer:
      "CPT 85025 is the billing code for a complete blood count (CBC) with an automated differential: an automated count of your red cells, white cells and platelets, plus a breakdown of the different types of white cell. 85027 is the same count without the white-cell breakdown.",
    why: [
      "It appears under many names on bills and lab reports — CBC, FBC, “hemogram”, “CBC w/ auto diff” — so it’s hard to tell it is one test.",
      "The lab’s bill can arrive long after the visit and from a company you never met, which makes it look unrelated.",
    ],
    reading: [
      "On the bill, check the date and that it appears once per draw. Two 85025 lines on the same date are worth asking about.",
      "On the lab report, the CBC is the block with haemoglobin, white cell count, platelets, MCV and the differential (neutrophils, lymphocytes and so on). MedlinePlus explains what it measures.",
      "The blood draw itself is usually billed separately as 36415.",
    ],
    notMean: [
      "That the code says anything about your results. It only says which test was run.",
      "That 85025 and 85027 are the same charge. The differential makes 85025 the larger test.",
      "That a lab bill is a scam because you don’t know the lab. Check it against your EOB and the order from your visit.",
    ],
    ask: ["Is 85025 billed once for this draw?", "Was this test processed as preventive or diagnostic?"],
    faqs: [
      {
        question: "What is the difference between 85025 and 85027?",
        answer: "85025 is a complete blood count with an automated differential (white-cell breakdown); 85027 is the count without the differential.",
      },
      {
        question: "Is a CBC the same as an FBC?",
        answer: "Yes. Full blood count (FBC) is the usual UK name for the same test.",
      },
      {
        question: "How much does 85025 cost?",
        answer: "It depends on the lab and your plan. Your EOB shows the allowed amount and your share; CMS’s Clinical Laboratory Fee Schedule shows Medicare’s rate.",
      },
    ],
    sources: [S.cbc, S.clfs, S.ama],
    related: ["cbc-results-explained", "high-or-low-mcv", "cpt-36415"],
  }),
  codePage({
    code: "80053",
    system: "CPT",
    short: "comprehensive metabolic panel (CMP)",
    metaTitle: "CPT 80053 meaning: comprehensive metabolic panel",
    metaDescription:
      "80053 is the comprehensive metabolic panel (CMP): 14 blood chemistry tests billed as one. What it covers, 80053 vs 80048, and what to check.",
    answer:
      "CPT 80053 is the code for a comprehensive metabolic panel (CMP): a group of 14 blood chemistry tests — including glucose, kidney markers, electrolytes, calcium, proteins and liver tests — billed together as one panel. The smaller basic metabolic panel, without the liver tests, is 80048.",
    why: [
      "The lab report lists 14 separate results, but the bill shows one line, so people can’t tell whether they were charged once or fourteen times.",
      "The opposite also happens: a panel plus some of its own tests billed again separately on the same date, which can be a billing error.",
    ],
    reading: [
      "Look for one 80053 line per draw. If you also see separate codes for tests that are part of the panel on the same date, ask why — billing parts of a panel separately is a form of unbundling.",
      "On the report, MedlinePlus lists what the CMP measures: glucose, calcium, sodium, potassium, carbon dioxide, chloride, albumin, total protein, ALP, ALT, AST, bilirubin, BUN and creatinine.",
      "eGFR is usually calculated from creatinine and reported with the panel rather than billed on its own.",
    ],
    example: {
      caption: "Invented lab bill lines. Not anyone’s real bill.",
      rows: [
        { label: "36415", value: "$10.00", reading: "The blood draw." },
        { label: "80053", value: "$94.00", reading: "The 14-test metabolic panel, as one charge." },
        { label: "84460", value: "$22.00 (same date)", reading: "ALT — already part of the panel. Ask why it’s billed again." },
      ],
      takeaway: "A panel is one charge; its own components on the same date are worth a question.",
    },
    notMean: [
      "That you had 14 separate charges. The panel is billed once.",
      "That it is a liver or kidney diagnosis. It is a routine group of tests.",
      "That 80053 and 80048 are interchangeable. The CMP includes liver tests the BMP doesn’t.",
    ],
    ask: ["Are any tests from the panel billed again separately on the same date?", "Was this processed as preventive or diagnostic?"],
    faqs: [
      {
        question: "What is the difference between 80053 and 80048?",
        answer: "80053 (CMP) is 14 tests including liver tests; 80048 (BMP) is 8 tests without them.",
      },
      {
        question: "What does a CMP test for?",
        answer: "Blood sugar, kidney function, electrolytes and fluid balance, and liver function. MedlinePlus has the full list.",
      },
      {
        question: "Is a CMP the same as a chem 14?",
        answer: "Yes. “Chem-14” and “chemistry panel” are common names for the comprehensive metabolic panel.",
      },
    ],
    sources: [S.cmp, S.bmp, S.clfs],
    related: ["comprehensive-metabolic-panel-explained", "egfr-result-explained", "cpt-36415"],
  }),
  codePage({
    code: "80061",
    system: "CPT",
    short: "lipid panel (cholesterol test)",
    metaTitle: "CPT 80061 meaning: lipid panel (cholesterol test)",
    metaDescription:
      "80061 is the lipid panel: total cholesterol, HDL and triglycerides, with LDL usually calculated. When it’s preventive, and what Medicare covers.",
    answer:
      "CPT 80061 is the code for a lipid panel — the standard cholesterol blood test — which measures total cholesterol, HDL cholesterol and triglycerides, with LDL usually calculated from them. Whether it costs you anything often depends on whether it was billed as a preventive screening.",
    why: [
      "The same test can be free one year and charged the next, depending on why it was ordered and how your plan treats screening for your age and risk.",
      "LDL appears on the report but not on the bill, so people wonder whether it was extra.",
    ],
    reading: [
      "Check the EOB to see whether 80061 was processed as preventive (often $0 in-network) or diagnostic (deductible or coinsurance).",
      "Medicare.gov says Medicare covers screening blood tests for cholesterol, lipid and triglyceride levels once every 5 years. More frequent testing for a known condition is billed differently.",
      "On the report, compare each number with the range your lab prints; MedlinePlus explains what each part measures.",
    ],
    notMean: [
      "That LDL was billed separately. In a standard panel it is usually calculated, not measured on its own line.",
      "That the code says your cholesterol is high. It names the test, not the result.",
      "That the test is always free. It depends on preventive rules and your plan.",
    ],
    ask: ["Was this lipid panel billed as a screening or as diagnostic?", "Was LDL measured directly and billed separately?"],
    faqs: [
      {
        question: "Does Medicare cover 80061?",
        answer: "Medicare.gov says Medicare covers cardiovascular screening blood tests, including cholesterol and triglycerides, once every 5 years. Testing for a diagnosed condition is covered differently.",
      },
      {
        question: "What does a lipid panel include?",
        answer: "Total cholesterol, HDL cholesterol and triglycerides; LDL is usually calculated from those.",
      },
      {
        question: "Do I need to fast for a lipid panel?",
        answer: "Sometimes. Follow the instructions from whoever ordered it — MedlinePlus notes some lipid tests are done fasting and some aren’t.",
      },
    ],
    sources: [S.cholesterol, S.cvScreen, S.preventive],
    related: ["lipid-panel-results-explained", "cpt-99396", "cpt-36415"],
  }),
  codePage({
    code: "83036",
    system: "CPT",
    short: "hemoglobin A1c (HbA1c) test",
    metaTitle: "CPT 83036 meaning: the hemoglobin A1c (HbA1c) test",
    metaDescription:
      "83036 is the hemoglobin A1c test, the blood test for average blood sugar over about 3 months. What the code means on a bill and on Medicare claims.",
    answer:
      "CPT 83036 is the code for a hemoglobin A1c (HbA1c) test, a blood test that reflects your average blood sugar over roughly the past three months. It is used to screen for and monitor diabetes, so how it is covered depends on why it was ordered.",
    why: [
      "It is called several things — A1c, HbA1c, glycated haemoglobin — and reported in two units (% in the US, mmol/mol in the UK), so it is easy to think two tests were done.",
      "People with diabetes may have it several times a year, and wonder why some are covered differently from others.",
    ],
    reading: [
      "On the bill, check it appears once for the date. A separate point-of-care finger-prick version may use a modifier — ask if you see two.",
      "On the EOB, check whether it was processed as screening or monitoring; the diagnosis code on the claim decides that.",
      "For the result itself, MedlinePlus explains the ranges, and the report shows the lab’s own.",
    ],
    notMean: [
      "That you have diabetes because the test was ordered. It is also used for screening.",
      "That % and mmol/mol are two tests. They are two units for one result.",
      "That the price is the same everywhere. Lab prices vary by lab and plan.",
    ],
    ask: ["Is 83036 billed once for this date?", "Was it processed as a screening or as monitoring?"],
    faqs: [
      {
        question: "Does Medicare cover the A1c test?",
        answer: "Medicare.gov describes coverage for diabetes screening tests when you have certain risk factors, and tests are also covered to manage diagnosed diabetes. Your Medicare Summary Notice shows how each was processed.",
      },
      {
        question: "Is HbA1c the same as A1c?",
        answer: "Yes. HbA1c, A1c, hemoglobin A1c and glycated haemoglobin are names for the same test.",
      },
      {
        question: "Why is my A1c test billed by a different company?",
        answer: "Blood is often sent to an outside lab, which bills you or your insurer separately from the practice.",
      },
    ],
    sources: [S.a1c, S.diabetesScreen, S.clfs],
    related: ["hba1c-result-explained", "cpt-36415", "cpt-80053"],
  }),
  codePage({
    code: "82306",
    system: "CPT",
    short: "vitamin D (25-hydroxy) test",
    metaTitle: "CPT 82306 meaning: vitamin D test, and why it’s denied",
    metaDescription:
      "82306 is the 25-hydroxy vitamin D blood test. Why plans often deny it without a qualifying diagnosis, and how it differs from 82652.",
    answer:
      "CPT 82306 is the code for the 25-hydroxy vitamin D blood test, the standard test of your vitamin D level. It is one of the lab tests most often refused by insurers, because many plans — including Medicare — only pay for it when the diagnosis on the claim meets their coverage rules.",
    why: [
      "Vitamin D tests are often added to routine bloodwork, so people don’t expect to be billed for one test out of many.",
      "The denial reason on the EOB is usually generic — “not medically necessary” or “diagnosis not covered” — without saying which diagnoses would have been.",
    ],
    reading: [
      "Check the EOB for this line. A denial here usually means the diagnosis code didn’t match the plan’s rules, not that the test was done wrongly.",
      "Ask the practice whether the diagnosis on the claim was correct and complete. If it wasn’t, they can correct and resubmit.",
      "If you have Original Medicare and the provider expected Medicare not to pay, they should have offered an Advance Beneficiary Notice before the test. Ask whether you signed one.",
      "82652 is a different, less common test (1,25-dihydroxy vitamin D). If you see it, ask why it was ordered rather than 82306.",
    ],
    notMean: [
      "That the test was unnecessary for you. The denial is about the plan’s coverage rules.",
      "That you must pay straight away. Ask whether the claim can be corrected and resubmitted first.",
      "That 82306 and 82652 are the same test.",
    ],
    ask: ["Which diagnosis was billed with the vitamin D test?", "Can the claim be corrected and resubmitted?", "Did I sign an Advance Beneficiary Notice for this test?"],
    faqs: [
      {
        question: "Why was my vitamin D test denied?",
        answer: "Many plans only cover 82306 when the diagnosis on the claim meets their rules. Ask the practice which diagnosis was billed and whether it can be corrected.",
      },
      {
        question: "What is the difference between 82306 and 82652?",
        answer: "82306 is the usual 25-hydroxy vitamin D test; 82652 is the 1,25-dihydroxy test, used in fewer situations.",
      },
      {
        question: "What is an ABN?",
        answer: "An Advance Beneficiary Notice: a form a provider gives someone with Original Medicare before a service Medicare may not pay for, so they can decide whether to go ahead.",
      },
    ],
    sources: [S.vitD, S.abn, S.clfs],
    related: ["claim-denied-on-eob", "cpt-36415", "eob-remark-codes"],
  }),

  // ——— Tests, procedures and supplies ———
  codePage({
    code: "93000",
    system: "CPT",
    short: "electrocardiogram (ECG/EKG)",
    metaTitle: "CPT 93000 meaning: ECG/EKG with interpretation",
    metaDescription:
      "93000 is a routine 12-lead ECG with the tracing and the doctor’s interpretation. Why some ECGs are split into 93005 and 93010 on two bills.",
    answer:
      "CPT 93000 is the code for a routine electrocardiogram (ECG or EKG) with at least 12 leads, including both the tracing and the interpretation and report. When those parts are done by different providers, they are billed separately: 93005 for the tracing and 93010 for the interpretation.",
    why: [
      "An ECG in hospital or at an outside clinic can produce two bills — one from the facility for running it and one from a cardiologist for reading it — which looks like being charged twice.",
      "The names on the bill vary: ECG, EKG, “electrocardiogram complete”, “tracing only”.",
    ],
    reading: [
      "If you see 93000, one provider did and read the whole test, usually in a doctor’s office.",
      "If you see 93005 on one bill and 93010 on another, the test was split between the place that ran it and the doctor who read it. Together they make one ECG.",
      "Two 93000 lines, or 93000 plus 93010 for the same test, would be worth asking about.",
    ],
    notMean: [
      "That a 93005 and a 93010 are two ECGs. They are two parts of one.",
      "That the code says anything about your heart. It names the test, not the result.",
      "That the cardiologist’s bill is a scam because you never met them. Check it against your EOB.",
    ],
    ask: ["Was the ECG billed as one complete test or split into tracing and reading?", "Who read the ECG, and will they bill separately?"],
    faqs: [
      {
        question: "What is the difference between 93000, 93005 and 93010?",
        answer: "93000 is the complete ECG (tracing plus interpretation). 93005 is the tracing only, and 93010 the interpretation and report only.",
      },
      {
        question: "Is an ECG part of a physical?",
        answer: "Not usually as a routine preventive service; whether it is covered depends on why it was done and your plan.",
      },
      {
        question: "What does an ECG measure?",
        answer: "The electrical activity of the heart. MedlinePlus explains how the test is done.",
      },
    ],
    sources: [S.ecg, S.ama, S.pfs],
    related: ["why-two-bills-for-one-hospital-visit", "cpt-code-on-medical-bill", "cpt-99214"],
  }),
  codePage({
    code: "96372",
    system: "CPT",
    short: "injection under the skin or into a muscle",
    metaTitle: "CPT 96372 meaning: the injection charge on your bill",
    metaDescription:
      "96372 is the charge for giving an injection under the skin or into a muscle. Why the drug is billed separately with a J code, and what to check.",
    answer:
      "CPT 96372 is the code for giving a therapeutic, preventive or diagnostic injection under the skin (subcutaneous) or into a muscle (intramuscular). It pays for giving the injection; the medicine itself is billed separately, usually with a HCPCS “J” code and a number of units.",
    why: [
      "A single shot produces two or three lines — the injection, the drug in units, sometimes a visit — and the drug line can be much larger than people expect.",
      "Vaccines use different administration codes, so a flu shot and a medicine injection look different on the same bill.",
    ],
    reading: [
      "Pair 96372 with the drug line. The J code names the drug and the units say how much; check the units against the dose you were told.",
      "Check for one 96372 per injection given. Two injections on the same day can mean two lines, which is fine if you had two.",
      "If there is also an office visit code, ask whether it was a separate service (it would usually carry modifier -25) or just the injection appointment.",
    ],
    example: {
      caption: "Invented lines for one injection visit. Not anyone’s real bill.",
      rows: [
        { label: "96372", value: "$38.00", reading: "Giving the injection into a muscle." },
        { label: "J1100 × 10 units", value: "$22.00", reading: "The drug itself, billed in units under a HCPCS J code." },
        { label: "99213-25", value: "$140.00", reading: "A separate visit the same day — ask what it covered." },
      ],
      takeaway: "The injection, the drug and any visit are separate charges. Check units, and ask about the visit line.",
    },
    notMean: [
      "That you were charged twice for the same shot. Giving it and the drug are separate.",
      "That vaccines are billed with 96372. Vaccine administration has its own codes.",
      "That the visit line is automatic. It should reflect a separate service.",
    ],
    ask: ["Which drug and how many units were billed with this injection?", "Was a separate office visit billed, and why?"],
    faqs: [
      {
        question: "Why is the drug billed separately from 96372?",
        answer: "96372 covers giving the injection. The drug is billed on its own line, usually with a HCPCS J code and units.",
      },
      {
        question: "Is 96372 used for vaccines?",
        answer: "No. Vaccine administration uses separate codes.",
      },
      {
        question: "What is a J code?",
        answer: "A HCPCS Level II code beginning with J, used mainly for drugs given by injection or infusion.",
      },
    ],
    sources: [S.hcpcs, S.ama, S.pfs],
    related: ["cpt-code-on-medical-bill", "cpt-99213", "how-to-check-a-hospital-bill-for-errors"],
  }),
  codePage({
    code: "99070",
    system: "CPT",
    short: "supplies and materials",
    metaTitle: "CPT 99070 meaning: the vague supplies charge on a bill",
    metaDescription:
      "99070 is a catch-all code for supplies beyond those included in a visit. Why it’s vague, why insurers often won’t pay it, and what to ask.",
    answer:
      "CPT 99070 is a catch-all code for supplies and materials a practice provides beyond those normally included in the visit or procedure. Because it doesn’t say what the supplies were, many insurers won’t pay it and expect a specific supply code instead — which is often how it ends up as a balance on your bill.",
    why: [
      "It is the vaguest line on most bills: “supplies” or “unlisted supply charge”, sometimes for a large amount, with nothing to say what was used.",
      "Routine supplies — gloves, gauze, the paper on the exam table — are normally part of the visit, so a separate supplies charge raises fair questions.",
    ],
    reading: [
      "Ask what the supplies were. The practice should be able to tell you exactly what was provided and why it wasn’t part of the visit.",
      "Check the EOB. If the insurer denied 99070, find out whether the practice can rebill with a specific code, and whether your plan lets them bill you for a denied supply line.",
      "Compare the amount with what was used. A large supplies charge for a routine visit is worth a written question.",
    ],
    example: {
      caption: "The invented Northside Family Clinic bill that Clariti explains in the screenshot above. Not anyone’s real bill.",
      rows: [
        { label: "99214", value: "$180.00", reading: "Established-patient office visit, level 4." },
        { label: "99070", value: "$360.40", reading: "“Unlisted supply charge” — no detail about what was supplied." },
      ],
      takeaway: "Clariti flagged the $360.40 line and suggested asking the billing office what it covers, why it’s “unlisted”, and whether the EOB shows it.",
    },
    notMean: [
      "That the charge is fraudulent. It is a real code — but it should be explained.",
      "That routine supplies are billed separately. Usually they are part of the visit.",
      "That a denied 99070 is automatically yours to pay. Ask your plan and the practice.",
    ],
    ask: ["What exactly were these supplies, and what were they used for?", "Why were they billed as 99070 instead of a specific code?", "Did my insurer deny this line, and can it be rebilled?"],
    faqs: [
      {
        question: "Why won’t my insurance pay 99070?",
        answer: "Many insurers want a specific code for each supply rather than a catch-all, and treat routine supplies as part of the visit.",
      },
      {
        question: "Can I dispute a 99070 charge?",
        answer: "Yes. Ask in writing what the supplies were and why they were billed separately, and compare with your EOB.",
      },
      {
        question: "What supplies are included in an office visit?",
        answer: "Routine supplies used in an ordinary visit are generally treated as part of it. Ask the practice why anything was billed on top.",
      },
    ],
    sources: [S.hcpcs, S.ama, S.billRights],
    related: ["common-medical-billing-errors", "medical-bill-dispute-letter", "how-to-check-a-hospital-bill-for-errors"],
  }),
  codePage({
    code: "88305",
    system: "CPT",
    short: "pathology exam of a tissue sample",
    metaTitle: "CPT 88305 meaning: the pathology bill after a biopsy",
    metaDescription:
      "88305 is the pathologist’s exam of a tissue sample, such as a biopsy or polyp. Why it comes on a separate bill, often per specimen.",
    answer:
      "CPT 88305 is the code for a pathologist examining a tissue sample — for example a skin biopsy or a polyp removed during a colonoscopy — both by eye and under the microscope. It is billed by the pathology lab or pathologist, usually separately from the procedure, and often once per specimen.",
    why: [
      "The bill comes weeks later from a pathology group you never met, after a procedure you thought was billed in full.",
      "Several polyps or biopsies can mean several units of 88305, which multiplies a charge people didn’t expect at all.",
    ],
    reading: [
      "Count specimens: the units should match the number of separately identified samples sent (for example, polyps in separate jars).",
      "Match it to the procedure date and provider. The procedure itself (the colonoscopy or skin biopsy) is on another bill.",
      "If the pathologist was out of network but the procedure was at an in-network facility, the No Surprises Act generally protects you from being balance billed for pathology. Compare the bill with your EOB.",
      "If the procedure was a screening (for example a screening colonoscopy), ask your plan how the pathology was processed.",
    ],
    notMean: [
      "That the result is bad. The code is the same whatever the pathologist found.",
      "That it duplicates the procedure bill. Taking the sample and examining it are separate services.",
      "That out-of-network pathology at an in-network hospital is yours to pay in full. Check No Surprises Act protections.",
    ],
    whereSeen: ["Bills from pathology labs after a biopsy, colonoscopy or surgery."],
    ask: ["How many specimens were examined, and why that many units?", "Was the pathologist in network for my plan?"],
    faqs: [
      {
        question: "Why did I get a pathology bill after my colonoscopy?",
        answer: "Polyps or biopsies taken during the procedure are examined by a pathologist, who bills separately — often with 88305 per specimen.",
      },
      {
        question: "What does “level IV surgical pathology” mean?",
        answer: "It is the category this code falls into in the CPT pathology codes (88300–88309), grouped by the type of tissue examined.",
      },
      {
        question: "Am I protected if the pathologist was out of network?",
        answer: "If the procedure was at an in-network facility, CMS says the No Surprises Act generally protects you from out-of-network balance bills for services like pathology.",
      },
    ],
    sources: [S.biopsy, S.billRights, S.ama],
    related: ["no-surprises-act-explained", "why-two-bills-for-one-hospital-visit", "out-of-network-and-balance-billing"],
  }),
  codePage({
    code: "71046",
    system: "CPT",
    short: "chest X-ray, two views",
    metaTitle: "CPT 71046 meaning: chest X-ray (2 views) on a bill",
    metaDescription:
      "71046 is a chest X-ray with two views. Why it can appear twice — once for taking the images and once for the radiologist’s reading.",
    answer:
      "CPT 71046 is the code for a chest X-ray with two views (usually front and side). It often appears twice for one X-ray: once for taking the images (the technical part) and once, with modifier -26, for the radiologist who read them (the professional part) — sometimes on separate bills.",
    why: [
      "The invented bill in the screenshot above has exactly this: a $260 X-ray and a separate $145 charge for the doctor who read it. People assume they were X-rayed twice.",
      "The radiologist’s bill can come from a group you never saw, because they read images remotely.",
    ],
    reading: [
      "Look for modifiers: -TC (technical component) for taking the images, -26 (professional component) for reading them. Without a modifier, one provider billed both parts.",
      "Count the views: 71045 is a single view, 71046 two, 71047 three and 71048 four or more.",
      "The radiologist’s written report explains the findings. For the wording on a scan report, Radily’s guides explain common phrases.",
    ],
    notMean: [
      "That you had two X-rays. The two lines are two parts of one.",
      "That the radiologist’s bill is a mistake because you never met them. Reading images is a separate professional service.",
      "That the code says anything about the result.",
    ],
    ask: ["Is this X-ray billed as one global charge, or as separate technical and professional parts?", "Who read the images, and will they bill separately?"],
    faqs: [
      {
        question: "Why are there two charges for one chest X-ray?",
        answer: "Taking the images (technical component) and reading them (professional component, modifier -26) can be billed separately, often by different providers.",
      },
      {
        question: "What is the difference between 71045 and 71046?",
        answer: "71045 is a single-view chest X-ray; 71046 is two views.",
      },
      {
        question: "What does modifier 26 mean?",
        answer: "The professional component: the doctor’s interpretation and report, billed apart from the equipment and staff that took the images.",
      },
    ],
    sources: [S.chestXray, S.ama, S.pfs],
    related: ["why-two-bills-for-one-hospital-visit", "cpt-code-on-medical-bill", "understand-your-medical-bill"],
  }),

  // ——— Therapy ———
  codePage({
    code: "90837",
    system: "CPT",
    short: "60-minute psychotherapy session",
    metaTitle: "CPT 90837 meaning: 60-minute therapy session code",
    metaDescription:
      "90837 is a psychotherapy session of about 60 minutes (53+). How it compares with 90834 and 90832, and what to check on your therapy bill or EOB.",
    answer:
      "CPT 90837 is the code for a psychotherapy session with the patient lasting about 60 minutes — under the CPT time rules, 53 minutes or more. Shorter sessions use 90834 (about 45 minutes, 38–52) and 90832 (about 30 minutes, 16–37); a first assessment is usually 90791.",
    why: [
      "Therapy is often billed weekly, so the same code repeats across many EOB lines with varying amounts, and it’s hard to see what you paid for each.",
      "Some plans review or limit 60-minute sessions, so a session coded 90837 may be processed differently from a 90834.",
    ],
    reading: [
      "Match each line to a session date and check the code fits the length of the session you had.",
      "Check whether the therapist was in network: out-of-network therapy is common, and your EOB will show a different allowed amount and share.",
      "If you have Original Medicare, Medicare.gov says you pay 20% of the approved amount for outpatient mental health services after the Part B deductible.",
    ],
    notMean: [
      "That 90837 means a more serious problem. It describes session length.",
      "That a 50-minute session should be 90837. Under the time rules it would usually be 90834.",
      "That the code shows what was discussed. It doesn’t.",
    ],
    whereSeen: ["Superbills from therapists you pay directly and claim back from your insurer."],
    ask: ["Does the code on each date match the length of my session?", "Were you in network for these dates?"],
    faqs: [
      {
        question: "What is the difference between 90834 and 90837?",
        answer: "90834 is about 45 minutes of psychotherapy (38–52 minutes); 90837 is about 60 minutes (53 minutes or more).",
      },
      {
        question: "What is a superbill?",
        answer: "An itemized receipt from a provider you paid directly, with the codes and dates you need to claim reimbursement from your insurer.",
      },
      {
        question: "Does Medicare cover 90837?",
        answer: "Medicare covers outpatient mental health services, including psychotherapy; Medicare.gov says you pay 20% of the approved amount after the Part B deductible.",
      },
    ],
    sources: [S.psychotherapy, S.medicareMh, S.ama],
    related: ["patient-responsibility-on-eob", "out-of-network-and-balance-billing", "cpt-code-on-medical-bill"],
  }),
  codePage({
    code: "97110",
    system: "CPT",
    short: "therapeutic exercise (physical therapy)",
    metaTitle: "CPT 97110 meaning: therapeutic exercise, per 15 minutes",
    metaDescription:
      "97110 is therapeutic exercise in physical therapy, billed in 15-minute units. How units are counted (the 8-minute rule) and what to check.",
    answer:
      "CPT 97110 is the code for therapeutic exercise — exercises to build strength, endurance, range of motion and flexibility — given by a physical or occupational therapist. It is a timed code billed in 15-minute units, so the number of units on your bill should reflect the time spent on it.",
    why: [
      "A single PT session often has three or four codes (97110, 97140, 97530, 97112…) each with units, so the total looks large for one hour.",
      "The unit maths isn’t obvious: 25 minutes of exercise can be billed as 2 units, not 1.",
    ],
    reading: [
      "Count units against minutes. Medicare’s claims manual says a single timed service of 8 to 22 minutes is billed as 1 unit and 23 to 37 minutes as 2 — the so-called 8-minute rule. Other plans may count differently.",
      "Add up all the timed codes for the day: their total units should roughly fit the time you spent in active treatment.",
      "Medicare.gov says there’s no yearly limit on what Medicare pays for medically necessary outpatient therapy, and you pay 20% of the approved amount after the Part B deductible.",
    ],
    notMean: [
      "That each unit is a separate visit. Units are 15-minute blocks within one session.",
      "That every minute in the clinic counts. Time on your own or waiting doesn’t.",
      "That 97110 means the same as 97530. 97530 is therapeutic activities — functional tasks rather than exercises.",
    ],
    whereSeen: ["Physical and occupational therapy bills, often with several timed codes per visit."],
    ask: ["How many minutes of therapeutic exercise were documented for each date?", "Do the units across all codes match my session time?"],
    faqs: [
      {
        question: "What is the 8-minute rule?",
        answer: "Medicare’s rule for timed therapy codes: a 15-minute unit is billed once at least 8 minutes are provided; 23 minutes or more of one service can be 2 units.",
      },
      {
        question: "What is the difference between 97110 and 97530?",
        answer: "97110 is therapeutic exercise (strength, endurance, flexibility); 97530 is therapeutic activities using functional, dynamic tasks.",
      },
      {
        question: "Is there a cap on Medicare physical therapy?",
        answer: "Medicare.gov says there’s no limit on how much Medicare pays for medically necessary outpatient therapy in a calendar year.",
      },
    ],
    sources: [S.therapyUnits, S.pt, S.ama],
    related: ["patient-responsibility-on-eob", "cpt-code-on-medical-bill", "common-medical-billing-errors"],
  }),
];
