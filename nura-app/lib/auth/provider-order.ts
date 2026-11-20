import type { OAuthProvider } from "@/lib/auth/oauth";

/**
 * Apple first only where people have an Apple ID to hand (iPhone, iPad, Mac).
 * Everywhere else, Android above all, Google goes first: Android users who
 * tapped the top button landed on Apple's sign-in page, had no Apple ID, and
 * left (19 Nov 2026). Apple stays on every platform for Guideline 4.8.
 */
export function providerOrder(userAgent: string | null | undefined): OAuthProvider[] {
  const ua = userAgent ?? "";
  const applePlatform = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua) && !/Android/i.test(ua);
  return applePlatform ? ["apple", "google"] : ["google", "apple"];
}
