/**
 * Wave 3 of /guides (16 Nov 2026): the billing and prior-authorization questions
 * with real search demand behind them (Google Keyword Planner, all locations,
 * Nov 2025–Oct 2026: "prior authorization" 22,200/mo, "no surprises act" 14,800,
 * "pre authorization" 6,600, "itemized hospital bill" 2,400, "medicare eob" 1,000,
 * "explanation of benefits example" 1,000, "dispute medical bill" 590 …).
 *
 * Same rules as topics.ts: every fact traceable to an official source listed on
 * the page, invented examples labelled as invented, and `clariti` describes only
 * what the live app does (lib/ai/clariti-analysis.ts — prior_authorization is one
 * of its document kinds; email check-ins are app/api/follow-ups).
 *
 * Imports from topics.ts are type-only: topics.ts spreads this list into TOPICS,
 * so a value import back would be a cycle.
 */

import { SHOT_BILL_CHARGES, SHOT_BILL_NEXT_STEPS, SHOT_BILL_SUMMARY, type GuideShot } from "@/lib/content/guide-shots";
import type { TopicGuide, TopicSource } from "@/lib/content/topics";

const HC = "https://www.healthcare.gov";
const S = {
  priorAuth: { label: "HealthCare.gov — Prior authorization", url: `${HC}/glossary/prior-authorization/` },
  paRule: {
    label: "CMS — Interoperability and Prior Authorization Final Rule (CMS-0057-F) fact sheet",
    url: "https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f",
  },
  internalAppeal: { label: "HealthCare.gov — Internal appeals", url: `${HC}/appeal-insurance-company-decision/internal-appeals/` },
  externalReview: { label: "HealthCare.gov — External review", url: `${HC}/appeal-insurance-company-decision/external-review/` },
  appeal: { label: "HealthCare.gov — How to appeal an insurance company decision", url: `${HC}/appeal-insurance-company-decision/` },
  partDRules: {
    label: "Medicare.gov — Drug plan coverage rules (prior authorization, step therapy, quantity limits)",
    url: "https://www.medicare.gov/drug-coverage-part-d/what-medicare-part-d-drug-plans-cover/drug-plan-coverage-rules",
  },
  medicareAppeals: { label: "Medicare.gov — Filing an appeal", url: "https://www.medicare.gov/providers-services/claims-appeals-complaints/appeals" },
  billRights: { label: "CMS.gov — Medical bill rights (No Surprises Act)", url: "https://www.cms.gov/medical-bill-rights" },
  nsaConsumers: { label: "CMS.gov — No Surprises Act: what consumers need to know", url: "https://www.cms.gov/nosurprises/consumers" },
  disputeBill: { label: "CMS.gov — Dispute a bill (patient-provider dispute resolution)", url: "https://www.cms.gov/medical-bill-rights/help/dispute-a-bill" },
  hipaaAccess: { label: "HHS — Your right to access your health information (HIPAA)", url: "https://www.hhs.gov/hipaa/for-individuals/right-to-access/index.html" },
  irsFap: { label: "IRS — Financial assistance policies for tax-exempt hospitals (section 501(r))", url: "https://www.irs.gov/charities-non-profits/financial-assistance-policies-faps" },
  ncci: { label: "CMS.gov — National Correct Coding Initiative (NCCI) edits", url: "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits" },
  msn: {
    label: "Medicare.gov — Medicare Summary Notice (MSN)",
    url: "https://www.medicare.gov/basics/forms-publications-mailings/mailings/costs-and-coverage/medicare-summary-notice",
  },
  allowed: { label: "HealthCare.gov — Allowed amount", url: `${HC}/glossary/allowed-amount/` },
  coinsurance: { label: "HealthCare.gov — Coinsurance", url: `${HC}/glossary/co-insurance/` },
  ftcDebtCollectors: { label: "FTC — Fake and abusive debt collectors", url: "https://consumer.ftc.gov/articles/fake-abusive-debt-collectors" },
  cfpbScam: {
    label: "CFPB — How to tell if a debt collector is legitimate or a scam",
    url: "https://www.consumerfinance.gov/ask-cfpb/how-do-i-tell-if-a-debt-collector-is-legitimate-or-a-scam-en-1699/",
  },
} satisfies Record<string, TopicSource>;

function shot(base: GuideShot, caption: string): NonNullable<TopicGuide["media"]> {
  return { ...base, caption, link: { href: "/example", label: "See a full example analysis" } };
}

