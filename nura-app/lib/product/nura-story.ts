/**
 * Product-facing story of Nura — marketing, onboarding, legal intros, in-app support.
 * Agent behaviour lives in lib/domain/nura-persona.ts; keep both aligned.
 */

export const NURA_PRODUCT = {
  name: "Nura",

  /** Short lockup for metadata, footers, eyebrows */
  tagline: "A health and wellbeing companion that checks in on you.",

  /** SEO / share description */
  metaDescription:
    "Nura is a health and wellbeing companion. Tell it what’s going on in plain words, keep a simple Care plan, and get gentle check-ins by message or call, with family and carers alongside. It doesn’t diagnose or replace professional care.",

  /** Primary hero headline */
  heroHeadline: "A health and wellbeing companion that checks in on you.",

  /** Primary hero support line (keep short — full story sits in summary / why) */
  heroSupport:
    "Tell Nura what’s going on in plain words. It keeps a simple Care plan and checks in gently, by message or a short call, so the next step doesn’t slip when life gets busy.",

  /** One-paragraph product summary (About / support / pitch) */
  summary:
    "Nura is built on a simple idea: healthcare doesn’t end when the appointment ends. A clinician treats in the visit; after that, the day-to-day care of a person’s health and wellbeing is carried by family, friends, the person themselves, carers, social workers, and community. Nura is an agent that cares in that in-between — organising what matters, gently following up, and holding continuity — without replacing doctors, therapists, or emergency care. It works strictly within health, medical, and wellbeing: memory, care plans, check-ins, and encouragement so follow-through doesn’t disappear into busy life.",

  /** Shorter in-app blurb */
  shortSummary:
    "Nura cares between clinical moments — helping you follow through on health and wellbeing after you leave the appointment, alongside the people who support you. It organises and checks in; it does not diagnose, prescribe, or replace professional care.",

  howItWorksLead:
    "Nura is for the time between care — when remembering, noticing, and following through usually falls to you and the people around you.",

  howItWorks: [
    {
      title: "Tell Nura what’s going on",
      copy: "In plain language — a message, a note from the visit, or something a carer or clinician asked you to watch.",
    },
    {
      title: "It becomes a Care plan",
      copy: "Nura keeps the important parts together so context doesn’t scatter across chats, paper, and memory.",
    },
    {
      title: "Care continues with check-ins",
      copy: "Gentle follow-ups bring the next step back when life gets busy — the kind of continuity family and friends try to give, without the load falling only on them.",
    },
  ] as const,

  whyHeadline: "Treatment happens in moments. Care happens in between.",

  whyLead:
    "You leave with advice. Work gets loud. Sleep shifts. A symptom changes. Someone who loves you asks how you’re doing. Nura holds the Care plan so the next step — and the sense that someone is still with you in it — is still there when you need it.",

  trustLead:
    "Nura organises, remembers, and follows up within health and wellbeing. It does not diagnose, prescribe, or replace professional care. You decide what it remembers.",

  roleSupport:
    "Nura is care after the visit: it organises, remembers, and follows up within health, medical, and wellbeing. It does not diagnose, prescribe, change medication, or replace clinicians, therapists, or the people who care for you in real life.",

  onboardingHeadline: "Your health, cared for between appointments.",

  onboardingSupport:
    "Tell Nura what is happening in plain language. It turns what matters into Care plans and gentle check-ins — so the care that usually falls to you, family, and friends after the appointment doesn’t get lost.",

  footerLine: "A health and wellbeing companion that checks in on you.",

  /** Shown on the public site so reviewers and visitors can see the cost without signing up */
  pricingLine:
    "Free to start. Nura Plus is US$9.99 a month after a 14-day free trial (the price may vary by region), and you can cancel any time.",

  /** Crisis signposting for every public page footer. Nura is not an emergency service. */
  crisisLine:
    "Nura is not an emergency service. If you are in crisis or someone is in danger, call 999 (UK) or 911 (US). In the UK, Samaritans are on 116 123, any time; in the US, call or text 988.",
} as const;
