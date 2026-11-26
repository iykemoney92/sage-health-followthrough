/**
 * Free tools under /tools: in the browser, no sign-up, no cost per use. /tools lists them all.
 *
 * `guides` are the /guides slugs that show a box linking to the tool (rendered in
 * app/guides/[slug]/page.tsx). Every tool also needs a line in public/llms.txt and an entry in
 * the sitemap; tools.test.ts checks both.
 */

export type NuraTool = {
  slug: string;
  name: string;
  /** One line for the box on guide pages. */
  blurb: string;
  guides: string[];
};

export const MEDICINE_SCHEDULE_TOOL: NuraTool = {
  slug: "medicine-schedule",
  name: "Free printable medicine schedule",
  blurb:
    "Add each medicine, its dose and when it's taken, and print a weekly chart with tick boxes. It runs in your browser and nothing is uploaded.",
  guides: [
    "how-to-remember-to-take-medication",
    "medication-reminder-for-elderly-parent",
    "missed-a-dose-of-medication-what-to-do",
    "how-to-keep-a-list-of-your-medications",
    "how-to-make-a-medicine-schedule",
    "medication-reminders-on-iphone-and-android",
    "pill-reminders-for-elderly-people",
  ],
};

export const SCAM_CHECKER_TOOL: NuraTool = {
  slug: "is-this-a-scam",
  name: "Is this a scam? Free message and call checker",
  blurb:
    "Paste a text, email or WhatsApp message, or describe a call, and see the common warning signs, with who to tell. It runs in your browser and nothing is sent anywhere.",
  guides: [
    "worried-about-elderly-parent-living-alone",
    "how-to-check-on-an-elderly-parent-who-lives-alone",
    "caring-for-a-parent-from-a-distance",
    "can-my-elderly-parent-live-alone",
  ],
};

export const BRAIN_GAMES_TOOL: NuraTool = {
  slug: "brain-games",
  name: "Free brain games for older adults",
  blurb:
    "A memory match, a daily word puzzle and number games, with large text and no timer unless you want one. Free, no sign-up, nothing to download.",
  guides: [
    "daily-routine-for-elderly-parents",
    "how-to-help-a-lonely-elderly-parent",
    "ai-companion-for-older-adults-living-alone",
  ],
};

export const TOOLS: NuraTool[] = [MEDICINE_SCHEDULE_TOOL, SCAM_CHECKER_TOOL, BRAIN_GAMES_TOOL];

export function toolForGuide(slug: string): NuraTool | undefined {
  return TOOLS.find((tool) => tool.guides.includes(slug));
}

/** The tagged sign-up link each tool's call to action uses (marketing/utm/tagged-links.md). */
export function toolSignupHref(tool: NuraTool) {
  return `/signup?utm_source=site&utm_medium=web&utm_campaign=nura_nov26&utm_content=tool-${tool.slug}`;
}
