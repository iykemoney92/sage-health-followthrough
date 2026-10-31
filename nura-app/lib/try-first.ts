/**
 * "Try Nura first": a visitor types what's going on on the home page and sees the Care plan and
 * first check-in Nura would make, before any account. What they typed is kept only in their own
 * browser (localStorage) so onboarding can start from it after sign-up; nothing is stored on our
 * side until they sign up and finish onboarding.
 */
export const TRY_FIRST_MIN_CHARS = 12;
export const TRY_FIRST_MAX_CHARS = 1500;

const STORAGE_KEY = "nura.tryFirst";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type TryFirstResult = {
  plan: { title: string; why_this_exists: string; current_focus: string; next_step: string };
  checkIn: { when: string; channel: "whatsapp" | "in_app" | "voice"; message: string };
};

export function saveTryFirst(text: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: text.slice(0, TRY_FIRST_MAX_CHARS), at: Date.now() }));
  } catch {
    // Private mode or storage blocked: onboarding just starts empty.
  }
}

export function readTryFirst(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { text?: unknown; at?: unknown };
    if (typeof saved.text !== "string" || typeof saved.at !== "number") return null;
    if (Date.now() - saved.at > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return saved.text.trim() || null;
  } catch {
    return null;
  }
}

export function clearTryFirst() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
