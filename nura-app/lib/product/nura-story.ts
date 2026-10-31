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
    "Nura is an AI health and wellbeing companion. It gets to know how you’re living and feeling — sleep, energy, stress, routines, and the people you look out for — keeps a simple Care plan around your day, and checks in by message, WhatsApp or a short call so what matters to you doesn’t slip. Connect Apple Health or Health Connect and its check-ins can notice your sleep and steps too. Nura organises, remembers and encourages; it does not diagnose, prescribe, or replace doctors, therapists, or emergency care.",

  /** Shorter in-app blurb */
  shortSummary:
    "An AI health and wellbeing companion that gets to know your days and checks in on you — by message, WhatsApp or a short call. It does not diagnose, prescribe, or replace professional care.",

  howItWorksLead:
    "Nura is the companion that remembers: what you said you’d try, how you’ve been sleeping, and when to check in.",

  howItWorks: [
    {
      title: "Tell Nura what’s going on",
      copy: "In plain words: how you’re sleeping, what’s stressing you, a habit you want to stick to, or someone you’re looking out for.",
    },
    {
      title: "It keeps a simple Care plan",
      copy: "Nura holds what matters to you in one place, and can read your sleep and steps from Apple Health or Health Connect if you want it to.",
    },
    {
      title: "It checks in on you",
      copy: "Gentle check-ins by message, WhatsApp or a short call, at the times that suit you, so you’re never doing it alone.",
    },
  ] as const,

  whyHeadline: "Looking after yourself happens on ordinary days.",

  whyLead:
    "Work gets loud. Sleep shifts. Energy dips. Someone you love needs looking out for. Nura notices, remembers what you said mattered, and checks in — so you’re not carrying it all on your own.",

  trustLead:
    "Nura organises, remembers, and follows up within health and wellbeing. It does not diagnose, prescribe, or replace professional care. You decide what it remembers.",

  roleSupport:
    "Nura is a health and wellbeing companion: it organises, remembers, and checks in. It does not diagnose, prescribe, change medication, or replace clinicians, therapists, or the people who care for you in real life.",

  onboardingHeadline: "A companion that checks in on you.",

  onboardingSupport:
    "Tell Nura how things are going in plain words. It keeps a simple Care plan around your day and checks in gently — by message, WhatsApp or a short call.",

  footerLine: "A health and wellbeing companion that checks in on you.",

  /** Shown on the public site so reviewers and visitors can see the cost without signing up */
  pricingLine:
    "Free to start. Nura Plus is US$9.99 a month after a 14-day free trial (the price may vary by region), and you can cancel any time.",

  /** Crisis signposting for every public page footer. Nura is not an emergency service. */
  crisisLine:
    "Nura is not an emergency service. If you are in crisis or someone is in danger, call 999 (UK) or 911 (US). In the UK, Samaritans are on 116 123, any time; in the US, call or text 988.",
} as const;
