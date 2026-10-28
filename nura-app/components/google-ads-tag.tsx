"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { flushGoogleAds, googleAdsTrack } from "@/lib/google-ads-tag";
import { AD_CONSENT_EVENT } from "@/lib/quora-pixel";

/**
 * Wires the Google Ads tag (lib/google-ads-tag.ts) into every page so an ad
 * click's id is kept for the sign-up conversion. The library decides whether
 * anything is actually loaded.
 */
export function GoogleAdsTag() {
  const pathname = usePathname();

  useEffect(() => {
    googleAdsTrack("Visit");
  }, [pathname]);

  useEffect(() => {
    window.addEventListener(AD_CONSENT_EVENT, flushGoogleAds);
    return () => window.removeEventListener(AD_CONSENT_EVENT, flushGoogleAds);
  }, []);

  return null;
}
