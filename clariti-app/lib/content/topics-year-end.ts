/**
 * Year-end guides (written 19 Nov 2026): the four money questions people ask
 * between Thanksgiving and mid-January. Deductible reset, FSA deadline, checking
 * a bill before paying, and the bill from a holiday ER or urgent care visit.
 *
 * Same rules as topics.ts. Every rule and figure below was read on the official
 * page listed in `sources` on 19 Nov 2026:
 * - Health FSA 2026 limits ($3,400 salary reduction, $680 carryover): IRS
 *   Rev. Proc. 2025-32, section .15, and IRS news release IR-2025-103.
 * - Use-it-or-lose-it, grace period of up to 2 1/2 months, carryover or grace
 *   period but not both: IRS Publication 969.
 * - Run-out period: IRS Notice 2013-71 (footnote 3).
 * - Deductible, plan year, out-of-pocket limits: HealthCare.gov.
 * - No Surprises Act: CMS.gov medical bill rights pages and the Department of
 *   Labor (EBSA) consumer page.
 * Plans differ, so each page tells the reader to check their plan documents.
 * Examples are invented and labelled so. Imports from topics.ts are type-only
 * (topics.ts spreads this list into TOPICS).
 */

import { CARD_TRIAL_DAYS } from "@/lib/billing/trial";
import { SHOT_BILL_CHARGES, SHOT_BILL_NEXT_STEPS, SHOT_BILL_SUMMARY, type GuideShot } from "@/lib/content/guide-shots";
import type { TopicGuide, TopicSource } from "@/lib/content/topics";