export const BILLING_TOPICS: TopicGuide[] = [
  // ——— Prior authorization ———
  {
    slug: "what-is-prior-authorization",
    category: "insurance",
    metaTitle: "What is prior authorization (pre-authorization)?",
    metaDescription:
      "Prior authorization is your plan’s approval before care or a prescription. What it means, who asks for it, how long it takes and what a denial means.",
    kicker: "PRIOR AUTHORIZATION",
    h1: "What is prior authorization, and why does my plan need it?",
    answer:
      "Prior authorization (also called pre-authorization, pre-approval or “PA”) is approval from your health plan that may be required before you get a service or fill a prescription, so that the plan will cover it. Your doctor’s office usually asks for it on your behalf; without it, the plan can refuse to pay even when the care itself was appropriate.",
    why: [
      "It happens out of sight. The request goes between your doctor’s office and the plan, so the first thing many people see is a pharmacy saying “this needs a prior auth” or a letter that says “approved”, “pended” or “denied” with codes they don’t recognise.",
      "It is also easy to confuse with a referral (permission from your primary care doctor to see a specialist) or with a pre-certification for a hospital stay. Plans use the words differently, and one service can need more than one of them.",
    ],
    reading: [
      "Look at what the approval or request letter actually covers: the service or drug, the provider, the number of visits or units, and the dates it is valid for. An approval for 6 physical therapy visits does not cover a 7th, and an approval that expires before your appointment needs renewing.",
      "Check whose job it is. Usually the provider’s office submits the request, but if you are seeing an out-of-network provider, or your plan says so, it may be on you. Your plan’s member services line can tell you whether a request is on file.",
      "Note the status words. “Approved” means the plan agreed to cover it under the plan’s terms (you still pay your deductible, copay or coinsurance). “Pended” or “in review” means a decision hasn’t been made. “Denied” means it won’t be covered as requested — which you can usually appeal.",
      "For some plans the timing is now regulated: CMS says that from 1 January 2026, Medicare Advantage plans, Medicaid and CHIP must decide urgent requests within 72 hours and standard requests within 7 calendar days, and must give a specific reason when they deny one. The rule doesn’t cover prescription drugs.",
    ],
    example: {
      caption: "An invented prior authorization approval letter. Not anyone’s real letter.",
      rows: [
        { label: "Service", value: "MRI lumbar spine", reading: "The scan the plan has agreed to cover." },
        { label: "Status", value: "Approved", reading: "Covered under your plan’s terms — your usual cost-sharing still applies." },
        { label: "Valid", value: "01/03 – 31/05", reading: "Book within these dates or the approval may need renewing." },
        { label: "Units", value: "1", reading: "One scan. A second one would need its own approval." },
      ],
      takeaway: "Approval is about coverage, not cost: you may still owe a deductible or coinsurance on the approved scan.",
    },
    notMean: [
      "That the plan has decided the care is medically wrong for you. A denial is a coverage decision, and you can appeal it.",
      "That an approval means the care is free. Your deductible, copay or coinsurance still apply.",
      "That approval is permanent. Most have an end date and a set number of visits or units.",
    ],
    whereSeen: [
      "Letters or portal messages from your health plan: approved, pended or denied.",
      "The pharmacy counter, when a prescription “needs a PA”.",
      "Denied claims on an EOB, with a reason such as “prior authorization required”.",
    ],
    questions: [
      {
        who: "Ask your doctor’s office",
        items: ["Does this need prior authorization, and has it been submitted?", "What date was it sent, and what did the plan ask for?", "If it’s denied, will you ask for a peer-to-peer review or help me appeal?"],
      },
      {
        who: "Ask your health plan",
        items: ["Is there a request on file for this service, and what is its status?", "What exactly does the approval cover, and until when?", "If it was denied, what was the specific reason and how do I appeal?"],
      },
    ],
    clariti:
      "Prior authorization letters are one of the document types Clariti reads. Attach or photograph the letter and it explains what was approved or denied, for how long and why, quoting the lines it is reading, then suggests what to ask your doctor’s office or plan. It can also email you a check-in on a date you choose, so a pending request doesn’t get forgotten.",
    ctaPrompt: "Got a prior authorization letter you can’t follow? Attach it or take a photo, and Clariti will explain what it says and what to ask next.",
    faqs: [
      {
        question: "Is pre-authorization the same as prior authorization?",
        answer: "Yes. Plans use prior authorization, pre-authorization, pre-approval, pre-certification and “PA” for approval before a service or prescription, though some use pre-certification specifically for hospital stays.",
      },
      {
        question: "How long does prior authorization take?",
        answer: "It depends on the plan. CMS says that from 2026 Medicare Advantage, Medicaid and CHIP must answer urgent requests within 72 hours and standard ones within 7 calendar days. Other plans set their own timelines, so ask yours.",
      },
      {
        question: "What happens if I get care without a needed prior authorization?",
        answer: "The plan may deny the claim. Ask the provider whether they can request authorization after the fact, and check your EOB and denial letter for appeal rights.",
      },
      {
        question: "Can I appeal a prior authorization denial?",
        answer: "Usually, yes. HealthCare.gov says you generally have 180 days from a denial to file an internal appeal, and can ask for an external review if that fails.",
      },
    ],
    sources: [S.priorAuth, S.paRule, S.internalAppeal],
    related: ["prior-authorization-denied", "prior-authorization-for-medication", "claim-denied-on-eob"],
    media: shot(SHOT_BILL_NEXT_STEPS, "Clariti’s next steps on an invented clinic bill. A prior authorization letter gets the same treatment: what it says, and what to ask next."),
  },
  {
    slug: "prior-authorization-denied",
    category: "insurance",
    metaTitle: "Prior authorization denied? What it means, what to do",
    metaDescription:
      "A prior authorization denial is a coverage decision you can usually challenge. Read the reason, then resubmit, ask for a peer-to-peer, or appeal.",
    kicker: "PRIOR AUTH DENIED",
    h1: "My prior authorization was denied. What can I do?",
    answer:
      "A prior authorization denial means your plan has said it won’t cover the service or drug as requested — not that you can’t have it. Read the reason on the denial, then ask your doctor’s office to fix and resubmit the request, request a peer-to-peer review, or file an appeal; HealthCare.gov says you generally have 180 days to file an internal appeal.",
    why: [
      "Denial letters often give a reason in insurer language — “not medically necessary”, “does not meet criteria”, “step therapy required”, “insufficient documentation” — which sounds final but frequently means the plan wanted more information.",
      "The letter goes to you, but the fix usually involves your doctor’s office, and the two don’t always talk to each other quickly. Weeks can pass while each assumes the other is handling it.",
    ],
    reading: [
      "Find the reason and the plan’s criteria. “Insufficient documentation” or a missing form is often fixed by resubmitting with notes, test results or a letter of medical necessity. “Try a different treatment first” (step therapy) may need evidence that the first option was tried or isn’t suitable.",
      "Find the deadline and the route. The letter should explain how to appeal and by when. HealthCare.gov says you generally have 180 days to file an internal appeal, and if the plan still says no you can ask for an independent external review.",
      "If it’s urgent, say so. HealthCare.gov describes expedited handling when waiting could seriously harm your health, and CMS says Medicare Advantage, Medicaid and CHIP plans must decide urgent prior authorization requests within 72 hours from 2026.",
      "Keep a record: the date of the denial, the reference number, who you spoke to and what they said. An email check-in on the deadline date helps.",
    ],
    notMean: [
      "That your doctor was wrong to recommend it. The denial is about whether the plan will pay.",
      "That the decision is final. Many denials are overturned after more information is sent or on appeal.",
      "That you have to wait out the appeal to get care. You can choose to go ahead and pay, though you may then be responsible for the cost if the appeal fails — ask for the price first.",
    ],
    whereSeen: ["Denial letters or portal notices from your health plan.", "Pharmacy messages that a prescription “was rejected — prior authorization required”.", "Denied lines on an EOB after care went ahead without approval."],
    questions: [
      {
        who: "Ask your doctor’s office",
        items: ["Have you seen the denial, and can you resubmit with more documentation?", "Can you request a peer-to-peer review with the plan’s reviewer?", "Is there an alternative the plan would cover while we appeal?"],
      },
      {
        who: "Ask your health plan",
        items: ["What specific criteria weren’t met?", "What is my appeal deadline, and can this be expedited?", "Can I have a copy of the guidelines used to decide?"],
      },
    ],
    clariti:
      "Attach or photograph the denial letter and Clariti explains the reason in plain words, quoting the letter, and lists questions for your doctor’s office and plan. It can email you a check-in before your appeal deadline, so it doesn’t slip.",
    ctaPrompt: "Denial letter in hand? Attach it, and Clariti will explain the reason and what to ask before your deadline.",
    faqs: [
      {
        question: "Why would a prior authorization be denied?",
        answer: "Common reasons include missing paperwork, the plan’s criteria not being met, a required cheaper treatment not tried first (step therapy), an out-of-network provider, or the service not being a covered benefit.",
      },
      {
        question: "What is a peer-to-peer review?",
        answer: "A conversation between your doctor and a clinician working for the plan about the denied request. Many plans offer one before or alongside a formal appeal; your doctor’s office arranges it.",
      },
      {
        question: "How long do I have to appeal?",
        answer: "HealthCare.gov says you generally have 180 days from receiving the denial notice to file an internal appeal. Check your letter for your plan’s exact deadline.",
      },
      {
        question: "What if the internal appeal fails?",
        answer: "You can usually ask for an external review, where an independent reviewer decides. HealthCare.gov explains how to request one.",
      },
    ],
    sources: [S.internalAppeal, S.externalReview, S.paRule],
    related: ["what-is-prior-authorization", "prior-authorization-for-medication", "claim-denied-on-eob"],
    media: shot(SHOT_BILL_NEXT_STEPS, "Clariti turning a document into numbered next steps — here an invented clinic bill. A denial letter gets the same treatment."),
  },
  {
    slug: "prior-authorization-for-medication",
    category: "insurance",
    metaTitle: "Prior authorization for medication: how it works",
    metaDescription:
      "Why a prescription needs prior authorization at the pharmacy, how step therapy and quantity limits fit in, and how to ask for an exception.",
    kicker: "MEDICATION PRIOR AUTH",
    h1: "Why does my prescription need prior authorization?",
    answer:
      "A prescription needs prior authorization when your plan will only cover that drug after your prescriber shows it meets the plan’s rules — for example, that a cheaper drug was tried first or the dose is within limits. The pharmacy can’t override it; your prescriber’s office sends the request, and if the plan says no you can ask for an exception or appeal.",
    why: [
      "You usually find out at the counter, with a prescription ready and a message that it was “rejected” or “needs a PA”. Nobody there can approve it, and it isn’t always clear who is meant to act next.",
      "Drug coverage rules come in a few flavours that all feel like the same refusal: prior authorization, step therapy (try another drug first), and quantity limits (only so many doses per month). Medicare’s drug plan pages list all three.",
    ],
    reading: [
      "Ask the pharmacy what exactly was rejected: prior authorization, step therapy, a quantity limit, or a drug that isn’t on the plan’s list (formulary) at all. Each has a different fix.",
      "Tell your prescriber’s office the same day. They send the request, often electronically, with the reasons you need this drug or dose.",
      "If the plan says no, you or your prescriber can ask for an exception — for instance, to cover a drug that isn’t on the list or to waive a limit — or appeal. For Medicare drug plans, Medicare.gov explains how coverage determinations and appeals work.",
      "Ask about the price meanwhile. Paying out of pocket for a few days’ supply, a generic or a different strength may be an option while the request is decided. Your prescriber can tell you if a gap is safe.",
    ],
    notMean: [
      "That the pharmacy is refusing you the drug. It is the plan’s coverage rule, and the pharmacy can’t approve it.",
      "That the drug is wrong for you. The plan is deciding whether to pay, not whether you should take it.",
      "That approval lasts forever. Many medication approvals expire and need renewing — often yearly.",
    ],
    whereSeen: ["Pharmacy rejection messages: “PA required”, “step therapy”, “quantity limit exceeded”.", "Letters from your drug plan or pharmacy benefit manager.", "Your plan’s drug list (formulary), next to drugs with “PA” or “ST”."],
    questions: [
      {
        who: "Ask the pharmacy",
        items: ["Was this rejected for prior authorization, step therapy, a quantity limit, or because it isn’t on the drug list?", "What would a short supply cost me without insurance?"],
      },
      {
        who: "Ask your prescriber’s office",
        items: ["Can you send the prior authorization today?", "Is there a covered alternative that would work for me?", "If it’s denied, will you support an exception request or appeal?"],
      },
    ],
    clariti:
      "Attach or photograph the plan’s letter, or a medicines list, and Clariti explains it in plain words — names, doses, what the plan decided — and suggests questions for your pharmacist and prescriber. It doesn’t tell you what to take; that stays with your prescriber.",
    ctaPrompt: "Letter from your drug plan you can’t make sense of? Attach it, and Clariti will explain what it says and what to ask.",
    faqs: [
      {
        question: "How long does a medication prior authorization take?",
        answer: "It varies by plan and by whether the request is urgent. Ask your plan for its timeline, and ask your prescriber to mark it urgent if waiting could harm your health.",
      },
      {
        question: "What is step therapy?",
        answer: "A rule that the plan will cover a drug only after you have tried one or more other drugs first, usually cheaper ones. Your prescriber can ask for an exception if those don’t suit you.",
      },
      {
        question: "Who submits a medication prior authorization?",
        answer: "Your prescriber’s office. The pharmacy can tell them it’s needed, and you can call your plan to check it arrived.",
      },
    ],
    sources: [S.priorAuth, S.partDRules, S.medicareAppeals],
    related: ["what-is-prior-authorization", "prior-authorization-denied", "claim-denied-on-eob"],
    media: shot(SHOT_BILL_SUMMARY, "Clariti’s plain-English summary of an invented clinic bill. A drug plan letter gets the same treatment: what it says, quoted back to you."),
  },

  // ——— Surprise bills, disputes and collections ———
  {
    slug: "no-surprises-act-explained",
    category: "bills",
    metaTitle: "No Surprises Act explained: what it covers and doesn’t",
    metaDescription:
      "The No Surprises Act limits surprise out-of-network bills for emergencies, some hospital care and air ambulances. What it covers, what it doesn’t.",
    kicker: "NO SURPRISES ACT",
    h1: "What does the No Surprises Act protect me from?",
    answer:
      "The No Surprises Act is a US federal law, in effect since 1 January 2022, that protects most people with health insurance from surprise out-of-network bills for emergency care, for some non-emergency care at in-network hospitals and surgery centers, and for air ambulance services. In those cases you pay no more than your in-network cost-sharing. It also gives uninsured and self-pay patients the right to a good faith estimate.",
    why: [
      "Surprise bills usually come from providers you never chose — an out-of-network anesthesiologist, radiologist or emergency doctor at a hospital that is in your network. The law targets exactly those, but the bill itself rarely says whether the protection applies.",
      "There are also gaps that people assume are covered: CMS lists emergency care, non-emergency care at in-network facilities and air ambulances, but not ground ambulance rides, and some providers can ask you to waive the protections for planned care.",
    ],
    reading: [
      "Emergency care: CMS says that if you have insurance, you can’t be billed more than your in-network cost-sharing for emergency services, even from an out-of-network hospital or doctor, and the plan can’t require prior authorization for them.",
      "Planned care at an in-network facility: out-of-network providers who treat you there generally can’t balance bill you. For some planned care they can ask you to sign a notice giving up those protections — but not for emergency care, and not for services such as anesthesia, radiology, pathology and lab work, which you don’t get to choose.",
      "Uninsured or self-pay: you can ask for a good faith estimate before care. If the bill is at least $400 more than the estimate, CMS describes a patient-provider dispute process.",
      "If you think a bill breaks the rules, call the No Surprises help desk on 1-800-985-3059 or submit a complaint through CMS. Check your EOB too: if the plan processed an out-of-network emergency claim with in-network cost-sharing, the EOB is the number to compare against.",
    ],
    example: {
      caption: "An invented out-of-network bill after an in-network surgery. Not anyone’s real bill.",
      rows: [
        { label: "Anesthesia — out of network", value: "$1,800.00", reading: "A provider you didn’t choose, at an in-network facility." },
        { label: "Plan paid", value: "$1,150.00", reading: "Processed at in-network terms, as the law requires." },
        { label: "Your cost-sharing (EOB)", value: "$150.00", reading: "Your in-network coinsurance — the most you should pay." },
        { label: "Balance billed to you", value: "$650.00", reading: "The surprise bill the law generally forbids here. Ask the provider to correct it." },
      ],
      takeaway: "Compare the bill with your EOB: the EOB’s “you owe” line is what the law protects, not the provider’s full charge.",
    },
    notMean: [
      "That every out-of-network bill is illegal. Planned care you chose out of network, with valid consent, can still cost more.",
      "That ground ambulance rides are covered. The federal protections cover air ambulance, not ground.",
      "That you owe nothing. You still pay your normal in-network deductible, copay or coinsurance.",
    ],
    whereSeen: ["Bills from emergency rooms and from doctors who treated you in hospital.", "Notice and consent forms before planned care with an out-of-network provider.", "Good faith estimates, if you are uninsured or paying yourself."],
    questions: [
      {
        who: "Ask the provider’s billing office",
        items: ["Were you out of network for my plan, and was this an emergency or at an in-network facility?", "Why am I being billed more than the patient responsibility on my EOB?", "Did I sign a notice and consent form? Can I see it?"],
      },
      {
        who: "Ask your health plan",
        items: ["Did you process this claim with No Surprises Act protections?", "What is my in-network cost-sharing for it?"],
      },
    ],
    clariti:
      "Attach the bill and your EOB and Clariti explains each in plain words, quoting the lines it reads, so you can see whether the bill asks for more than the EOB says you owe. The free EOB decoder does that comparison for one claim line without any upload.",
    ctaPrompt: "Out-of-network bill after a hospital visit? Attach it, and Clariti will explain each charge and what to ask.",
    faqs: [
      {
        question: "When did the No Surprises Act take effect?",
        answer: "1 January 2022. It applies to most private health plans, including employer and marketplace plans.",
      },
      {
        question: "Does the No Surprises Act cover ambulances?",
        answer: "It covers air ambulance services. CMS’s consumer pages list air ambulance but not ground ambulance rides, which aren’t covered by the federal protections.",
      },
      {
        question: "Who do I contact about a surprise bill?",
        answer: "The No Surprises help desk on 1-800-985-3059, or a complaint through CMS’s medical bill rights pages.",
      },
      {
        question: "Does it apply if I’m uninsured?",
        answer: "The balance-billing protections are for insured people. Uninsured and self-pay patients get the right to a good faith estimate and a dispute process if the bill is at least $400 over it.",
      },
    ],
    sources: [S.billRights, S.nsaConsumers, S.disputeBill],
    related: ["out-of-network-and-balance-billing", "good-faith-estimate", "how-to-dispute-a-medical-bill"],
    media: shot(SHOT_BILL_SUMMARY, "Clariti’s summary of an invented bill: what was charged, what insurance adjusted and paid, and what’s left — the figures you compare with your EOB."),
  },
  {
    slug: "how-to-dispute-a-medical-bill",
    category: "bills",
    metaTitle: "How to dispute a medical bill, step by step",
    metaDescription:
      "Get the itemized bill, match it to your EOB, call billing, then escalate: insurer appeal, No Surprises Act complaint or the $400 good-faith-estimate dispute.",
    kicker: "DISPUTE A BILL",
    h1: "How do I dispute a medical bill?",
    answer:
      "To dispute a medical bill, ask for the itemized bill, compare every line with your insurer’s EOB, then call the provider’s billing office with the specific lines you’re questioning and ask for the account to be put on hold while they review. If that doesn’t fix it, escalate: an appeal to your insurer if the claim was processed wrongly, a No Surprises Act complaint for a surprise out-of-network bill, or the CMS dispute process if you were self-pay and the bill is $400+ over your good faith estimate.",
    why: [
      "The first bill is usually a summary — a total and a few category lines — which gives you nothing specific to dispute. The itemized version is where errors become visible.",
      "Two organisations are involved, and each will often tell you to call the other. Knowing whether the problem is the provider’s billing or the insurer’s processing decides who has to fix it.",
    ],
    reading: [
      "1. Get the itemized bill: every charge with its date, code and quantity. You can ask the billing office for it, and HHS says your billing records are part of the health information you have a right to access.",
      "2. Match it to the EOB. The EOB says what the plan allowed, paid and left for you. If the bill asks for more than the EOB’s patient responsibility, or lists services the EOB doesn’t, that is your strongest point.",
      "3. Call billing with specifics: the line, the date, what’s wrong and what you want. Ask for a hold on the account and a reference number. Follow up in writing — a short dispute letter — and keep copies.",
      "4. Escalate to the right place. Claim processed wrongly: ask the insurer to reprocess, or file an internal appeal (generally within 180 days of the denial). Surprise out-of-network bill: the No Surprises help desk, 1-800-985-3059. Self-pay and $400+ over the good faith estimate: CMS’s patient-provider dispute process, for a bill dated in the last 120 days, with a $25 fee.",
      "5. If the bill is right but unaffordable, that’s a different conversation: ask about a payment plan and the hospital’s financial assistance policy — the IRS requires tax-exempt hospitals to have a written one.",
    ],
    notMean: [
      "That you should ignore the bill while you dispute it. Tell the provider in writing, and ask them to pause collection.",
      "That a dispute is rude. Billing offices handle corrections every day.",
      "That you must pay first to dispute. You can dispute before paying; ask for the hold.",
    ],
    whereSeen: ["Bills that don’t match the EOB.", "Bills with charges for care you didn’t get, duplicates or unclear lines.", "Bills far above a good faith estimate."],
    questions: [
      {
        who: "Ask the billing office",
        items: ["Can you send the itemized bill with codes and quantities?", "Can you put my account on hold while this is reviewed?", "Has my insurer’s payment and adjustment been applied?"],
      },
      {
        who: "Ask your insurer",
        items: ["Was this claim processed correctly, in or out of network?", "How do I file an appeal, and by when?"],
      },
    ],
    clariti:
      "Attach the bill and Clariti explains every charge in plain words, quoting the line it is reading, and flags the ones worth asking about. Its next steps turn into a question list for the billing office, and it can email you a check-in to follow up on the date you choose.",
    ctaPrompt: "Bill you want to challenge? Attach it, and Clariti will explain each charge and list what to ask the billing office.",
    faqs: [
      {
        question: "Can I dispute a medical bill after paying it?",
        answer: "Yes. If a charge was wrong, you can still ask for a correction and a refund. It’s easier before paying, so ask for a hold if you can.",
      },
      {
        question: "Is there a deadline to dispute a medical bill?",
        answer: "It depends on the route. HealthCare.gov says insurance appeals are generally due within 180 days of the denial; CMS’s self-pay dispute needs a bill dated within the last 120 days. Provider billing offices set their own timelines, so act quickly.",
      },
      {
        question: "Should I dispute in writing?",
        answer: "Call first to get the fastest fix, then confirm in writing — what you’re disputing, why and what you’re asking for — and keep a copy.",
      },
    ],
    sources: [S.disputeBill, S.nsaConsumers, S.internalAppeal, S.hipaaAccess, S.irsFap],
    related: ["medical-bill-dispute-letter", "how-to-get-an-itemized-hospital-bill", "how-to-check-a-hospital-bill-for-errors"],
    media: shot(SHOT_BILL_NEXT_STEPS, "Clariti’s next steps for an invented clinic bill: compare it with the EOB, ask about the unclear supply charge, keep a copy, ask about a payment plan."),
  },
  {
    slug: "medical-bill-dispute-letter",
    category: "bills",
    metaTitle: "Medical bill dispute letter: free template and tips",
    metaDescription:
      "A short, copyable letter to dispute a medical bill: what to include, what to attach, and how to ask for a hold while the charges are reviewed.",
    kicker: "DISPUTE LETTER",
    h1: "How do I write a letter disputing a medical bill?",
    answer:
      "A good medical bill dispute letter is short and specific: your account number and dates of service, the exact lines you are disputing and why, what you want done (a correction, a reprocessed claim, an itemized bill), and a request to pause collection while it is reviewed. Attach copies — never originals — of the bill, your EOB and anything that backs you up.",
    why: [
      "Phone calls fix many billing problems, but they leave no trace. A letter creates a dated record of what you disputed and when, which matters if the account later goes to collections.",
      "Most templates online are long and legalistic. Billing staff respond faster to a clear one-page letter that names the lines and the fix.",
    ],
    reading: [
      "Start with the identifiers: patient name, account or statement number, dates of service and the provider’s name. Then one sentence: “I am disputing the following charges.”",
      "List each disputed line with its date, code (if shown) and amount, and the reason: not received, duplicated, more than my EOB says I owe, wrong quantity, should have been covered.",
      "Say what you want: a corrected bill, the claim resubmitted to your insurer, an itemized statement, or the documentation behind a charge. Ask for the account to be placed on hold and not sent to collections during the review.",
      "Send it the way the bill says disputes should be sent (some list a separate address), keep a copy, and note the date. If you call, write down who you spoke to.",
    ],
    example: {
      caption: "A short template. Replace the bracketed parts; the example figures are invented.",
      rows: [
        { label: "Opening", value: "Re: account [number], dates of service [dates]", reading: "Lets the billing office find your account at once." },
        { label: "Disputed line 1", value: "[date] 99214 office visit — $180.00", reading: "“My EOB shows I owe $40 for this visit; the bill asks for $180.”" },
        { label: "Disputed line 2", value: "[date] 99070 supplies — $360.40", reading: "“Please tell me what supplies this covers and send the record behind it.”" },
        { label: "Request", value: "Correct, itemize, hold", reading: "“Please correct the bill, send an itemized statement and hold the account during review.”" },
      ],
      takeaway: "Name the line, the reason and the fix. Anything vaguer gets a vaguer reply.",
    },
    notMean: [
      "That you need a lawyer to write it. A plain letter from you is normal.",
      "That sending it stops every deadline. Keep paying undisputed amounts and follow up if you hear nothing.",
      "That you should send originals. Keep them; send copies.",
    ],
    whereSeen: ["Billing office addresses on statements, sometimes a separate “billing inquiries” address.", "Patient portals with a message or dispute form."],
    questions: [
      {
        who: "Ask the billing office",
        items: ["Where should written disputes go?", "Will the account be placed on hold while this is reviewed?", "When should I expect a reply?"],
      },
    ],
    clariti:
      "Attach the bill and Clariti explains each charge, quoting the lines it reads, and flags the ones worth questioning — the raw material for your letter. Its next steps become a question list you can work from, and an email check-in reminds you to follow up if no reply comes.",
    ctaPrompt: "Not sure which lines to dispute? Attach the bill, and Clariti will explain each charge and flag the ones worth questioning.",
    faqs: [
      {
        question: "Should I send a dispute letter by email or post?",
        answer: "Use the method the provider lists for billing disputes. If you post it, keep a copy and proof of the date you sent it; if you use a portal message, save a screenshot.",
      },
      {
        question: "What should I attach to a medical bill dispute letter?",
        answer: "Copies of the bill, the matching EOB, any good faith estimate, and anything showing the error, such as an appointment you cancelled.",
      },
      {
        question: "What if they don’t reply?",
        answer: "Call, quote the date of your letter, and ask for a written answer. If the problem is with your insurer’s processing, use their appeal process; for surprise bills, the No Surprises help desk is 1-800-985-3059.",
      },
    ],
    sources: [S.disputeBill, S.billRights, S.internalAppeal],
    related: ["how-to-dispute-a-medical-bill", "how-to-check-a-hospital-bill-for-errors", "medical-bill-in-collections"],
    media: shot(SHOT_BILL_CHARGES, "Clariti’s charge breakdown of an invented clinic bill — the lines a dispute letter would name, including the vague $360.40 supply charge."),
  },
  {
    slug: "how-to-get-an-itemized-hospital-bill",
    category: "bills",
    metaTitle: "How to get an itemized hospital bill (and read it)",
    metaDescription:
      "An itemized bill lists every charge with dates, codes and quantities. How to ask for one, what it should show, and what to check before you pay.",
    kicker: "ITEMIZED BILL",
    h1: "How do I get an itemized hospital bill?",
    answer:
      "Call the billing number on your statement (or use the patient portal) and ask for an itemized bill — sometimes called an itemized statement — for your account and dates of service. It lists every charge separately, usually with its date, a code, a description and the quantity, which a summary bill doesn’t; HHS says billing records are part of the health information you have a right to access.",
    why: [
      "Hospitals usually send a summary first: a total and a few category lines such as “pharmacy” or “room and board”. You can’t tell from that whether anything is duplicated or missing.",
      "Itemized bills are long and full of internal abbreviations and codes, so people ask for one and then can’t use it. Knowing what to look for makes it worth the call.",
    ],
    reading: [
      "Ask for the right thing: an itemized statement with CPT/HCPCS codes, revenue codes, dates and quantities, for all dates of service. Ask whether the insurer’s payments and adjustments are shown on it.",
      "Check the basics first: your name and insurance details, the admission and discharge dates, and the number of room days.",
      "Then scan for repeats (the same code twice on the same date), large quantities, services you don’t recognise and supply lines with no detail. Each is a fair question — not proof of a mistake.",
      "Compare the totals with your EOB. The EOB shows what the plan allowed and what is left for you; the itemized bill should agree with it once payments are applied.",
    ],
    example: {
      caption: "Invented lines from an itemized hospital bill. Not anyone’s real bill.",
      rows: [
        { label: "0250 Pharmacy", value: "J2405 × 2", reading: "Two units of a drug given in hospital, billed with a HCPCS drug code." },
        { label: "0300 Laboratory", value: "85025 × 1", reading: "A complete blood count — one test." },
        { label: "0300 Laboratory", value: "85025 × 1 (same date)", reading: "The same test again that day — worth asking if it was really done twice." },
        { label: "0270 Supplies", value: "No code, $212.00", reading: "A supply charge with no detail — ask what it covers." },
      ],
      takeaway: "The four-digit numbers are revenue codes (the hospital department); the five-character ones say what was done.",
    },
    notMean: [
      "That asking for one will annoy the hospital. It is a routine request.",
      "That every unfamiliar line is an error. Many are normal — the point is that you can now ask.",
      "That you must pay before you get it. Ask for the itemized bill before paying a large balance.",
    ],
    whereSeen: ["Requested from hospital or clinic billing departments, or downloaded from a patient portal.", "Sometimes sent automatically when a bill goes to a payment plan or collections."],
    questions: [
      {
        who: "Ask the billing office",
        items: ["Can you send an itemized statement with codes and quantities for all my dates of service?", "Does it show my insurer’s payments and adjustments?", "Can you hold the account while I review it?"],
      },
    ],
    clariti:
      "Attach or photograph the itemized bill and Clariti explains each charge in everyday words, quoting the line it is reading, and flags the ones worth asking about — such as a code repeated on the same date or a supply line with no detail.",
    ctaPrompt: "Got the itemized bill and it’s pages of codes? Attach it, and Clariti will explain every charge in plain language.",
    faqs: [
      {
        question: "Is an itemized bill free?",
        answer: "Billing offices normally send itemized statements on request without charge. If you ask under your HIPAA right of access, HHS limits any fee to a reasonable, cost-based amount.",
      },
      {
        question: "How long does it take to get an itemized bill?",
        answer: "Often a few days to a couple of weeks. Ask for the account to be placed on hold until you have it.",
      },
      {
        question: "What is the difference between an itemized bill and a summary bill?",
        answer: "A summary bill shows totals by category. An itemized bill lists every individual charge with its date, code, description and quantity.",
      },
    ],
    sources: [S.hipaaAccess, S.billRights],
    related: ["understand-your-medical-bill", "how-to-check-a-hospital-bill-for-errors", "common-medical-billing-errors"],
    media: shot(SHOT_BILL_CHARGES, "Clariti’s line-by-line breakdown of an invented bill: each charge in plain English, including the ones worth a second look."),
  },
  {
    slug: "common-medical-billing-errors",
    category: "bills",
    metaTitle: "8 common medical billing errors, and how to spot them",
    metaDescription:
      "Duplicate charges, upcoding, unbundling, services you didn’t get, unapplied insurance payments. What each error looks like on a bill and what to ask.",
    kicker: "BILLING ERRORS",
    h1: "What are the most common medical billing errors?",
    answer:
      "The most common medical billing errors are duplicate charges, services you didn’t receive, the wrong quantity, a visit coded at a higher level than the care documented (upcoding), one procedure split into separately billed parts (unbundling), wrong insurance or personal details, insurance payments not applied, and out-of-network charges that the No Surprises Act doesn’t allow. Most only show up on an itemized bill compared line by line with your EOB.",
    why: [
      "A bill can be wrong without anyone being dishonest: charges are entered by different departments, codes are chosen from notes, and claims bounce between provider and insurer. Each hand-off is a chance for a slip.",
      "The errors also look normal on the page. A duplicated lab test is just another line; an unapplied insurance payment just makes the balance bigger.",
    ],
    reading: [
      "Duplicates: the same code on the same date more than once. Sometimes correct (two of the same test), often not. Ask.",
      "Not received or cancelled: tests, medicines or procedures you don’t remember, or that were cancelled. Ask for the record behind the charge.",
      "Wrong quantity: 10 units where you had 1. Check the quantity column on the itemized bill.",
      "Upcoding: a visit billed at a higher level than the visit you had — for example an office visit code for a longer, more complex visit. Ask how the level was chosen.",
      "Unbundling: billing parts of one procedure separately when a single code covers them. CMS runs the National Correct Coding Initiative edits to catch this on Medicare claims.",
      "Wrong details, unapplied payments, and surprise out-of-network charges: check your name, plan and member number; check that the EOB’s payment and adjustment appear; and check any out-of-network charge from an emergency or in-network facility against No Surprises Act rules.",
    ],
    notMean: [
      "That an error means fraud. Most are fixed with one call.",
      "That an unfamiliar code is an error. Look it up or ask before assuming.",
      "That a correct bill is affordable. If it’s right but too much, ask about payment plans and financial assistance.",
    ],
    whereSeen: ["Itemized hospital and clinic bills.", "EOBs where a claim was denied for wrong details.", "Statements that don’t subtract what the insurer paid."],
    questions: [
      {
        who: "Ask the billing office",
        items: ["Why does this code appear twice on the same date?", "Can you show me the record for this charge?", "How was this visit level chosen?", "Has my insurer’s payment and adjustment been applied?"],
      },
    ],
    clariti:
      "Attach the bill and Clariti explains every charge in plain words, quoting the lines it reads, and flags charges worth checking — repeats on the same date, vague supply lines, extra fees — with the question to ask about each.",
    ctaPrompt: "Think your bill has a mistake? Attach it, and Clariti will flag the lines worth checking and what to ask.",
    faqs: [
      {
        question: "How common are medical billing errors?",
        answer: "Estimates vary widely and there is no single official figure. What is consistent is that errors are easiest to find on an itemized bill compared with your EOB.",
      },
      {
        question: "What is upcoding?",
        answer: "Billing a service at a higher level or as a more expensive service than the one documented — for example a higher visit level than the visit supports.",
      },
      {
        question: "What is unbundling?",
        answer: "Billing the parts of a procedure separately when one code covers the whole thing. CMS’s National Correct Coding Initiative edits are designed to catch it on Medicare claims.",
      },
    ],
    sources: [S.ncci, S.billRights, S.hipaaAccess],
    related: ["how-to-check-a-hospital-bill-for-errors", "how-to-get-an-itemized-hospital-bill", "how-to-dispute-a-medical-bill"],
    media: shot(SHOT_BILL_CHARGES, "Clariti’s charge breakdown of an invented bill, with the lines worth questioning: a lab handling fee, a facility fee and a vague supply charge."),
  },
  {
    slug: "medical-bill-in-collections",
    category: "bills",
    metaTitle: "Medical bill in collections? What to do first",
    metaDescription:
      "A medical bill sent to collections can still be checked and disputed. Confirm the debt is real, match it to your EOB, and ask about financial assistance.",
    kicker: "COLLECTIONS",
    h1: "My medical bill went to collections. What should I do?",
    answer:
      "First, check the collector is real and the debt is yours: contact the original provider using the number on your own paperwork, not the one in the collection letter. Then ask the collector, in writing, for the details of the debt, compare it with the provider’s itemized bill and your EOB, and dispute anything wrong. If the bill is right but unaffordable, ask the hospital about financial assistance — tax-exempt hospitals must have a written policy.",
    why: [
      "Collection letters are designed to get a payment quickly. They rarely show the itemized charges, so you can’t tell whether the balance is correct, whether insurance paid, or whether it’s even your debt.",
      "Scammers also pose as medical debt collectors. The FTC and CFPB warn about fake collectors who pressure people to pay debts they don’t owe.",
    ],
    reading: [
      "Verify. Look up the provider’s own billing number and ask: did you send my account to this agency, for how much, and has my insurance been applied? Don’t give card or bank details on an unexpected call.",
      "Ask the collector for written details of the debt — who the original creditor is, the amount and how it was calculated. The CFPB explains what information collectors must give you.",
      "Compare. Get the itemized bill from the provider and your EOB from the insurer. Errors that weren’t fixed before collections can still be fixed now.",
      "Dispute in writing anything that’s wrong, and keep copies. If the provider made the error, ask them to correct it and recall the account from collections.",
      "Ask about help. The IRS requires tax-exempt hospitals to have a written financial assistance policy, and to make reasonable efforts to see if you qualify before taking extraordinary collection actions. Ask whether you can still apply.",
    ],
    notMean: [
      "That you must pay immediately. You can verify and dispute first.",
      "That the amount is correct. It is whatever the provider passed on, errors included.",
      "That every caller is genuine. Check with the original provider before paying anyone.",
    ],
    whereSeen: ["Letters and calls from collection agencies naming a hospital or clinic.", "Final notices from providers warning of collections."],
    questions: [
      {
        who: "Ask the original provider",
        items: ["Did you send my account to this agency, and for what amount?", "Was my insurance billed and its payment applied?", "Can I still apply for financial assistance?"],
      },
      {
        who: "Ask the collector, in writing",
        items: ["Who is the original creditor, and how was this amount calculated?", "Please send the itemized details of this debt."],
      },
    ],
    clariti:
      "Attach the collection letter, the original bill or your EOB and Clariti explains each in plain words, quoting the lines it reads, and suggests what to ask. If something looks like a scam, it says so and points you back to the provider’s own number.",
    ctaPrompt: "Collection letter for a medical bill? Attach it, and Clariti will explain what it says and what to check first.",
    faqs: [
      {
        question: "Can I still dispute a bill that is in collections?",
        answer: "Yes. Ask the collector for the details of the debt in writing, and ask the original provider to correct any error and recall the account.",
      },
      {
        question: "How do I know a medical debt collector is real?",
        answer: "Check with the original provider using the number on your own bill or portal. The FTC and CFPB both explain the warning signs of fake collectors.",
      },
      {
        question: "Can I get financial assistance after a bill goes to collections?",
        answer: "Often, yes. Tax-exempt hospitals must have a written financial assistance policy; ask the hospital whether you can still apply.",
      },
    ],
    sources: [S.cfpbScam, S.ftcDebtCollectors, S.irsFap],
    related: ["how-to-spot-a-fake-medical-bill", "how-to-dispute-a-medical-bill", "medical-bill-dispute-letter"],
    media: shot(SHOT_BILL_NEXT_STEPS, "Clariti’s next steps on an invented bill, including asking about a payment plan — the same steps apply before a balance reaches collections."),
  },

  // ——— EOBs ———
  {
    slug: "explanation-of-benefits-example",
    category: "insurance",
    metaTitle: "Explanation of benefits (EOB) example, line by line",
    metaDescription:
      "A sample EOB for one doctor visit, every column explained: billed, discount, allowed, plan paid, deductible, copay, coinsurance, and what you may owe.",
    kicker: "EOB EXAMPLE",
    h1: "What does an explanation of benefits look like? A worked example",
    answer:
      "An explanation of benefits (EOB) is a statement from your insurer showing what a provider billed for a visit, the discount the plan negotiated, the allowed amount, what the plan paid, and what is left for you — split into deductible, copay and coinsurance. It is not a bill. The worked example below walks through one invented EOB line by line, so you can read yours the same way.",
    why: [
      "Every insurer lays out its EOB differently and names the columns differently: “amount billed” or “provider charges”, “plan discount” or “network savings”, “your responsibility” or “what you owe”.",
      "The numbers only make sense in a particular order. Read across a row out of order and the figures look random.",
    ],
    reading: [
      "Start at the top: the patient, the provider, the claim number and the date of service. Make sure it is your visit.",
      "Then read one service row from left to right: billed → discount → allowed → plan paid → your share.",
      "Your share is made of up to three parts. HealthCare.gov defines them: the deductible (what you pay before the plan starts paying), the copay (a fixed amount) and coinsurance (a percentage of the allowed amount).",
      "Finally, check the remarks and the bottom line. Remark codes explain denials and adjustments, and the “patient responsibility” total is what the provider’s bill should ask you for — no more.",
    ],
    example: {
      caption: "An invented EOB for one in-network office visit. Not anyone’s real EOB.",
      rows: [
        { label: "Amount billed", value: "$420.00", reading: "The provider’s full price." },
        { label: "Plan discount", value: "−$185.00", reading: "The in-network discount. You don’t pay this." },
        { label: "Allowed amount", value: "$235.00", reading: "The most the plan recognises for this service." },
        { label: "Plan paid", value: "$164.00", reading: "Sent to the provider." },
        { label: "Copay", value: "$30.00", reading: "Your fixed amount for the visit." },
        { label: "Coinsurance (20%)", value: "$41.00", reading: "20% of the $205 left after the copay, in this invented plan. Plans set their own order." },
        { label: "Patient responsibility", value: "$71.00", reading: "Copay + coinsurance. Allowed $235 = plan $164 + you $71." },
      ],
      takeaway: "The check that matters: the allowed amount equals what the plan paid plus what you owe. If the bill asks for more than $71, ask why.",
    },
    notMean: [
      "That the EOB is a bill. Wait for the provider’s bill, then compare.",
      "That you owe the amount billed. You owe the patient responsibility.",
      "That a $0 plan payment means a denial. It often means the full allowed amount went to your deductible.",
    ],
    whereSeen: ["Mail or your insurer’s app after each claim is processed.", "Medicare Advantage and Part D plans send EOBs; Original Medicare sends a Medicare Summary Notice instead."],
    questions: [
      {
        who: "Ask your insurer",
        items: ["Why was this amount applied to my deductible?", "What does this remark code mean?", "Was this processed as in-network?"],
      },
      {
        who: "Ask the provider",
        items: ["Does my bill match the patient responsibility on my EOB?", "Have you applied the plan’s payment and discount?"],
      },
    ],
    clariti:
      "Attach or photograph your EOB and Clariti explains each column for your claim in plain words, quoting the figures it reads, and suggests what to ask if the provider’s bill doesn’t match. The free EOB decoder checks the arithmetic for one line without any upload.",
    ctaPrompt: "Got an EOB that doesn’t look like this one? Attach it, and Clariti will explain your columns in plain language.",
    faqs: [
      {
        question: "Is an explanation of benefits a bill?",
        answer: "No. It explains how the insurer processed a claim. The bill comes from the provider and should match the EOB’s patient responsibility.",
      },
      {
        question: "Why is the allowed amount lower than the amount billed?",
        answer: "In-network providers agree to accept the plan’s allowed amount. The difference is written off, not passed to you.",
      },
      {
        question: "Where do I find my EOBs?",
        answer: "Usually in your insurer’s app or website, as well as by post. Keep them until the matching bills are settled.",
      },
    ],
    sources: [S.allowed, S.coinsurance, S.msn],
    related: ["how-to-read-an-eob", "patient-responsibility-on-eob", "deductible-copay-coinsurance"],
    media: shot(SHOT_BILL_SUMMARY, "Clariti reading an invented bill: total charged, the insurance adjustment and what insurance paid — the same figures an EOB lists."),
  },
  {
    slug: "medicare-summary-notice-eob",
    category: "insurance",
    metaTitle: "Medicare EOB vs Medicare Summary Notice, explained",
    metaDescription:
      "Original Medicare sends a Medicare Summary Notice, not an EOB; Advantage and Part D plans send EOBs. What each shows and what to check.",
    kicker: "MEDICARE EOB",
    h1: "What is a Medicare EOB, and how is it different from a Medicare Summary Notice?",
    answer:
      "If you have Original Medicare, your “EOB” is the Medicare Summary Notice (MSN): Medicare.gov says it isn’t a bill, and shows the services billed to Medicare, what Medicare paid and the maximum you may owe. You get one every 6 months if you had services (or monthly electronic MSNs if you sign up). Medicare Advantage and Part D drug plans are private plans, so they send their own explanation of benefits instead.",
    why: [
      "People with Medicare can get three kinds of statement — an MSN, a Medicare Advantage EOB and a Part D EOB — and all of them look like bills without being bills.",
      "The MSN arrives months after the care, so it is easy to have paid a provider’s bill already and never check it against what Medicare says you owe.",
    ],
    reading: [
      "Check it’s really from Medicare. Medicare.gov explains what to look for on the envelope.",
      "Read each service line: the provider, the date, the amount charged, the Medicare-approved amount, what Medicare paid and the maximum you may be billed.",
      "Compare with your bills and receipts. Medicare.gov says to compare your MSN with any bill you paid to make sure you paid the right amount, and to check you got everything listed.",
      "If something was denied, call the provider’s office first to make sure they sent the right information. If you disagree with a decision, the last page of the MSN explains how to appeal step by step.",
    ],
    example: {
      caption: "Invented lines from a Part B Medicare Summary Notice. Not anyone’s real notice.",
      rows: [
        { label: "Amount provider charged", value: "$210.00", reading: "The provider’s price." },
        { label: "Medicare-approved amount", value: "$120.00", reading: "What Medicare allows for this service." },
        { label: "Medicare paid", value: "$96.00", reading: "80% of the approved amount, once the Part B deductible is met." },
        { label: "Maximum you may be billed", value: "$24.00", reading: "Your 20% coinsurance. Compare with the provider’s bill." },
      ],
      takeaway: "The “maximum you may be billed” column is your check against the provider’s bill.",
    },
    notMean: [
      "That the MSN is a bill. Medicare.gov is explicit that it isn’t.",
      "That a service you don’t recognise is fine to ignore. Medicare asks you to check every line.",
      "That Medicare Advantage members get an MSN. Their plan sends an EOB instead.",
    ],
    whereSeen: ["Post from Medicare every 6 months if you had services, or email links for monthly electronic MSNs.", "EOBs from Medicare Advantage and Part D drug plans."],
    questions: [
      {
        who: "Ask the provider",
        items: ["Does my bill match the “maximum you may be billed” on my MSN?", "Was this claim sent to Medicare with the right information?"],
      },
      {
        who: "Ask Medicare (1-800-MEDICARE)",
        items: ["Why was this service denied?", "How do I appeal, and by when?"],
      },
    ],
    clariti:
      "Attach or photograph your MSN or plan EOB and Clariti explains each line in plain words, quoting the figures it reads, and suggests what to check against your bills.",
    ctaPrompt: "Medicare notice you can’t follow? Attach it, and Clariti will explain each line in plain language.",
    faqs: [
      {
        question: "How often does Medicare send a Medicare Summary Notice?",
        answer: "Medicare.gov says you get an MSN every 6 months if you had services or supplies in that period, or monthly email links if you choose electronic MSNs.",
      },
      {
        question: "Do I have to pay the amount on my Medicare Summary Notice?",
        answer: "No — it isn’t a bill. It shows the maximum you may owe the provider, who bills you separately.",
      },
      {
        question: "Why do I get an EOB instead of an MSN?",
        answer: "If you’re in a Medicare Advantage plan or a Part D drug plan, those private plans send their own explanation of benefits.",
      },
    ],
    sources: [S.msn, S.medicareAppeals],
    related: ["how-to-read-an-eob", "explanation-of-benefits-example", "eob-vs-medical-bill"],
    media: shot(SHOT_BILL_SUMMARY, "Clariti’s summary of an invented bill: what was charged, adjusted and paid. A Medicare Summary Notice gets the same plain-English read."),
  },
];
