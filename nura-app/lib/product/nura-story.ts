/**
 * Product-facing story of Nura — marketing, onboarding, legal intros, in-app support.
 * Agent behaviour lives in lib/domain/nura-persona.ts; keep both aligned.
 */

export const NURA_PRODUCT = {
  name: "Nura",

  /** Short lockup for metadata, footers, eyebrows */
  tagline: "Care that continues after the appointment.",

  /** SEO / share description */
  metaDescription:
    "Nura is care between clinical moments — a health and wellbeing companion that helps you follow through after you leave the GP, clinic, or hospital, alongside family, friends, and the people who support you.",

  /** Primary hero headline */
  heroHeadline: "Care continues after you leave.",

  /** Primary hero support line (keep short — full story sits in summary / why) */
  heroSupport:
    "Clinicians treat in the visit. Most care after that is carried by you, family, friends, and carers. Nura stays in that space — within health and wellbeing.",

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

  footerLine: "Care that continues after the appointment.",
} as const;
