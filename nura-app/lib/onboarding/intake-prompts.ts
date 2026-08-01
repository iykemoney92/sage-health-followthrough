import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  Brain,
  BriefcaseMedical,
  ClipboardPlus,
  Droplets,
  Ellipsis,
  Moon,
  Pill,
  Stethoscope,
} from "lucide-react";

export const onboardingInterests = [
  ["Stress or emotional wellbeing", Brain],
  ["Pregnancy & postpartum", Baby],
  ["Personal health and hygiene", Droplets],
  ["Medication follow-through", Pill],
  ["GP or clinic follow-up", Stethoscope],
  ["Symptoms I want to track", Activity],
  ["Sleep and routine", Moon],
  ["Work stress or burnout", BriefcaseMedical],
  ["Recovery or return to work", BriefcaseMedical],
  ["General health organisation", ClipboardPlus],
  ["Something else", Ellipsis],
] as const satisfies ReadonlyArray<readonly [string, LucideIcon]>;

export type OnboardingInterest = (typeof onboardingInterests)[number][0];

export const intakePromptCatalog = [
  ["GP follow-up", "I saw my GP today and they asked me to keep an eye on symptoms and come back if anything changes."],
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
  [
    "Personal health & hygiene",
    "I want help staying on top of personal health and hygiene routines — daily care, habits, and gentle check-ins so nothing slips.",
  ],
  ["New medication", "I started a new medication and I want help remembering doses and how I’m responding."],
  ["Feeling overwhelmed", "I’ve been feeling overwhelmed lately and it’s spilling into sleep, work, and how I look after myself."],
  ["Work stress", "Work stress has been building and it’s affecting my sleep, mood, and how I look after myself."],
  ["Clinic summary", "I have clinic notes or a summary I want Nura to help me organise into clear next steps."],
  ["Sleep & routine", "My sleep and daily routine have been off — I want gentle check-ins to get back on track."],
  ["Drug / prescription info", "I have prescription or drug information to keep with this Care plan so nothing gets lost."],
] as const;

export type IntakePromptLabel = (typeof intakePromptCatalog)[number][0];

/** Only these labels appear when the matching interest is selected — no unrelated fillers. */
const INTEREST_TO_PROMPTS: Record<string, IntakePromptLabel[]> = {
  "Stress or emotional wellbeing": ["Feeling overwhelmed", "Sleep & routine"],
  "Pregnancy & postpartum": [
    "Pregnancy & postpartum",
    "Pregnancy check-ins",
    "Recovery after birth",
    "Feeding & baby",
  ],
  "Personal health and hygiene": ["Personal health & hygiene", "Sleep & routine"],
  "Medication follow-through": ["New medication", "Drug / prescription info"],
  "GP or clinic follow-up": ["GP follow-up", "Clinic summary"],
  "Symptoms I want to track": ["GP follow-up", "Feeling overwhelmed", "Clinic summary"],
  "Sleep and routine": ["Sleep & routine", "Feeling overwhelmed"],
  "Work stress or burnout": ["Work stress", "Feeling overwhelmed", "Sleep & routine"],
  "Recovery or return to work": ["Work stress", "Sleep & routine", "GP follow-up"],
  "General health organisation": ["Clinic summary", "GP follow-up", "Personal health & hygiene"],
  "Something else": ["Feeling overwhelmed", "GP follow-up"],
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
