/**
 * The US year end on Clariti's home: a short checklist card from 1 to 31 December 2026 by the
 * visitor's own date, then it takes itself down. Each line links to a guide that carries the
 * official sources (IRS, HealthCare.gov, CMS) and says plans differ.
 */
export const YEAR_END_ITEMS = [
  {
    title: "Spend or check your FSA money",
    text: "Most health FSAs are use-it-or-lose-it. Some plans give a grace period or a carryover. Check yours.",
    href: "/guides/fsa-deadline-2026",
  },
  {
    title: "Know what resets on January 1",
    text: "On a calendar-year plan, your deductible and out-of-pocket count usually start again in January.",
    href: "/guides/what-happens-to-my-deductible-on-january-1",
  },
  {
    title: "Check a bill before you pay it",
    text: "Match it to your EOB, look for duplicates, and ask for an itemized bill.",
    href: "/guides/check-a-medical-bill-before-you-pay",
  },
] as const;

const dayKey = (d: Date) => d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate();

/** Shown 1 to 31 December 2026 by local date; `?yearEndPreview=1` shows it early. */
export function yearEndOn(now: Date = new Date(), search = ""): boolean {
  if (/[?&]yearEndPreview=1(&|$)/.test(search)) return true;
  const today = dayKey(now);
  return today >= 2026_12_01 && today <= 2026_12_31;
}
