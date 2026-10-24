/**
 * Short explainers shown on Me → Videos & socials. They are the same cuts posted to TikTok
 * (sources: zapx-labs/marketing/nura-tiktok and nura-care-video), remuxed with +faststart so
 * playback starts before the whole file has downloaded. All are 9:16 with captions burned in.
 * The full walkthrough lives in lib/walkthrough.ts and leads the page.
 */
export type NuraVideo = {
  id: string;
  title: string;
  blurb: string;
  src: string;
  poster: string;
  length: string;
};

export const NURA_VIDEOS: NuraVideo[] = [
  {
    id: "doctor-to-plan",
    title: "From appointment to plan",
    blurb: "Tell Nura what the doctor said and get a plan you can actually follow.",
    src: "/videos/nura-doctor-to-plan.mp4",
    poster: "/videos/nura-doctor-to-plan-poster.jpg",
    length: "1:01",
  },
  {
    id: "check-ins",
    title: "How check-ins work",
    blurb: "Nura comes back at the right moment, and you answer with a tap.",
    src: "/videos/nura-check-ins.mp4",
    poster: "/videos/nura-check-ins-poster.jpg",
    length: "0:37",
  },
  {
    id: "care-circle",
    title: "Your Care circle",
    blurb: "Let family follow a plan without ever reading your chats.",
    src: "/videos/nura-care-circle.mp4",
    poster: "/videos/nura-care-circle-poster.jpg",
    length: "0:27",
  },
  {
    id: "care-for-someone",
    title: "Caring for someone",
    blurb: "Set up check-ins for a parent or partner who could use a nudge.",
    src: "/videos/nura-care-for-someone.mp4",
    poster: "/videos/nura-care-for-someone-poster.jpg",
    length: "1:11",
  },
  {
    id: "your-data",
    title: "Your data, your say",
    blurb: "What Nura shares with its AI, and how to delete everything.",
    src: "/videos/nura-your-data.mp4",
    poster: "/videos/nura-your-data-poster.jpg",
    length: "0:30",
  },
];

export type NuraSocialId = "tiktok" | "youtube" | "instagram";

export type NuraSocial = { id: NuraSocialId; label: string; handle: string; url: string };

/**
 * Nura's own accounts. Only the ones listed here are shown, so add YouTube and Instagram
 * once those accounts exist.
 */
export const NURA_SOCIALS: NuraSocial[] = [
  { id: "tiktok", label: "TikTok", handle: "@nura.ai4", url: "https://www.tiktok.com/@nura.ai4" },
];
