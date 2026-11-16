/**
 * Real Clariti screenshots for /guides pages (public/guides/). Captured 16 Nov 2026
 * from the live app, signed in as the @example.com demo account, on the invented
 * Northside Family Clinic bill used in the Clariti walkthrough video — the analysis
 * the app produced on 15 Oct 2026, not a mock-up. Re-capture rather than edit them.
 */

export type GuideShot = { src: string; width: number; height: number; alt: string };

export const SHOT_BILL_SUMMARY: GuideShot = {
  src: "/guides/clariti-bill-summary.webp",
  width: 600,
  height: 1187,
  alt: "Clariti’s summary of an invented clinic bill: $1,286.40 charged, a $214.40 insurance adjustment, $760 paid by insurance, and a plain-English explanation that names the 99214 office visit",
};

export const SHOT_BILL_CHARGES: GuideShot = {
  src: "/guides/clariti-bill-charges.webp",
  width: 600,
  height: 1284,
  alt: "Clariti’s charge breakdown of an invented clinic bill: office visit, chest X-ray and its reading, a metabolic panel, a lab handling fee, a facility fee and a vague unlisted supply charge, each in plain English",
};

export const SHOT_BILL_NEXT_STEPS: GuideShot = {
  src: "/guides/clariti-bill-next-steps.webp",
  width: 600,
  height: 1228,
  alt: "Clariti’s suggested next steps for an invented clinic bill: compare it with the EOB, ask the billing office about the unlisted supply charge, keep a copy, and ask about a payment plan",
};
