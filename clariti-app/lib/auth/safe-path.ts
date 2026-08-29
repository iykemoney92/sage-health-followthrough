/**
 * Allow only same-origin relative paths for auth redirects.
 *
 * Every `next` value Clariti routes on arrives from somewhere it does not
 * control — a query string, a link in an email, a value parked in
 * sessionStorage across an OAuth round trip. Without this, `?next=//evil.com`
 * turns a sign-in link into an open redirect: the victim sees useclariti.app in
 * the address bar right up to the moment they are handed to the attacker.
 *
 * Duplicated rather than imported from `lib/auth/app-origin`, which also carries
 * request/`VERCEL_URL` logic that has no business in a client bundle.
 */

/** A host nothing can resolve, so a value that escapes to it is unmistakable. */
const PROBE_ORIGIN = "https://clariti.invalid";

export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  // Judge the decoded form too. This one is belt-and-braces — a path separator
  // stays percent-encoded through the URL parser — but `?next=` values get
  // decoded and re-encoded by whatever hands them along, and a round trip that
  // loses one layer of encoding must not turn a rejected value into an accepted
  // one.
  try {
    const decoded = decodeURIComponent(trimmed);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
      return fallback;
    }
  } catch {
    return fallback;
  }
  // The URL parser gets the last word, because it is the thing that decides
  // where the browser actually goes. Tabs and newlines are stripped *before*
  // parsing, so `?next=/%09//evil.com` reaches this function as a real tab, gets
  // past every check above — it starts with a single "/" — and still resolves to
  // https://evil.com. Resolving it here and demanding the origin survive is the
  // only check that cannot drift from the browser's own rules.
  let resolved: URL;
  try {
    resolved = new URL(trimmed, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (resolved.origin !== PROBE_ORIGIN) return fallback;

  // Hand back what was validated rather than the raw input, so nothing the
  // parser normalised away can be reintroduced downstream.
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
