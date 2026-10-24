"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { flushMeta, metaTrack } from "@/lib/meta-pixel";
import { AD_CONSENT_EVENT, isConversionLink } from "@/lib/quora-pixel";

/**
 * Wires the Meta Pixel (lib/meta-pixel.ts) into every page: a PageView per
 * public page, and GetStarted for store and "Get started" clicks. The library
 * decides whether anything is actually sent.
 */
export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    metaTrack("PageView");
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && isConversionLink(link.href)) metaTrack("GetStarted");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(AD_CONSENT_EVENT, flushMeta);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(AD_CONSENT_EVENT, flushMeta);
    };
  }, []);

  return null;
}
