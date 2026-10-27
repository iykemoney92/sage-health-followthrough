/**
 * Free tools under /tools: in the browser, no sign-up, no cost per use. One today, so there is
 * no /tools index yet; add one when a second tool arrives.
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
  ],
};

export const TOOLS: NuraTool[] = [MEDICINE_SCHEDULE_TOOL];

export function toolForGuide(slug: string): NuraTool | undefined {
  return TOOLS.find((tool) => tool.guides.includes(slug));
}

/** The tagged sign-up link each tool's call to action uses (marketing/utm/tagged-links.md). */
export function toolSignupHref(tool: NuraTool) {
  return `/signup?utm_source=site&utm_medium=web&utm_campaign=nura_nov26&utm_content=tool-${tool.slug}`;
}
