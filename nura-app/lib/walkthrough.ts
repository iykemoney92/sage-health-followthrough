/**
 * The narrated Nura walkthrough (source: zapx-labs/marketing/nura-walkthrough). Captions are
 * burned into the video, so there is no separate caption track. Both cuts are remuxed with
 * +faststart so playback starts before the whole file has downloaded.
 */
export const WALKTHROUGH_VIDEOS = {
  landscape: {
    src: "/walkthrough/nura-walkthrough-landscape.mp4",
    poster: "/walkthrough/nura-walkthrough-landscape-poster.jpg",
  },
  portrait: {
    src: "/walkthrough/nura-walkthrough-portrait.mp4",
    poster: "/walkthrough/nura-walkthrough-portrait-poster.jpg",
  },
} as const;

export const WALKTHROUGH_LENGTH_LABEL = "2½-minute";

/**
 * Stored on the account (auth user_metadata), not in the browser, so the welcome pops once per
 * person rather than once per device - the same pattern as the AI-consent timestamp.
 */
export const WALKTHROUGH_SEEN_METADATA_KEY = "walkthrough_seen_at";

export function hasSeenWalkthrough(user: { user_metadata?: Record<string, unknown> } | null | undefined) {
  return Boolean(user?.user_metadata?.[WALKTHROUGH_SEEN_METADATA_KEY]);
}
