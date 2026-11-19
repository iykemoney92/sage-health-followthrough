import { APPOINTMENT_GUIDES } from "./data/appointments";
import { CARE_PLAN_GUIDES } from "./data/care-plans";
import { CARER_GUIDES } from "./data/carers";
import { CARING_GUIDES } from "./data/caring";
import { CHRISTMAS_GUIDES } from "./data/christmas";
import { COMPANION_GUIDES } from "./data/companion";
import { ELDERLY_PARENT_GUIDES } from "./data/elderly-parents";
import { MEDICATION_GUIDES } from "./data/medication";
import { REMINDER_GUIDES } from "./data/reminders";
import { ROUTINE_GUIDES } from "./data/routines";
import { RECOVERY_GUIDES, SYMPTOM_GUIDES } from "./data/symptoms-recovery";
import { WELLBEING_GUIDES } from "./data/wellbeing";
import type { Guide, GuideCategory } from "./types";

export type { Guide, GuideCategory } from "./types";

export const GUIDES: Guide[] = [
  ...MEDICATION_GUIDES,
  ...REMINDER_GUIDES,
  ...APPOINTMENT_GUIDES,
  ...SYMPTOM_GUIDES,
  ...RECOVERY_GUIDES,
  ...CARING_GUIDES,
  ...CARER_GUIDES,
  ...ELDERLY_PARENT_GUIDES,
  ...CARE_PLAN_GUIDES,
  ...ROUTINE_GUIDES,
  ...WELLBEING_GUIDES,
  ...CHRISTMAS_GUIDES,
  ...COMPANION_GUIDES,
];

/** Index page order and headings. */
export const GUIDE_CATEGORIES: { id: GuideCategory; label: string }[] = [
  { id: "companion", label: "An AI companion that checks in on you" },
  { id: "routines", label: "Routines and wellbeing" },
  { id: "elderly", label: "Looking out for an older parent" },
  { id: "caring", label: "Caring for someone" },
  { id: "care-plans", label: "Care plans" },
  { id: "medication", label: "Medicine reminders" },
  { id: "appointments", label: "Appointments and results" },
  { id: "symptoms", label: "Symptoms between appointments" },
  { id: "recovery", label: "Recovery after hospital or surgery" },
];

const BY_SLUG = new Map(GUIDES.map((guide) => [guide.slug, guide]));

export function getGuide(slug: string): Guide | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Hand-picked related guides first, then others from the same category, up to `limit`. */
export function relatedGuides(guide: Guide, limit = 4): Guide[] {
  const picked = guide.related.map((slug) => BY_SLUG.get(slug)).filter((g): g is Guide => Boolean(g));
  for (const other of GUIDES) {
    if (picked.length >= limit) break;
    if (other.slug !== guide.slug && other.category === guide.category && !picked.includes(other)) picked.push(other);
  }
  return picked.slice(0, limit);
}

/** The tagged links every guide's call to action uses (marketing/utm/tagged-links.md). */
export const GUIDE_UTM = "utm_source=site&utm_medium=web&utm_campaign=nura_nov26&utm_content=guide";
export const GUIDE_SIGNUP_HREF = `/signup?${GUIDE_UTM}`;
