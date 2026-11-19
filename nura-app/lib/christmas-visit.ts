/**
 * Christmas 2026 on Today: "Seeing family this Christmas? Set up a check-in before you leave."
 * Shown from 14 December 2026 to 4 January 2027 by the person's own local date, to people who
 * don't yet have a plan for someone they care for, then it takes itself down
 * (components/christmas-visit-card.tsx).
 */
export type ChristmasVisitCopy = { phase: "before" | "after"; title: string; text: string };

const day = (d: Date) => d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate();
const FIRST = 2026_12_14;
const BOXING_DAY = 2026_12_26;
const LAST = 2027_01_04;

export function christmasVisitCopy(now: Date): ChristmasVisitCopy | null {
  const today = day(now);
  if (today < FIRST || today > LAST) return null;
  if (today < BOXING_DAY) {
    return {
      phase: "before",
      title: "Seeing family this Christmas?",
      text: "Set up a check-in for someone you care for before you head home. Nura rings them, with their OK, and tells you how it went.",
    };
  }
  return {
    phase: "after",
    title: "Home again after Christmas?",
    text: "Keep in touch through January. Nura can ring someone you care for, with their OK, and tell you how it went.",
  };
}

/** `?xmasPreview=2026-12-20` shows the card as it will look on that day. */
export function christmasVisitDate(search: string, now: Date = new Date()): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(new URLSearchParams(search).get("xmasPreview") ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : now;
}