const HC = "https://www.healthcare.gov";
const S = {
  deductible: { label: "HealthCare.gov: Deductible", url: `${HC}/glossary/deductible/` },
  planYear: { label: "HealthCare.gov: Plan year", url: `${HC}/glossary/plan-year/` },
  oop: { label: "HealthCare.gov: Out-of-pocket maximum/limit", url: `${HC}/glossary/out-of-pocket-maximum-limit/` },
  totalCosts: { label: "HealthCare.gov: Your total costs for health care", url: `${HC}/choose-a-plan/your-total-costs/` },
  hcFsa: { label: "HealthCare.gov: Using a Flexible Spending Account (FSA)", url: `${HC}/have-job-based-coverage/flexible-spending-accounts/` },
  pub969: { label: "IRS: Publication 969, Health Savings Accounts and Other Tax-Favored Health Plans", url: "https://www.irs.gov/publications/p969" },
  irs2026: {
    label: "IRS: Tax inflation adjustments for tax year 2026 (IR-2025-103)",
    url: "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill",
  },
  revProc: { label: "IRS: Revenue Procedure 2025-32 (PDF), section .15, cafeteria plans", url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf" },
  notice201371: { label: "IRS: Notice 2013-71 (PDF), health FSA carryover, grace period and run-out period", url: "https://www.irs.gov/pub/irs-drop/n-13-71.pdf" },
  eobGuide: { label: "CMS.gov: How to read an explanation of benefits", url: "https://www.cms.gov/medical-bill-rights/help/guides/explanation-of-benefits" },
  billRights: { label: "CMS.gov: Medical bill rights (No Surprises Act)", url: "https://www.cms.gov/medical-bill-rights" },
  usingInsurance: { label: "CMS.gov: Your rights when using insurance", url: "https://www.cms.gov/medical-bill-rights/know-your-rights/using-insurance" },
  nsaConsumers: { label: "CMS.gov: No Surprises Act, what consumers need to know", url: "https://www.cms.gov/nosurprises/consumers" },
  disputeBill: { label: "CMS.gov: Dispute a bill", url: "https://www.cms.gov/medical-bill-rights/help/dispute-a-bill" },
  dolNsa: {
    label: "U.S. Department of Labor: Avoid surprise healthcare expenses, how the No Surprises Act can protect you",
    url: "https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/publications/avoid-surprise-healthcare-expenses",
  },
} satisfies Record<string, TopicSource>;

const TRIAL_LINE = `Clariti Plus starts with a ${CARD_TRIAL_DAYS}-day free trial on the web; you add a card to begin.`;

function shot(base: GuideShot, caption: string): NonNullable<TopicGuide["media"]> {
  return { ...base, caption, link: { href: "/example", label: "See a full example analysis" } };
}

export const YEAR_END_TOPICS: TopicGuide[] = [
  {
    slug: "what-happens-to-my-deductible-on-january-1",
    category: "insurance",
    metaTitle: "What happens to my deductible on January 1?",
    metaDescription:
      "For most plans the deductible starts again from zero when a new plan year begins, often January 1. What resets, what doesn’t, and what to check now.",
    kicker: "DEDUCTIBLE RESET",
    h1: "What happens to my deductible on January 1?",
    answer:
      "Your deductible is counted one plan year at a time, so when a new plan year begins, the amount you have paid toward it starts again from zero. For many plans that day is January 1. HealthCare.gov notes that a plan year may not be the same as the calendar year, so plans differ: check your plan documents for the date yours starts.",
    why: [
      "Nothing arrives in the mail to tell you it happened. A visit in December and the same visit in January can cost you very different amounts, and the only sign is a line on the January EOB that says “applied to deductible” again.",
      "It is also easy to mix up with the out-of-pocket maximum, which HealthCare.gov defines as the most you have to pay for covered services in a plan year. That count also belongs to one plan year.",
    ],
    reading: [
      "Find your plan year first. HealthCare.gov defines a plan year as a 12-month period of benefits coverage under a group health plan and says it may not be the same as the calendar year. Your plan documents or your employer can tell you the start date. Plans you buy yourself call the same period a policy year.",
      "Check where you stand today. Your insurer’s member portal, or the “deductible met to date” line on a recent EOB, shows how much of this year’s deductible you have paid.",
      "Know what the deductible does. HealthCare.gov defines it as the amount you pay for covered health care services before your plan starts to pay. After you meet it, you usually pay only a copayment or coinsurance for covered services.",
      "Remember what never waits for the deductible. HealthCare.gov says many plans pay for certain services, like a checkup, before you have met your deductible, and that all Marketplace plans pay the full cost of certain preventive benefits even before you meet it.",
      "Look at the limit as well. For Marketplace plans, HealthCare.gov lists the out-of-pocket limit as no more than $10,600 for an individual and $21,200 for a family in 2026, and $12,000 and $24,000 in 2027. Your own plan’s limit may be lower. Plans differ: check your plan documents.",
      "If you have a bill or an EOB from this year, check it now. Which year a late-December visit counts toward, and whether anything carries into the new year, are questions for your plan, not something to assume.",
    ],
    example: {
      caption: "An invented plan with a $2,000 deductible and a plan year that starts January 1. Not anyone’s real plan.",
      rows: [
        { label: "Deductible met by December 10", value: "$2,000", reading: "Met in full for this plan year." },
        { label: "Visit on December 15, allowed amount", value: "$300", reading: "After the deductible, this plan charges 20% coinsurance: $60." },
        { label: "Deductible met on January 1", value: "$0", reading: "A new plan year, so the count starts again." },
        { label: "Same visit on January 15, allowed amount", value: "$300", reading: "All $300 is applied to the new deductible." },
      ],
      takeaway: "Same care, same price, different share for you, only because the plan year changed. Your plan’s own numbers will differ.",
    },
    notMean: [
      "That every plan resets on January 1. A plan year can start in any month. Check your plan documents.",
      "That a bill for this year’s care changes because it arrives in January. Ask your plan which plan year a claim was counted in.",
      "That meeting your deductible made care free. You usually still pay a copayment or coinsurance until you reach the out-of-pocket maximum.",
      "That your premium counts toward the deductible. It doesn’t.",
    ],
    whereSeen: [
      "The “applied to deductible” column on an EOB.",
      "The deductible tracker in your insurer’s member portal or app.",
      "Your plan’s summary of benefits and coverage, which lists the deductible and the plan year.",
      "A January bill that is higher than the same service cost in the fall.",
    ],
    questions: [
      {
        who: "Ask your health plan",
        items: [
          "What date does my plan year start and end?",
          "How much of this year’s deductible and out-of-pocket maximum have I met?",
          "Which plan year did you count this claim in?",
          "Does any amount I paid late this year count toward next year’s deductible?",
        ],
      },
      {
        who: "Ask your doctor’s office",
        items: [
          "What date of service will be on the claim for this visit?",
          "Has this visit been sent to my insurance yet?",
        ],
      },
    ],
    clariti:
      `Attach or photograph an EOB and Clariti labels each part of your share (deductible, copay, coinsurance) in plain words, quoting the lines it read, so you can see how much went to the deductible. Attach the provider’s bill too and it explains that, so you can compare the two before you pay. It can email you a check-in on a date you choose. Clariti explains paperwork; it does not know your plan’s rules, so confirm dates and amounts with your plan. ${TRIAL_LINE}`,
    ctaPrompt: "Not sure how much of a bill went to your deductible? Attach the EOB or take a photo, and Clariti will break it down.",
    faqs: [
      {
        question: "Does my deductible reset on January 1?",
        answer:
          "For many plans, yes, because the plan year matches the calendar year. HealthCare.gov notes a plan year may not be the same as the calendar year, so check your plan documents or ask your employer for your start date.",
      },
      {
        question: "Does my out-of-pocket maximum reset too?",
        answer: "HealthCare.gov defines the out-of-pocket maximum as the most you have to pay for covered services in a plan year, so it is counted per plan year as well.",
      },
      {
        question: "What if I get a bill in January for care I had in December?",
        answer:
          "Don’t assume either way. Compare the bill with the EOB for that claim, and ask your plan which plan year the claim was counted in before you pay.",
      },
      {
        question: "Is this tax or legal advice?",
        answer: "No. It is general information. Plans differ: your plan documents and your plan’s member services line have the rules that apply to you.",
      },
    ],
    sources: [S.deductible, S.planYear, S.oop, S.totalCosts],
    related: ["deductible-copay-coinsurance", "out-of-pocket-maximum-explained", "fsa-deadline-2026", "check-a-medical-bill-before-you-pay"],
    media: shot(SHOT_BILL_SUMMARY, "Clariti’s summary of an invented clinic bill: what was charged, what insurance adjusted and paid, and what is left. An EOB gets the same line-by-line treatment."),
  },
  {
    slug: "fsa-deadline-2026",
    category: "insurance",
    metaTitle: "FSA deadline 2026: what to do with leftover money",
    metaDescription:
      "Health FSA money is usually use-it-or-lose-it. The grace period, the $680 carryover for 2026 plan years, run-out periods, and what to check with your plan.",
    kicker: "FSA DEADLINE",
    h1: "FSA deadline 2026: what to do with money left over",
    answer:
      "A health FSA is generally a use-it-or-lose-it account: the IRS says money left at the end of the plan year generally can’t be carried into the next year. Your employer’s plan may soften that in one of two ways, a grace period of up to 2 1/2 months or a carryover (up to $680 for plan years beginning in 2026), but not both, and it doesn’t have to offer either. Plans differ: check your plan documents for your own dates.",
    why: [
      "There are up to three different dates and people treat them as one. The end of the plan year is the last day to have the care or buy the item. A grace period, if your plan has one, extends that. A run-out period is only extra time to send in receipts for expenses you already had.",
      "The rules are set by your employer’s plan within limits the IRS allows, so a coworker’s spouse at another company can have a different deadline from yours. And “2026” does not always mean December 31: a plan year can start in any month.",
    ],
    reading: [
      "The basic rule. IRS Publication 969 says FSAs are generally “use-it-or-lose-it” plans, that amounts in the account at the end of the plan year generally can’t be carried over to the next year, and that your employer isn’t permitted to refund any part of the balance to you.",
      "Grace period. Publication 969 says a plan can provide a grace period of up to 2 1/2 months after the end of the plan year, and qualified medical expenses in that period can be paid from what was left. For a plan year that ends December 31, 2026, a full grace period would run to March 15, 2027.",
      "Carryover. Instead of a grace period, a plan may let you carry a limited amount into the next plan year. IRS Revenue Procedure 2025-32 sets the maximum carryover at $680 for plan years beginning in 2026. Publication 969 says anything above the carryover amount is forfeited, and that a plan with a carryover is not permitted to also have a grace period.",
      "Run-out period. IRS Notice 2013-71 describes a run-out period as a period right after the plan year when you can submit claims for expenses you had during the plan year. It is time to file paperwork, not time to spend. Its length is set by your plan.",
      "The 2026 contribution limit. The IRS says the limit on employee salary reductions for a health FSA is $3,400 for tax years beginning in 2026. HealthCare.gov notes the limit is per employer, so a spouse can have an FSA through their own employer too.",
      "What it can pay for. HealthCare.gov says you can spend FSA funds on deductibles and copayments but not insurance premiums, and on medical equipment and supplies such as crutches, bandages and blood sugar test kits. Your plan administrator has the full list for your plan.",
      "Find your plan’s answers. Your FSA administrator’s website or your employer’s benefits team can tell you your plan year end date, whether you have a grace period or a carryover, and the last day to submit claims. Plans differ: check your plan documents.",
    ],
    example: {
      caption: "An invented health FSA with a plan year ending December 31, 2026 and $900 left. Not anyone’s real plan.",
      rows: [
        { label: "Plan with neither option", value: "$900 at risk", reading: "Anything not spent on eligible expenses by December 31 is forfeited." },
        { label: "Plan with a carryover", value: "$680 carries over", reading: "The IRS maximum for 2026 plan years. The other $220 must be spent by December 31 or it is forfeited. A plan may set a lower carryover." },
        { label: "Plan with a full grace period", value: "Until March 15, 2027", reading: "Eligible expenses up to that date can use the $900. No carryover as well." },
        { label: "Run-out period", value: "Set by the plan", reading: "Extra time to submit receipts for expenses you already had. Not extra time to spend." },
      ],
      takeaway: "Three plans, three outcomes for the same $900. Only your plan documents say which one is yours.",
    },
    notMean: [
      "That every FSA expires on December 31. The deadline follows your plan year, and your plan may have a grace period or a carryover.",
      "That a run-out period gives you more time to spend. It only gives you more time to submit claims.",
      "That you can cash out what is left. The IRS says your employer isn’t permitted to refund the balance to you.",
      "That an HSA or a dependent care FSA follows these rules. This page is about health FSAs; other accounts have their own rules.",
      "That this is tax advice. It is general information; your plan administrator or a tax professional can answer for your situation.",
    ],
    whereSeen: [
      "Your FSA administrator’s website or app, which shows the balance and the claim deadline.",
      "Open enrollment materials and the summary plan description from your employer.",
      "Year-end reminder emails from your benefits team.",
      "Bills and EOBs for this year’s care, which are what you submit for reimbursement.",
    ],
    questions: [
      {
        who: "Ask your FSA administrator or benefits team",
        items: [
          "What date does my FSA plan year end?",
          "Does my plan have a grace period, a carryover, or neither?",
          "If there is a carryover, how much can carry over, and do I have to do anything to keep it?",
          "What is the last day to submit claims for this plan year?",
          "Is this expense eligible, and what paperwork do you need?",
        ],
      },
      {
        who: "Ask your doctor’s office or billing office",
        items: [
          "Do I have any unpaid balances from this year that I could pay now?",
          "Can you send me an itemized bill or receipt showing the date of service?",
        ],
      },
    ],
    clariti:
      `Before you use FSA money on a medical bill, it helps to know the bill is right. Attach or photograph the bill or EOB and Clariti explains each charge in plain words, quoting the lines it read, and lists what to ask the billing office. It can email you a check-in on a date you choose, such as a week before your claim deadline. Clariti does not decide what your FSA will reimburse; your plan administrator does. ${TRIAL_LINE}`,
    ctaPrompt: "Paying a medical bill with FSA money before the deadline? Attach the bill first, and Clariti will explain each charge and what to ask.",
    faqs: [
      {
        question: "When is the FSA deadline for 2026?",
        answer:
          "It depends on your plan year. For a plan year that ends December 31, 2026, that is the last day to have eligible expenses unless your plan has a grace period (up to 2 1/2 months, so March 15, 2027 at the latest) or a carryover. Plans differ: check your plan documents.",
      },
      {
        question: "How much FSA money can I carry over from 2026?",
        answer:
          "If your plan allows a carryover, the IRS maximum is $680 for plan years beginning in 2026 (Revenue Procedure 2025-32). A plan can set a lower amount or offer no carryover at all.",
      },
      {
        question: "What is the health FSA contribution limit for 2026?",
        answer: "The IRS says the limit on employee salary reductions for a health FSA is $3,400 for tax years beginning in 2026.",
      },
      {
        question: "Can my plan have both a grace period and a carryover?",
        answer: "No. IRS Publication 969 says a plan with a carryover is not permitted to also provide a grace period for health FSAs. Employers don’t have to offer either one.",
      },
      {
        question: "What is the difference between a grace period and a run-out period?",
        answer:
          "A grace period is extra time to have new eligible expenses, up to 2 1/2 months after the plan year. A run-out period is extra time to submit claims for expenses from the plan year that has already ended.",
      },
    ],
    sources: [S.pub969, S.irs2026, S.revProc, S.notice201371, S.hcFsa],
    related: ["what-happens-to-my-deductible-on-january-1", "check-a-medical-bill-before-you-pay", "deductible-copay-coinsurance", "understand-your-medical-bill"],
    media: shot(SHOT_BILL_CHARGES, "Clariti’s charge-by-charge breakdown of an invented clinic bill. Worth a look before you spend FSA money on a bill."),
  },
  {
    slug: "check-a-medical-bill-before-you-pay",
    category: "bills",
    metaTitle: "How to check a medical bill before you pay (checklist)",
    metaDescription:
      "A year-end checklist for any medical bill: wait for the EOB, match the amounts, look for duplicates, check dates, and what to ask before you pay.",
    kicker: "YEAR-END CHECKLIST",
    h1: "How to check a medical bill before you pay it (year-end checklist)",
    answer:
      "Before you pay, wait for your insurer’s explanation of benefits (EOB) and compare the two. CMS says your bill should not be higher than the patient balance on your EOB, and to talk to your provider if it is. Then check your details, the dates of service, duplicate lines and whether insurance was applied. At year end, also check which plan year the claim was counted in and whether FSA money can pay it.",
    why: [
      "Bills and EOBs arrive separately, often weeks apart, and the bill usually comes with a due date that makes it feel urgent. Many people pay the first statement, which may have been printed before insurance finished processing the claim.",
      "The end of the year adds pressure: a deductible that is about to start again, FSA money with a deadline, and bills from holiday visits. That is exactly when a five-minute check is worth it.",
    ],
    reading: [
      "1. Wait for the EOB. It shows what the provider billed, what your plan allowed and paid, and what you may owe. The U.S. Department of Labor suggests checking your EOB for mistakes every time you get one.",
      "2. Match the bill to the EOB. Same provider, same date of service, same amount due. CMS says your bill should not be higher than the patient balance on the EOB. If it is, talk to your provider.",
      "3. Check your details. Your name, date of birth, insurance member ID and group number. If any of them is wrong, get that fixed before anything else.",
      "4. Ask for an itemized bill if you only have a summary. It lists each charge with a date, a description and usually a code.",
      "5. Look for duplicates and strangers. The same charge twice on one date, a service you don’t recall, or a date you weren’t there.",
      "6. Confirm insurance was applied. The bill should show an insurance payment or adjustment. If it shows none, ask whether the claim was filed.",
      "7. Check the plan year. If the visit was near the end of your plan year, ask your plan which year’s deductible the claim was counted toward. Plans differ: check your plan documents.",
      "8. Check your FSA dates. If you plan to pay with health FSA money, confirm the expense is eligible and that the date of service falls inside your plan’s dates.",
      "9. If the bill is out of network for emergency care or care at an in-network hospital, read it against the No Surprises Act before you pay. The No Surprises Help Desk is on 1-800-985-3059.",
      "10. Then pay, or ask. If something doesn’t match, call the billing office, ask them to hold the account while it is reviewed, and write down who you spoke to and when.",
    ],
    example: {
      caption: "An invented bill and EOB for the same visit. Not anyone’s real paperwork.",
      rows: [
        { label: "Bill: amount due", value: "$412.00", reading: "What the provider is asking you to pay." },
        { label: "EOB: patient balance", value: "$187.00", reading: "What your plan says you may owe after its payment and adjustment." },
        { label: "Difference", value: "$225.00", reading: "Ask the billing office. The bill may have been sent before insurance paid." },
        { label: "Bill: lab handling fee, listed twice", value: "$18.00 × 2", reading: "The same charge on the same date. Ask whether one is a duplicate." },
      ],
      takeaway: "The EOB’s patient balance is the figure to compare against. A higher bill is a question to ask, not yet a mistake.",
    },
    notMean: [
      "That a bill is wrong because it is higher than you expected. A new plan year or an unmet deductible can explain it.",
      "That an EOB is a bill. It usually says “this is not a bill”. You pay the provider, not the insurer.",
      "That you can ignore a bill you are questioning. Stay in touch with the billing office while it is reviewed.",
      "That this is legal or financial advice. It is general information to help you ask better questions.",
    ],
    whereSeen: [
      "Statements from doctors’ offices, clinics, labs, urgent care centers and hospitals.",
      "Patient portals, where a balance can appear before the EOB does.",
      "EOBs from your insurer, by mail or in the member portal.",
    ],
    questions: [
      {
        who: "Ask the provider’s billing office",
        items: [
          "Has my insurance payment been applied to this balance?",
          "Please send me an itemized bill with a code for each charge.",
          "Why is this bill higher than the patient balance on my EOB?",
          "Can you hold my account while this is reviewed?",
          "Do you offer a payment plan or financial assistance?",
        ],
      },
      {
        who: "Ask your health plan",
        items: [
          "Has this claim finished processing, and what is my patient balance?",
          "Which plan year’s deductible was this claim counted toward?",
          "Was this provider in network on the date of service?",
        ],
      },
    ],
    clariti:
      `Attach or photograph the bill and Clariti explains every charge in plain words, quoting the line it is reading, and flags the ones worth asking about, such as a charge that appears twice on one date. Attach the EOB too and it explains that, so you can compare them. Its next steps become a question list for the billing office, and it can email you a check-in on a date you choose. Clariti does not tell you what you owe or whether to pay. ${TRIAL_LINE}`,
    ctaPrompt: "About to pay a medical bill? Attach it or take a photo first, and Clariti will explain each charge and flag what to ask about.",
    faqs: [
      {
        question: "Should I pay a medical bill before I get the EOB?",
        answer:
          "It is usually worth waiting. The EOB shows what your plan paid and what you may owe, and CMS says your bill should not be higher than the patient balance on it.",
      },
      {
        question: "What if my bill is higher than my EOB says I owe?",
        answer:
          "CMS says to talk to your provider. If it is an out-of-network bill for emergency care or care at an in-network facility, you can also call the No Surprises Help Desk on 1-800-985-3059.",
      },
      {
        question: "How do I get an itemized bill?",
        answer: "Call or write to the billing office and ask for an itemized bill with the code for each charge.",
      },
      {
        question: "Does it matter whether I pay in December or January?",
        answer:
          "For your deductible, what matters is which plan year the claim was counted in, which your plan can tell you. For a health FSA, your plan’s dates matter. Plans differ: check your plan documents.",
      },
    ],
    sources: [S.eobGuide, S.billRights, S.dolNsa],
    related: [
      "how-to-check-a-hospital-bill-for-errors",
      "common-medical-billing-errors",
      "eob-vs-medical-bill",
      "what-happens-to-my-deductible-on-january-1",
      "fsa-deadline-2026",
    ],
    media: shot(SHOT_BILL_CHARGES, "Clariti’s charge-by-charge breakdown of an invented clinic bill, with a vague supply charge flagged as worth asking about."),
  },
  {
    slug: "surprise-bill-holiday-er-urgent-care-visit",
    category: "bills",
    metaTitle: "Surprise bill after a holiday ER or urgent care visit",
    metaDescription:
      "Got a big bill after a holiday ER or urgent care visit, maybe out of state? What the No Surprises Act covers, what it doesn’t, and what to ask.",
    kicker: "HOLIDAY ER BILL",
    h1: "Got a surprise bill from a holiday ER or urgent care visit? What to ask",
    answer:
      "If you have health insurance and went to an emergency room, CMS says that in most cases you can’t be charged more than your plan’s in-network cost-sharing for emergency services, even at an out-of-network hospital far from home. Urgent care is less clear cut, so ask your plan how the claim was processed. Either way, compare the bill with your EOB before you pay, and call the No Surprises Help Desk on 1-800-985-3059 if the bill is higher.",
    why: [
      "Holiday visits happen away from home, at night, at whichever place is open. You don’t get to check the network first, and the doctors who see you may bill separately from the building you walked into.",
      "The bills then arrive in January, one at a time, just as a new plan year starts. A bill can be large because of a surprise out-of-network charge, or simply because your deductible started again. The two need different questions.",
    ],
    reading: [
      "Emergency room visits. CMS says that if you have insurance through an employer, a Marketplace or an individual plan, you are protected from unexpected out-of-network charges for emergency medical services in most cases, and can’t be charged more than the in-network cost-sharing rate. Providers aren’t allowed to ask you to give up those protections for emergency room care.",
      "No approval needed first. The U.S. Department of Labor says your plan cannot deny coverage because you did not get plan approval before heading to the emergency room.",
      "You still pay your share. The protection limits you to in-network cost-sharing, which means your deductible, copayments and coinsurance. If your deductible started again on January 1, or the visit was in a new plan year, that share can be large and still be correct.",
      "Urgent care. The CMS and Department of Labor consumer pages talk about emergency rooms and independent freestanding emergency departments; they do not name urgent care clinics. CMS also says the protections for non-emergency care apply at in-network hospitals, hospital outpatient departments and ambulatory surgical centers, and don’t apply at other settings such as a doctor’s office. So don’t assume: ask your plan whether the urgent care center was in network and how the claim was processed.",
      "Ambulance. CMS says ground ambulance services aren’t covered by the No Surprises Act billing protections. Air ambulance services are.",
      "Plans that work differently. CMS says the protections generally don’t apply to vision-only and dental-only plans, and that short-term limited duration plans, health care sharing ministries and fixed indemnity plans aren’t covered by them. It says Medicare, Medicaid, VA health care and TRICARE already protect you from some unexpected out-of-network bills.",
      "No insurance. CMS says you can ask for a good faith estimate, and may be able to dispute a bill that is at least $400 more than the estimate. The dispute process has a $25 fee and the bill must be dated within the last 120 calendar days. An unplanned emergency visit usually has no estimate, so also ask the hospital about financial assistance.",
      "Compare, then call. Match each bill to its EOB. If a bill is higher than the patient balance on the EOB, talk to the provider, then call the No Surprises Help Desk on 1-800-985-3059. Plans differ: check your plan documents.",
    ],
    example: {
      caption: "An invented out-of-state emergency room visit on December 24. Not anyone’s real bill.",
      rows: [
        { label: "ER physician group, out of network", value: "$2,400.00", reading: "A separate bill from the doctor who saw you, not the hospital." },
        { label: "Plan paid", value: "$1,300.00", reading: "Processed as emergency services." },
        { label: "Your cost-sharing on the EOB", value: "$350.00", reading: "Your in-network deductible, copay or coinsurance for emergency care." },
        { label: "Balance billed to you", value: "$750.00", reading: "More than the EOB says you owe. Ask the provider to correct it, then call the Help Desk." },
      ],
      takeaway: "The EOB’s cost-sharing line is the number to compare against, not the provider’s full charge.",
    },
    notMean: [
      "That you owe nothing. You still pay your in-network deductible, copay or coinsurance.",
      "That every urgent care bill is protected. Ask your plan how the claim was processed.",
      "That the ground ambulance ride is covered by the federal protections. CMS says it isn’t.",
      "That a high January bill is a surprise bill. It may be your new plan year’s deductible.",
      "That this is legal advice. It is general information; the Help Desk can tell you how the rules apply to your bill.",
    ],
    whereSeen: [
      "A hospital facility bill, and separate bills from the emergency physician, radiology or lab groups.",
      "An EOB showing a claim as out of network.",
      "An ambulance bill, sent on its own.",
      "A statement from an urgent care center you visited while traveling.",
    ],
    questions: [
      {
        who: "Ask your health plan",
        items: [
          "Was this claim processed as emergency services, with No Surprises Act protections?",
          "What is my in-network cost-sharing for this visit?",
          "Was the facility in network? Was each provider who billed me?",
          "Which plan year’s deductible was this counted toward?",
        ],
      },
      {
        who: "Ask the provider’s billing office",
        items: [
          "Why is this bill higher than the patient balance on my EOB?",
          "Were you out of network for my plan on the date of service?",
          "Did I sign a notice and consent form? Can I see it?",
          "Please send an itemized bill, and hold my account while this is reviewed.",
          "Do you have a financial assistance policy or a payment plan?",
        ],
      },
      {
        who: "Ask the No Surprises Help Desk (1-800-985-3059)",
        items: ["Do the protections apply to this bill?", "How do I submit a complaint about it?"],
      },
    ],
    clariti:
      `Attach or photograph the bill and your EOB and Clariti explains each one in plain words, quoting the lines it reads, so you can see whether the bill asks for more than the EOB says you owe. It flags charges worth asking about and turns its next steps into a question list for the billing office and your plan. It can email you a check-in on a date you choose, so a call you are waiting on doesn’t get forgotten. Clariti does not decide whether a bill breaks the rules. ${TRIAL_LINE}`,
    ctaPrompt: "Holiday ER or urgent care bill you can’t follow? Attach it or take a photo, and Clariti will explain each charge and what to ask.",
    faqs: [
      {
        question: "Does the No Surprises Act cover an out-of-state emergency room visit?",
        answer:
          "CMS says that if you have insurance through an employer, a Marketplace or an individual plan, you are protected from unexpected out-of-network charges for emergency medical services in most cases, and pay no more than in-network cost-sharing. It notes some health plans don’t cover emergency care, so check your plan documents.",
      },
      {
        question: "Does the No Surprises Act cover urgent care?",
        answer:
          "The CMS and Department of Labor consumer pages name emergency rooms and independent freestanding emergency departments, not urgent care clinics. Ask your plan whether the center was in network and how the claim was processed.",
      },
      {
        question: "Why is my January bill so high?",
        answer:
          "It may be a surprise out-of-network charge, or it may be that your deductible started again with a new plan year. The EOB shows which: look at the “applied to deductible” line and the patient balance.",
      },
      {
        question: "Who do I call about a surprise medical bill?",
        answer:
          "The No Surprises Help Desk on 1-800-985-3059. The Department of Labor lists its hours as 8 a.m. to 8 p.m. Eastern on weekdays and 10 a.m. to 6 p.m. Eastern on weekends.",
      },
      {
        question: "Is the ambulance bill covered?",
        answer: "CMS says ground ambulance services aren’t covered by the No Surprises Act billing protections. Air ambulance services are.",
      },
    ],
    sources: [S.usingInsurance, S.nsaConsumers, S.disputeBill, S.dolNsa, S.eobGuide],
    related: [
      "no-surprises-act-explained",
      "out-of-network-and-balance-billing",
      "er-visit-level-codes-99281-99285",
      "why-two-bills-for-one-hospital-visit",
      "check-a-medical-bill-before-you-pay",
    ],
    media: shot(SHOT_BILL_NEXT_STEPS, "Clariti’s suggested next steps on an invented clinic bill: compare it with the EOB, ask about the unclear charge, keep a copy. A holiday ER bill gets the same treatment."),
  },
];
