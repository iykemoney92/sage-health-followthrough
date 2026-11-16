/**
 * Watch pages at /videos/<slug> so search engines can index Nura's videos (VideoObject JSON-LD,
 * a video sitemap entry and a visible transcript on each page).
 *
 * Rules:
 * - Companion-first only. The 15 Oct walkthrough and the "Nura in 30 seconds" clip are GP and
 *   blood-pressure framed and must not get watch pages (memory: nura-companion-positioning).
 * - Transcripts are faithful: `spoken` lines are what is actually said (checked against the final
 *   audio with whisper.cpp), and `onScreen` lines are the captions as they appear. Never paraphrase
 *   words into someone's mouth.
 * - Files live in public/videos/watch; durations were measured with ffprobe.
 */

export type VideoScene = {
  /** Start time in seconds. */
  at: number;
  /** What is on screen, described plainly. */
  shows: string;
  /** On-screen caption text, verbatim. */
  onScreen?: string;
  /** Spoken words, verbatim. */
  spoken?: string;
};

export type NuraVideo = {
  slug: string;
  title: string;
  /** <title>, kept under 60 characters with the " · Nura" suffix. */
  seoTitle: string;
  description: string;
  /** Short answer-first summary shown above the video. */
  summary: string;
  src: string;
  poster: string;
  width: number;
  height: number;
  seconds: number;
  uploadDate: string;
  /** Same video on YouTube, when there is one. */
  youtubeId?: string;
  hasVoice: boolean;
  /** Shown under the video, e.g. the AI-presenter disclosure. */
  note?: string;
  scenes: VideoScene[];
  /** Guides this video belongs next to. Must exist in GUIDES. */
  guides: string[];
};

