"use client";

import { useEffect, useState } from "react";

export function LandingNavChrome({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <header className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>{children}</header>;
}
