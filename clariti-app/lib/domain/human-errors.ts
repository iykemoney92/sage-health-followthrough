/**
 * Machine tokens turned into sentences.
 *
 * Clariti's routes answer failures in words written for code — "unauthorized",
 * "consent_required", "plus_required", a Postgres constraint name, a zod
 * `flatten()` object — and the screens rendered whichever one came back as
 * Clariti's own answer. Attaching a document while signed out ended on the word
 * "unauthorized", printed where the explanation should have been.
 *
 * `formatHumanVideoError` in lib/ai/clariti-video.ts does this job for the video
 * provider; this is the one for the document, auth and billing routes. Same
 * rule in both: when Clariti does not know what went wrong it says so plainly
 * rather than passing an operator's problem to a frightened reader.
 */

/** Used when nothing else fits — never a guess at a cause Clariti cannot see. */
const GENERIC = "Clariti could not finish that. Please try again.";

/**
 * @param status HTTP status of the response that failed, or null for a fetch that
 *   never produced one (an abort, a dropped connection).
 * @param error The `error` field of the payload, or the caught exception.
 * @param fallback What to say when the pair means nothing a reader can act on.
 */
export function formatHumanError(status: number | null | undefined, error: unknown, fallback = GENERIC): string {
  const cleaned = cleanErrorText(error);

  // Checked first: an abort carries no status, and its DOMException message
  // ("signal is aborted without reason") is the least useful sentence a browser
  // produces.
  if (isAbortError(error) || /aborterror|\baborted\b|timed? ?out/i.test(cleaned)) {
    return "That took too long and Clariti stopped waiting. Try a smaller or clearer file, or paste the report text instead.";
  }

  // fetch() rejects rather than resolving when the device is offline, which is
  // the common case inside the app shells on cellular.
  if (status == null && /failed to fetch|load failed|networkerror|network request failed/i.test(cleaned)) {
    return "Clariti could not reach the server. Check your connection and try again.";
  }

  if (/^unauthorized$/i.test(cleaned)) {
    return "Your Clariti session has ended. Sign in again, then send this document.";
  }
  if (/^consent_required$/i.test(cleaned)) {
    return "Clariti needs your permission before it sends a document to the AI model. Agree on the consent screen, then try again.";
  }
  if (/^plus_required$/i.test(cleaned)) {
    return "That is a Clariti Plus feature. Open Billing to upgrade.";
  }

  // Postgres and Supabase Storage answer in relation names, constraint codes,
  // policy names and the vendor's own name. Every one of them is an operator
  // problem, and passing one through tells a reader their bill was refused by
  // "row-level security".
  if (/pgrst\d+|\b(?:23505|23503|42p01|42501|22p02)\b|supabase|relation .* does not exist|column .* does not exist|duplicate key value|violates (?:row-level security|unique|foreign key|not-null)|bucket not found/i.test(cleaned)) {
    return "Clariti could not save this to your account. Your document is not lost — please try again.";
  }

  // Routes that already answer in sentences — the upload size caps, the rate
  // limiter, the "no readable text" refusals — are worth showing verbatim. A
  // bare token has no spaces in it, and a zod flatten() is not a string at all,
  // which is exactly what used to reach the screen.
  if (cleaned && /\s/.test(cleaned) && cleaned.length <= 220 && !/api[_ -]?key|token|secret/i.test(cleaned)) {
    return cleaned;
  }

  if (status === 401) return "Your Clariti session has ended. Sign in again, then send this document.";
  if (status === 402) return "That is a Clariti Plus feature. Open Billing to upgrade.";
  if (status === 403) return "Clariti is not allowed to do that for this account. Sign in again, then try once more.";
  if (status === 413) return "That file is too large to send. Try a smaller photo or scan, or paste the report text instead.";
  if (status === 429) return "You have sent a lot of requests in a short time. Wait a minute, then try again.";
  if (typeof status === "number" && status >= 500) return "Clariti's server had trouble with that. Please try again in a moment.";

  return fallback;
}

function cleanErrorText(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return raw.replace(/\s+/g, " ").trim();
}

/** `instanceof DOMException` is not safe on every runtime this file is bundled for. */
function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}