export const VIDEOS: NuraVideo[] = [
  {
    slug: "nura-ai-wellbeing-companion",
    title: "Nura, your AI wellbeing companion",
    seoTitle: "Nura: an AI wellbeing companion (video)",
    description:
      "A 41-second look at Nura: it reads sleep and steps from Apple Health, links them to what you're working on, like work stress, and checks in by chat or call.",
    summary:
      "Nura is an AI wellbeing companion. In this 41-second video, someone sleeping about five hours and unable to switch off after work sees how Nura links sleep and steps to what they're working on, builds a plan with a check-in already booked, chats any time and calls to check in.",
    src: "/videos/watch/nura-ai-wellbeing-companion.mp4",
    poster: "/videos/watch/nura-ai-wellbeing-companion-poster.jpg",
    width: 720,
    height: 1280,
    seconds: 41,
    uploadDate: "2026-11-15",
    youtubeId: "-sJhPl65aO8",
    hasVoice: true,
    note: "The two presenters are AI-generated and labelled as such in the video. The app clips are real recordings of usenura.app with a demo account. The health screens are an illustration, not a recording.",
    scenes: [
      {
        at: 0,
        shows: "A man in a work lanyard sits on his sofa late in the evening.",
        spoken: "Work's been non-stop. I'm sleeping about five hours, and I just can't switch off.",
      },
      {
        at: 6,
        shows: "A woman at her kitchen table talks to the camera.",
        spoken: "So I use Nura, an AI wellbeing companion.",
      },
      {
        at: 10,
        shows: "An illustration: a week of sleep and steps synced from Apple Health or Health Connect, then linked to goals (stress, wellbeing, work stress), with the note that short nights and fewer steps came in a heavy work week, so the focus is switching off after work.",
        onScreen: "1 Your sleep & steps, synced · 2 Linked to what you're working on",
        spoken: "It reads my sleep and steps from Apple Health and links them to what I'm working on, like work stress.",
      },
      {
        at: 19,
        shows: "Back to the woman at the table.",
        spoken: "Here's the real app.",
      },
      {
        at: 20,
        shows: "Live app clips: picking what you're working on, describing what's going on, choosing a phone-call check-in, the Today screen with the plan \"Unwinding After Nonstop Work\" and a check-in booked, then a chat reply.",
        onScreen: "Pick what you're working on · Tell it what's going on · Pick a call check-in · Your plan, check-in booked · Chat to it any time",
        spoken: "Pick what you're working on, tell it what's going on, and it builds your plan with a check-in already booked. And you can chat to it any time.",
      },
      {
        at: 28,
        shows: "An illustration: a chat that already knows your week, an incoming Nura check-in call, then a loop of health data, goals, chat and call check-ins.",
        onScreen: "3 Chat, and it already knows your week · 4 Then Nura calls to check in · Every check-in builds on the last · Your first check-in is free",
        spoken: "So when I chat, it already knows my week. Then it calls to check in, and picks up right where we left off. Your first check-in's free.",
      },
      {
        at: 37,
        shows: "The woman smiles, then the end card.",
        onScreen: "Nura · Your AI wellbeing companion · usenura.app · First check-in free · iPhone, Android & web",
        spoken: "Tap the link.",
      },
    ],
    guides: [
      "how-to-fix-your-sleep-schedule",
      "how-to-manage-stress-from-work",
      "daily-wellbeing-check-in",
      "how-to-get-into-a-sleep-routine",
    ],
  },
  {
    slug: "check-in-on-someone-you-care-for",
    title: "Check in on someone you care for",
    seoTitle: "Check in on someone you care for (video)",
    description:
      "How Nura checks in on a parent who lives alone: add their number, they say yes on a link, and Nura calls in their daytime and tells you how it went.",
    summary:
      "If a parent lives alone and you can't call every day, Nura can check in for you. This 42-second video shows setting it up for \"Mum\": choose \"Someone I care for\", add her number, and Nura only calls once she says yes. It calls in her daytime and tells you how it went.",
    src: "/videos/watch/check-in-on-someone-you-care-for.mp4",
    poster: "/videos/watch/check-in-on-someone-you-care-for-poster.jpg",
    width: 720,
    height: 1280,
    seconds: 42,
    uploadDate: "2026-11-16",
    hasVoice: false,
    note: "There is no voice-over; the transcript below is the on-screen text, plus a short description of each scene. The app screens are real recordings of usenura.app with a demo account.",
    scenes: [
      {
        at: 0,
        shows: "Title card.",
        onScreen: "Mum lives alone. You can't call every day. Nura can check in for you.",
      },
      {
        at: 4,
        shows: "In Nura, the Care plan setup asks \"Who is this Care plan for?\". \"Someone I care for\" is chosen (Nura calls them, with their OK, and tells you how it went). The first name Margaret, the relationship Parent, a phone number and the time zone Europe/London are filled in, and \"I'll send them a link to say yes\" is selected.",
        onScreen: "Choose \"Someone I care for\" and add Mum's number",
      },
      {
        at: 19,
        shows: "Title card.",
        onScreen: "Nura only calls once Mum says yes. You send her a link. She taps Yes.",
      },
      {
        at: 23.5,
        shows: "Title card.",
        onScreen: "She can say \"stop\" on any call. Calls only in her daytime.",
      },
      {
        at: 28,
        shows: "The Care plan screen: \"Nura checks in with Margaret. Nura calls Margaret during her daytime (Europe/London) and tells you how it went. Margaret can say stop on any call.\" A note says Nura is waiting for Margaret to say yes and won't call until she does, with a button to send her the link.",
        onScreen: "Nura calls in her daytime and tells you how it went",
      },
      {
        at: 37,
        shows: "End card.",
        onScreen: "Nura · Check in on someone you care for · usenura.app · On iPhone, Android and the web · Calls to someone you care for are part of Nura Plus. Nura is a wellbeing companion, not an emergency service.",
      },
    ],
    guides: [
      "daily-check-in-calls-for-elderly-parents",
      "how-to-check-on-an-elderly-parent-who-lives-alone",
      "worried-about-elderly-parent-living-alone",
      "app-to-check-on-elderly-parents",
    ],
  },
];

const BY_SLUG = new Map(VIDEOS.map((video) => [video.slug, video]));

export function getVideo(slug: string): NuraVideo | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Videos that list this guide. */
export function videosForGuide(guideSlug: string): NuraVideo[] {
  return VIDEOS.filter((video) => video.guides.includes(guideSlug));
}

/** ISO 8601 duration, e.g. 41 -> "PT41S", 153 -> "PT2M33S". */
export function isoDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `PT${m}M${s}S` : `PT${s}S`;
}

export function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
