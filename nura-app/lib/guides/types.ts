/**
 * Public guides at /guides/<slug>: one page per question people type into a search box that
 * Nura genuinely helps with ("how to remember to take medication", "how to check on an elderly
 * parent who lives alone").
 *
 * Copied from what brings Radily its search visits: each entry is a full, hand-written answer,
 * not a keyword swapped into a template. The fields that do the work are `answer` (one sentence
 * that stands alone as a snippet), `why` (what makes it harder than it sounds) and `avoid` (the
 * thing people try first that doesn't hold).
 *
 * Accuracy rules for anything added here:
 * - Health facts only where an official source says them; put that source in `sources`.
 * - Never diagnose, never give or change a dose, never put a number on anyone's risk.
 * - `nura` may only describe what the live product does (check the code, not the pitch).
 */

export type GuideCategory = "medication" | "appointments" | "symptoms" | "recovery" | "caring" | "routines";

export type GuideStep = {
  title: string;
  body: string;
};

export type GuideFaq = {
  q: string;
  a: string;
};

export type GuideSource = {
  label: string;
  url: string;
};

export type Guide = {
  slug: string;
  category: GuideCategory;
  /** The query as people type it; the page's H1. */
  question: string;
  /** <title>, before the " · Nura" suffix. Keep it under ~50 characters. */
  title: string;
  /** Meta description, under 160 characters. */
  description: string;
  /** The direct answer, one or two sentences. Written to stand alone as a snippet. */
  answer: string;
  /** Why it is harder than it sounds. */
  why: string;
  steps: GuideStep[];
  /** What people usually try first that tends not to hold. */
  avoid: string[];
  /** Where Nura fits. Live features only. */
  nura: string;
  faqs: GuideFaq[];
  /** Official sources for the health facts on the page. */
  sources: GuideSource[];
  /** Slugs of related guides. Must exist in GUIDES. */
  related: string[];
};
