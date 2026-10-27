/**
 * Free tools under /tools: in-browser, no sign-up, no cost per use. One today,
 * so there is no /tools index yet; add one when a second tool arrives.
 *
 * `guides` are the /guides slugs that link to the tool (rendered by
 * ToolPromo in app/guides/guide-parts.tsx). Every tool also needs a line in
 * public/llms.txt — tools.test.ts checks it.
 */

export type ClaritiTool = {
  slug: string;
  name: string;
  /** One line for the promo box on guide pages and the /guides index. */
  blurb: string;
  guides: string[];
};

export const EOB_DECODER: ClaritiTool = {
  slug: "eob-decoder",
  name: "Free EOB decoder",
  blurb:
    "Type in the figures from one EOB line to see what each means, what you may owe, whether they add up and whether the provider’s bill matches. Nothing leaves your device.",
  guides: [
    "how-to-read-an-eob",
    "eob-vs-medical-bill",
    "patient-responsibility-on-eob",
    "allowed-amount-on-eob",
    "deductible-copay-coinsurance",
    "claim-denied-on-eob",
  ],
};

export const TOOLS: ClaritiTool[] = [EOB_DECODER];

export function toolForGuide(slug: string) {
  return TOOLS.find((tool) => tool.guides.includes(slug));
}
