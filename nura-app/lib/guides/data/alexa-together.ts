import { SRC } from "../sources";
import type { Guide } from "../types";
import { IMG, media, teaser } from "./media";

/**
 * "Alexa Together alternatives": families who paid Amazon to keep an eye on a parent and are
 * looking for a replacement. Facts checked 19 Nov 2026 on Amazon's own pages:
 * - aboutamazon.com launch posts carry "Update May 21, 2025: Alexa Together is no longer available."
 * - Launch post price: "$19.99 a month or $199 per year"; features Urgent Response, fall detection
 *   response (compatible third-party devices), activity feed and alerts, Remote Assist, Circle of
 *   Support of up to 10 caregivers. US only.
 * - amazon.com/dp/B0BZSZBK3T: Alexa Emergency Assist "$5.99/month", "$59.00/year", "24/7 Urgent
 *   Response", "currently available only in the U.S."
 * - No Amazon equivalent in the UK (amazon.co.uk/alexatogether is a 404).
 * Nura claims checked against lib/faq.ts: check-in calls with consent, daytime only, family
 * summary, not an alarm, no fall detection.
 */
export const ALEXA_TOGETHER_GUIDES: Guide[] = [
  {
    slug: "alexa-together-alternatives",
    category: "elderly",
    question: "Alexa Together has closed: what are the alternatives?",
    title: "Alexa Together alternatives after it closed",
    description:
      "Amazon's Alexa Together is no longer available. What it did, what Amazon offers now, and how to replace each part: alerts, emergency help and daily check-ins.",
    answer:
      "Amazon's Alexa Together is no longer available (Amazon's note is dated 21 May 2025). For emergency help, Amazon now points US customers to Alexa Emergency Assist, a 24/7 urgent response service; in the UK, a personal alarm is the usual route. For the everyday part, knowing your parent is OK and how they're doing, a daily check-in call service or a shared family app can take over.",
    why:
      "Alexa Together bundled several jobs into one US$19.99-a-month subscription: a 24/7 urgent response line, fall detection with compatible devices, an activity feed that told family when a parent was using their Echo, remote help with settings, and a circle of up to 10 caregivers. No single product replaces all of that, so the useful question is which of those jobs you actually relied on. It was also US-only, so UK families never had it and are often searching for the same idea.",
    sections: [
      {
        heading: "What Amazon offers now",
        paras: [
          "On its Alexa Emergency Assist page, Amazon lists 24/7 Urgent Response at US$5.99 a month or US$59 a year, and says it's currently available only in the US. Emergency contacts get an alert when a call for help is placed. It covers the emergency part of Alexa Together, not the daily activity feed or check-ins. Prices and availability can change, so check Amazon's page before you buy.",
        ],
      },
      {
        heading: "Replace it job by job",
        paras: [],
        list: [
          "Getting help fast in an emergency: Alexa Emergency Assist (US), or a personal alarm or telecare service. In the UK your council can often arrange one; the NHS describes personal alarms, fall detectors and key safes.",
          "Fall detection: a fall-detecting pendant or watch linked to a monitoring service. Check who answers the alert: a 24-hour centre or just family.",
          "Knowing they're up and about: smart plugs or motion sensors with a routine that alerts you if there's no activity by mid-morning, with their agreement.",
          "Knowing how they're doing, not just that they moved: a regular check-in call, by family, a befriending service or a check-in call service, with a short summary for the family.",
          "Keeping siblings in step: a shared family app or plan so everyone sees the same updates.",
        ],
      },
    ],
    steps: [
      {
        title: "List what Alexa Together did for you",
        body: "Emergency line, fall alerts, activity feed, or peace of mind from a daily signal. Most families relied on one or two.",
      },
      {
        title: "Sort out emergencies first",
        body: "Emergency Assist in the US, or a personal alarm or telecare in the UK. A check-in service is not a substitute.",
      },
      {
        title: "Add a daily signal",
        body: "A check-in call or an activity routine, whichever your parent is comfortable with.",
      },
      {
        title: "Ask your parent",
        body: "Explain what you'd see and how they can stop it. Consent keeps trust intact.",
      },
      {
        title: "Share it with family",
        body: "Agree who gets alerts and who calls when something looks off.",
      },
    ],
    avoid: [
      "Assuming one new app replaces everything Alexa Together did.",
      "Using a check-in or companion app as an emergency service.",
      "Setting up sensors or tracking without your parent's agreement.",
      "Buying a US-only service for a parent in the UK.",
    ],
    nura:
      "Nura covers the daily check-in part, not the emergency part. You add your parent's first name and number and send them a link; once they say yes, Nura gives them a short, friendly call in their daytime, asks how things are going, and sends you a summary. They need no smartphone or app, can say stop on any call, and siblings can join the same Care plan. Nura isn't an alarm, has no fall detection and can't call for help, so keep an emergency plan alongside it. Nura Plus is US$9.99 a month after a 14-day free trial (prices may vary by region).",
    faqs: [
      {
        q: "Is Alexa Together still available?",
        a: "No. Amazon's own pages carry a note dated 21 May 2025 saying Alexa Together is no longer available. Amazon points customers to Alexa Emergency Assist for urgent response.",
      },
      {
        q: "What replaced Alexa Together?",
        a: "Amazon's replacement for the emergency part is Alexa Emergency Assist (US only, US$5.99 a month on Amazon's page). The activity feed and caregiver features have no direct Amazon replacement, so families use sensors, check-in calls or shared family apps.",
      },
      {
        q: "Was Alexa Together available in the UK?",
        a: "No, it was US-only. In the UK, personal alarms and telecare cover emergencies, and check-in call or befriending services cover daily contact.",
      },
      {
        q: "Can Nura replace Alexa Together?",
        a: "Only the daily check-in part. Nura calls your parent with their OK and tells you how it went, but it isn't an alarm and has no fall detection, so pair it with an emergency option.",
      },
    ],
    sources: [SRC.alarms, SRC.falls, SRC.lonely],
    related: [
      "app-to-check-on-elderly-parents",
      "daily-check-in-calls-for-elderly-parents",
      "how-to-monitor-elderly-parent-at-home",
      "what-to-do-if-an-elderly-parent-falls",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "A real Nura Care plan on a demo account: Nura calls Margaret in her daytime, she can say stop on any call, and it won't call until she says yes.",
    ),
    teaser: teaser(
      IMG.someoneICareFor,
      "The daily check-in, without the smart speaker",
      "Add your parent's number and send them a link. Once they say yes, Nura calls in their daytime and tells you how it went. 14 days free, then US$9.99 a month.",
      "Start your 14-day free trial",
      "alexa_together",
    ),
  },
];
