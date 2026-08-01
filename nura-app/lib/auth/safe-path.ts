/**
 * Allow only same-origin relative paths for auth redirects.
 * Rejects protocol-relative (`//evil.com`) and absolute URLs.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/today"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  // Block scheme-like tricks: /%2f%2fevil.com or /\evil
  try {
    const decoded = decodeURIComponent(trimmed);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  } catch {
    return fallback;
  }
  return trimmed;
}
