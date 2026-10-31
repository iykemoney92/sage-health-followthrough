import type { LucideIcon } from "lucide-react";
import { Activity, Baby, Brain, BriefcaseMedical, Droplets, Ellipsis, HeartHandshake, Moon, Pill, Sparkles } from "lucide-react";

// Companion first (Ike, 31 Oct 2026): onboarding leads with how someone is living and feeling
// (sleep, stress, energy, habits, the people they look out for), not with GPs, clinics or drugs.
// Medication stays as one option further down for people who want reminders.
export const onboardingInterests = [
  ["Sleep and routine", Moon],
  ["Stress or emotional wellbeing", Brain],
  ["Energy, movement and habits", Activity],
  ["Work stress or burnout", BriefcaseMedical],
  ["Looking out for someone I care for", HeartHandshake],
  ["Pregnancy & postpartum", Baby],
  ["Getting back on track after time off", Sparkles],
  ["Personal health and hygiene", Droplets],
  ["Remembering medication", Pill],
  ["Something else", Ellipsis],
] as const satisfies ReadonlyArray<readonly [string, LucideIcon]>;

export type OnboardingInterest = (typeof onboardingInterests)[number][0];

export const intakePromptCatalog = [
  ["Sleep & routine", "My sleep and daily routine have been off — I want gentle check-ins to get back on track."],
  ["Feeling overwhelmed", "I’ve been feeling overwhelmed lately and it’s spilling into sleep, work, and how I look after myself."],
  ["More energy", "I want more energy day to day — moving more, drinking more water, and not crashing in the afternoon."],
  ["A habit that sticks", "I keep starting healthier habits and dropping them after a week. I’d like someone to check in so this one sticks."],
  ["Work stress", "Work stress has been building and it’s affecting my sleep, mood, and how I look after myself."],
  [
    "Someone I care for",
    "I want to keep an eye on someone I care for. They live on their own and I’d like gentle check-ins on how they’re doing.",
  ],
  [
    "Pregnancy & postpartum",
    "I’m pregnant or postpartum and want gentle, midwife-like check-ins on how I’m doing — recovery, feeding, mood, or pregnancy follow-through.",
  ],
  [
    "Feeding & baby",
    "Feeding has been hard (breast or bottle) and I want supportive check-ins — without judgment — on how baby and I are managing.",
  ],
  [
    "Recovery after birth",
    "I’m recovering after birth and want gentle follow-ups on pain, energy, bleeding, and when to speak to my midwife or GP.",
  ],
  [
    "Pregnancy check-ins",
    "I’m pregnant and want help holding onto antenatal advice, appointments, and how I’m feeling between visits.",
  ],
  ["Back on track", "I’ve had some time off and I want to ease back into my routine without overdoing it."],
  [
    "Personal health & hygiene",
    "I want help staying on top of personal health and hygiene routines — daily care, habits, and gentle check-ins so nothing slips.",
  ],
  ["Medication reminders", "I want a gentle reminder to take my medication, and someone to notice if I keep missing it."],
] as const;

export type IntakePromptLabel = (typeof intakePromptCatalog)[number][0];

/** Only these labels appear when the matching interest is selected — no unrelated fillers. */
const INTEREST_TO_PROMPTS: Record<string, IntakePromptLabel[]> = {
  "Sleep and routine": ["Sleep & routine", "Feeling overwhelmed", "A habit that sticks"],
  "Stress or emotional wellbeing": ["Feeling overwhelmed", "Sleep & routine", "Work stress"],
  "Energy, movement and habits": ["More energy", "A habit that sticks", "Sleep & routine"],
  "Work stress or burnout": ["Work stress", "Feeling overwhelmed", "Sleep & routine"],
  "Looking out for someone I care for": ["Someone I care for"],
  "Pregnancy & postpartum": [
    "Pregnancy & postpartum",
    "Pregnancy check-ins",
    "Recovery after birth",
    "Feeding & baby",
  ],
  "Getting back on track after time off": ["Back on track", "More energy", "Sleep & routine"],
  "Personal health and hygiene": ["Personal health & hygiene", "A habit that sticks"],
  "Remembering medication": ["Medication reminders"],
  "Something else": ["Feeling overwhelmed", "More energy", "Sleep & routine"],
};

export function applyIntakePrompt(label: string) {
  return intakePromptCatalog.find(([item]) => item === label)?.[1] ?? "";
}

/**
 * Starters for the selected interests only — never pads with unrelated templates.
 * Order follows INTEREST_TO_PROMPTS so the most relevant chip comes first.
 */
export function promptsForInterests(selected: string[]) {
  if (selected.length === 0) return [...intakePromptCatalog].slice(0, 6);

  const orderedLabels: IntakePromptLabel[] = [];
  const seen = new Set<string>();
  for (const interest of selected) {
    for (const label of INTEREST_TO_PROMPTS[interest] ?? []) {
      if (seen.has(label)) continue;
      seen.add(label);
      orderedLabels.push(label);
    }
  }

  if (orderedLabels.length === 0) return [...intakePromptCatalog].slice(0, 6);

  const byLabel = new Map(intakePromptCatalog.map((row) => [row[0], row]));
  return orderedLabels
    .map((label) => byLabel.get(label))
    .filter((row): row is (typeof intakePromptCatalog)[number] => Boolean(row));
}
