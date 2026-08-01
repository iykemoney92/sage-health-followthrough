/** Shared Journey naming + category helpers for onboarding and chat intake. */

export const PLAN_CATEGORIES = [
  "gp_follow_up",
  "medication_follow_through",
  "symptom_monitoring",
  "mental_wellbeing",
  "sleep_energy",
  "recovery_aftercare",
  "postpartum_aftercare",
  "occupational_stress",
  "therapy_follow_through",
  "caregiver_support",
  "personal_hygiene",
  "general_health",
] as const;

export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export type JourneyDraftFields = {
  title: string;
  category: PlanCategory;
  why_this_exists: string;
  current_focus: string;
  next_step: string;
};

const VAGUE_TITLE = /^(stabilise my week|stabilize my week|watch and follow-?up|whatsapp follow-?up|follow-?up|health journey|new journey|my journey)$/i;

/** Greetings / one-word fluff that shouldn't drive Today copy or Journey focus. */
const THIN_UTTERANCE =
  /^(hi+|hello|hey|yo|sup|hiya|ok|okay|k|thanks|thank you|ty|bye|good (morning|afternoon|evening)|howdy)[\s!.?]*$/i;

export function isUsefulDisplayText(text: string | null | undefined, minChars = 12): boolean {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length < minChars) return false;
  if (THIN_UTTERANCE.test(cleaned)) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 3 && cleaned.length < 24) return false;
  return true;
}

/** Prefer a real Journey focus sentence; fall back when the stored value is junk like "Hi". */
export function displayJourneyFocus(focus: string | null | undefined, fallback: string) {
  const cleaned = (focus || "").replace(/\s+/g, " ").trim();
  if (!isUsefulDisplayText(cleaned, 8)) return fallback;
  return cleaned;
}

