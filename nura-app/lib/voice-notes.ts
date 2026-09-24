/** Shared between the chat client and /api/messages - keep the two sides agreeing on the bucket. */
export const VOICE_NOTES_BUCKET = "voice-notes";
/** Longest single voice note the composer will record before it stops and sends on its own. */
export const MAX_VOICE_NOTE_MS = 5 * 60_000;
/** Below this the recorder treats a tap as accidental rather than a message. */
export const MIN_VOICE_NOTE_MS = 700;
/** Server-side ceiling for a stored recording (opus at ~12 KB/s comfortably fits 5 minutes). */
export const MAX_VOICE_NOTE_BYTES = 6 * 1024 * 1024;
