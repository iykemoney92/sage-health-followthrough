/**
 * /videos watch pages (SEO 1M playbook, "Video watch pages", 16 Nov 2026): one page per
 * Clariti video so Google can index each as a video, with VideoObject JSON-LD, a
 * video sitemap entry and a transcript in visible text.
 *
 * The files are the ones on zapxlabs.com/products/clariti (zapx-labs
 * src/data/product-videos.ts, hosted in the Zapx media Blob store). Durations were
 * measured with ffprobe on those mp4s (90.6 s and 29.4 s).
 *
 * Transcripts must be what is really in the video:
 * - the walkthrough's narration is its voice-over script, word for word
 *   (zapx-labs marketing/clariti-walkthrough/source/script.json);
 * - "Clariti in 30 seconds" has no sound at all (volumedetect: −91 dB), so its
 *   "transcript" is the on-screen text, scene by scene, labelled as such.
 * When seo-youtube adds a YouTube id, add it as `youtubeId` and the page emits embedUrl.
 */

const MEDIA = "https://rd8wcxopkzqdtty4.public.blob.vercel-storage.com/products";

export type VideoScene = { heading: string; text: string };

export type ClaritiVideo = {
  slug: string;
  title: string;
  /** <title> for the watch page, ≤60 characters. */
  metaTitle: string;
  description: string;
  src: string;
  poster: string;
  width: number;
  height: number;
  seconds: number;
  /** ISO 8601 duration for VideoObject. */
  isoDuration: string;
  uploadDate: string;
  youtubeId?: string;
  transcriptKind: "narration" | "on-screen";
  transcript: VideoScene[];
};

export const VIDEOS: ClaritiVideo[] = [
  {
    slug: "clariti-walkthrough",
    title: "Clariti walkthrough",
    metaTitle: "Clariti walkthrough: a medical bill, explained (video)",
    description:
      "Upload a sample medical bill and see Clariti explain every charge in plain English, flag what is worth a second look, and suggest what to ask next.",
    src: `${MEDIA}/clariti-walkthrough.mp4`,
    poster: `${MEDIA}/clariti-walkthrough-poster.jpg`,
    width: 1920,
    height: 1080,
    seconds: 91,
    isoDuration: "PT1M31S",
    uploadDate: "2026-10-15",
    transcriptKind: "narration",
    transcript: [
      {
        heading: "Clariti",
        text: "This is Clariti. Upload a confusing medical bill, insurance statement, scan or lab report, and Clariti explains it in plain English, then helps you work out what to ask next. Here's how it works.",
      },
      { heading: "Bring any health document", text: "Start from Home. Attach a document, take a photo of the paperwork, or paste the text instead." },
      {
        heading: "You decide what's sent",
        text: "Before your first analysis, Clariti tells you exactly where your document goes. Nothing is sent until you agree.",
      },
      { heading: "Attach and ask", text: "Here's a sample bill. Attach it, ask your question in your own words, and send." },
      {
        heading: "The answer, in plain English",
        text: "About half a minute later, the answer arrives: what the bill is for, what you owe, and the charge that's worth a second look.",
      },
      {
        heading: "Every charge, explained",
        text: "Open the full analysis to see every charge in plain English, each one tied back to the line on the bill it came from.",
      },
      {
        heading: "What to do next",
        text: "Next steps turns it into action: what to compare, and what to ask the billing office before you pay.",
      },
      {
        heading: "Everything in one place",
        text: "Every document and analysis is saved, so you can come back to it later, or add a newer report to compare.",
      },
      {
        heading: "Your data, your call",
        text: "And in Settings, you control your data, including exporting it or deleting everything at any time.",
      },
      {
        heading: "Clariti",
        text: "Clariti is free on iPhone and Android. It explains paperwork in plain language. It doesn't diagnose, or replace your doctor.",
      },
    ],
  },
  {
    slug: "clariti-in-30-seconds",
    title: "Clariti in 30 seconds",
    metaTitle: "Clariti in 30 seconds: health paperwork explained (video)",
    description:
      "Upload a medical bill, EOB or radiology report, see what it says in plain English, and go into your next appointment with better questions.",
    src: `${MEDIA}/clariti-30s.mp4`,
    poster: `${MEDIA}/clariti-30s-poster.jpg`,
    width: 1920,
    height: 1080,
    seconds: 29,
    isoDuration: "PT29S",
    uploadDate: "2026-10-07",
    transcriptKind: "on-screen",
    transcript: [
      {
        heading: "Medical bills and reports, explained in plain English.",
        text: "Upload a bill, EOB or radiology report and see what it says. Shown beside the Clariti home screen and an explained MRI report.",
      },
      {
        heading: "What does your MRI report actually say?",
        text: "The findings in everyday words, plus what to ask your doctor. Shown on an example lumbar spine MRI report explained in Clariti.",
      },
      {
        heading: "Confused by a bill or an EOB?",
        text: "Clariti explains each part in plain language. Shown on the Clariti home screen, with its shortcuts for medical bills, insurance EOBs, radiology reports and lab results.",
      },
      {
        heading: "Go into your next appointment with better questions.",
        text: "Clariti suggests what to ask your clinician.",
      },
      {
        heading: "Every explanation, saved to come back to.",
        text: "Pick up any conversation where you left off. Shown on Clariti’s History screen.",
      },
      {
        heading: "Clariti",
        text: "Health paperwork, in plain English. Free on iPhone and Android. Every scene also carries the line “Educational, not a diagnosis”.",
      },
    ],
  },
];

export function getVideo(slug: string) {
  return VIDEOS.find((video) => video.slug === slug);
}
