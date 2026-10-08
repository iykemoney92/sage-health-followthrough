"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AD_CONSENT_EVENT, flushQuora, isConversionLink, quoraTrack } from "@/lib/quora-pixel";

/**
 * Wires the Quora Pixel (lib/quora-pixel.ts) into every page: a ViewContent per
 * public page, and Generic for App Store and Google Play clicks. The library
 * decides whether anything is actually sent.
 */
export function QuoraPixel() {
  const pathname = usePathname();

  useEffect(() => {
    quoraTrack("ViewContent");
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && isConversionLink(link.href)) quoraTrack("Generic");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(AD_CONSENT_EVENT, flushQuora);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(AD_CONSENT_EVENT, flushQuora);
    };
  }, []);

  return null;
}