export function isPlanCategory(value: unknown): value is PlanCategory {
  return typeof value === "string" && (PLAN_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeJourneyTitle(title: string, fallback: string) {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned || VAGUE_TITLE.test(cleaned)) return fallback;
  // Keep titles short and scannable on Today cards.
  const words = cleaned.split(" ");
  if (words.length > 6) return words.slice(0, 6).join(" ");
  return cleaned;
}

/** Prompt fragment shared by Claude Journey draft paths. */
export const JOURNEY_NAMING_GUIDANCE =
  "Care plan titles must be specific and human (3–6 words), rooted in what the user actually shared — e.g. \"Headaches & night tablet\", \"GP review in two weeks\", \"Sleep after night shift\". " +
  "Never use vague titles like \"Watch and Follow-Up\", \"Stabilise My Week\", \"Health Care plan\", or bare \"Follow-Up\". " +
  "Also set category to the best match from: " +
  PLAN_CATEGORIES.join(", ") +
  ".";

export function inferJourneyDraft(text: string, attachmentHints: string[] = []): JourneyDraftFields {
  const blob = `${text}\n${attachmentHints.join("\n")}`.toLowerCase();

  if (/medication|tablet|dose|prescription|pill|amitriptyline|mg\b/.test(blob)) {
    return {
      title: "New medication follow-through",
      category: "medication_follow_through",
      why_this_exists: "You shared a medication change that needs gentle follow-through.",
      current_focus: "Notice how you’re responding and keep the dosing routine steady.",
      next_step: "Nura will check in about how the medication is feeling.",
    };
  }

  if (/headache|migraine|symptom|pain|fever|dizzy/.test(blob)) {
    return {
      title: "Symptoms to watch",
      category: "symptom_monitoring",
      why_this_exists: "You want help keeping an eye on symptoms between appointments.",
      current_focus: "Track what changes and when to speak to your clinician.",
      next_step: "Nura will check in on how symptoms have been.",
    };
  }

  if (/sleep|insomnia|tired|exhausted|night wake|drowsy/.test(blob)) {
    return {
      title: "Sleep & energy",
      category: "sleep_energy",
      why_this_exists: "Sleep and energy have been off, and follow-through would help.",
      current_focus: "Keep nights steadier with small, realistic steps.",
      next_step: "Nura will check in on how sleep has been going.",
    };
  }

  if (/hygiene|personal care|self.?care routine|brush|shower|groom|oral care|skincare|skin care/.test(blob)) {
    return {
      title: "Personal health & hygiene",
      category: "personal_hygiene",
      why_this_exists: "You want help staying on top of personal health and hygiene routines.",
      current_focus: "Keep daily care habits steady with gentle check-ins.",
      next_step: "Nura will check in on how routines have been going.",
    };
  }

  if (/pregnan|postpartum|post-partum|post natal|postnatal|newborn|nursing mother|breastfeed|breast feed|after birth|afterbaby|after baby|fourth trimester|maternity leave|antenatal|prenatal/.test(blob)) {
    return {
      title: "Pregnancy & postpartum",
      category: "postpartum_aftercare",
      why_this_exists: "You’re in pregnancy or postpartum and want steady, midwife-like support between visits.",
      current_focus: "Recovery, feeding, mood, pregnancy follow-through, and the next small step of care.",
      next_step: "Nura will check in gently on how you and baby are doing.",
    };
  }

  if (/work stress|workplace|burnout|occupational|shift work|night shift|job stress|manager|deadline/.test(blob)) {
    return {
      title: "Work stress",
      category: "occupational_stress",
      why_this_exists: "Work pressure is spilling into health and needs organised follow-through.",
      current_focus: "Keep the next work-related step small and notice what helps.",
      next_step: "Nura will check in on how work has been feeling.",
    };
  }

  if (/overwhelm|anxiet|stress|mood|mental|depress/.test(blob)) {
    return {
      title: "Stress & overwhelm",
      category: "mental_wellbeing",
      why_this_exists: "You’re carrying stress that deserves gentle check-ins.",
      current_focus: "Keep the next step small and notice what helps.",
      next_step: "Nura will check in on how things have felt.",
    };
  }

  if (/gp|clinic|doctor|appointment|follow.?up|review|discharge/.test(blob)) {
    return {
      title: "Clinic follow-up",
      category: "gp_follow_up",
      why_this_exists: "There’s clinic follow-through to keep organised between visits.",
      current_focus: "Hold onto the plan from the visit and notice what changes.",
      next_step: "Nura will check in before the next review point.",
    };
  }

  return {
    title: "Health follow-through",
    category: "general_health",
    why_this_exists: "You shared something that would benefit from gentle follow-through.",
    current_focus: "Keep the next step small and track what changes.",
    next_step: "Nura will check in soon.",
  };
}

export function categoryLabel(category: string) {
  switch (category) {
    case "mental_wellbeing":
      return { tag: "Mental wellbeing", tone: "wellbeing" };
    case "sleep_energy":
      return { tag: "Sleep & energy", tone: "wellbeing" };
    case "therapy_follow_through":
      return { tag: "Therapy follow-through", tone: "wellbeing" };
    case "caregiver_support":
      return { tag: "Caregiver support", tone: "wellbeing" };
    case "medication_follow_through":
      return { tag: "Medication", tone: "medication" };
    case "gp_follow_up":
      return { tag: "Clinic follow-up", tone: "clinic" };
    case "symptom_monitoring":
      return { tag: "Symptoms", tone: "symptoms" };
    case "recovery_aftercare":
      return { tag: "Recovery", tone: "recovery" };
    case "postpartum_aftercare":
      return { tag: "Pregnancy & postpartum", tone: "postpartum" };
    case "occupational_stress":
      return { tag: "Work stress", tone: "work" };
    case "personal_hygiene":
      return { tag: "Personal health & hygiene", tone: "hygiene" };
    default:
      return { tag: "Personal health", tone: "health" };
  }
}

export function channelLabel(channel: string | null | undefined) {
  if (channel === "voice") return "Phone call";
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "in_app") return "In the app";
  return "Check-in";
}

export function formatCheckInWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Soon";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const time = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
