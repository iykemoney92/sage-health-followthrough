import type { GuideMedia, GuideTeaser } from "../types";

/**
 * Real product images for guide pages (public/guides). Frames come from Nura's own screen
 * recordings with demo accounts (marketing/nura-companion-video, marketing/nura-care-video).
 * Kept here so each image carries one accurate alt text wherever it is reused.
 * Avoid frames that show GP, blood-pressure or "new medication" wording (companion framing).
 */
type Img = { src: string; width: number; height: number; alt: string };

export const IMG = {
  tryMum: {
    src: "/guides/try-plan-checking-in-on-mum.webp",
    width: 1000,
    height: 755,
    alt: "A plan Nura wrote from one sentence about a mum who lives alone: checking in on her remotely, with a suggested Saturday check-in asking how she's doing with eating and getting out for walks",
  },
  someoneICareFor: {
    src: "/guides/someone-i-care-for.webp",
    width: 600,
    height: 1022,
    alt: "Nura's Care plan screen with \"Someone I care for\" chosen: Nura calls them, with their OK, and tells you how it went, only in their daytime",
  },
  whoIsThisFor: {
    src: "/guides/who-is-this-care-plan-for.webp",
    width: 600,
    height: 1212,
    alt: "Nura asking who a Care plan is for, with \"Someone I care for\" chosen (Nura calls them, with their OK, and tells you how it went), and fields for their first name, relationship and phone number",
  },
  howTheyAgree: {
    src: "/guides/how-they-agree-to-calls.webp",
    width: 600,
    height: 1212,
    alt: "Setting up calls for a parent called Margaret: her number, her time zone (Nura only calls in her daytime) and how she'll agree to calls, with \"I'll send them a link to say yes\" selected",
  },
  checksInWithMargaret: {
    src: "/guides/nura-checks-in-with-margaret.webp",
    width: 600,
    height: 1212,
    alt: "A Care plan showing \"Nura checks in with Margaret\": Nura calls her in her daytime and tells you how it went, she can say stop on any call, and Nura won't call until she says yes",
  },
  channels: {
    src: "/guides/check-in-channels.webp",
    width: 600,
    height: 1200,
    alt: "Nura's setup screen for how check-ins reach you: in the app, on WhatsApp, or as a short phone call",
  },
  todayCard: {
    src: "/guides/today-check-in-card.webp",
    width: 600,
    height: 1200,
    alt: "Nura's Today screen with a check-in card, \"Unwinding after nonstop work\", asking how tonight's wind-down is going, with Do check-in, Message Nura and Reschedule buttons",
  },
  goals: {
    src: "/guides/what-do-you-want-help-with.webp",
    width: 600,
    height: 1200,
    alt: "Nura's first screen, \"What do you want help with?\", with sleep and routine, stress or emotional wellbeing, energy, movement and habits, work stress, and looking out for someone you care for",
  },
  chatSleep: {
    src: "/guides/chat-sleep-check-in.webp",
    width: 600,
    height: 1200,
    alt: "A Nura conversation: someone says work has been non-stop and they're sleeping about five hours; Nura builds a Care plan, schedules a check-in, and replies kindly to \"Another late one\"",
  },
  describe: {
    src: "/guides/tell-nura-whats-going-on.webp",
    width: 600,
    height: 1200,
    alt: "Nura's \"Tell Nura what's going on\" screen, with starters such as feeling overwhelmed, sleep and routine, work stress and a habit that sticks, and a box to write it in your own words",
  },
} satisfies Record<string, Img>;

export function media(img: Img, caption: string, link?: GuideMedia["link"]): GuideMedia {
  return { ...img, caption, ...(link ? { link } : {}) };
}

export const TRY_LINK: GuideMedia["link"] = { href: "/#try", label: "Try it with your own situation, no sign-up", cta: "try_first" };

export function teaser(img: Img, title: string, body: string, label: string, cta: string): GuideTeaser {
  return { ...img, title, body, href: "signup", label, cta };
}

/** The teaser most caring guides use. */
export const CARE_FOR_TEASER = teaser(
  IMG.someoneICareFor,
  "Can't call every day? Nura can check in for you",
  "Choose \"Someone I care for\", add their first name and number, and send them a link. Once they say yes, Nura gives them a short call in their daytime and tells you how it went.",
  "Start a Care plan free",
  "care_for_someone",
);

/** The teaser most routine and wellbeing guides use. */
export const CHECK_IN_TEASER = teaser(
  IMG.todayCard,
  "A check-in that actually comes back",
  "Tell Nura what you're working on, in your own words. It keeps a simple Care plan and checks in at the times that suit you, in the app, on WhatsApp or with a short call.",
  "Start free with Nura",
  "check_in",
);
