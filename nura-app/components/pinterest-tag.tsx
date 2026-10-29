"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { flushPinterest, pinterestTrack } from "@/lib/pinterest-tag";
import { AD_CONSENT_EVENT, isConversionLink } from "@/lib/quora-pixel";

/**
 * Wires the Pinterest tag (lib/pinterest-tag.ts) into every page: a pagevisit
 * per public page, and lead for store and "Get started" clicks. The library
 * decides whether anything is actually sent.
 */
export function PinterestTag() {
  const pathname = usePathname();

  useEffect(() => {
    pinterestTrack("pagevisit");
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && isConversionLink(link.href)) pinterestTrack("lead");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(AD_CONSENT_EVENT, flushPinterest);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(AD_CONSENT_EVENT, flushPinterest);
    };
  }, []);

  return null;
}
