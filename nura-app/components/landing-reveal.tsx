"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll reveal that never leaves content invisible.
 * Content is always readable; motion only nudges transform on enter.
 */
export function LandingReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Visibility depends on matchMedia / layout — browser-only after mount.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }

    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    if (rect.top < vh * 0.92 && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    // Below the fold: wait for scroll, but keep opacity at 1 the whole time.
    setVisible(false);

    const show = () => setVisible(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);

    const fallback = window.setTimeout(show, 900);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={delayMs ? ({ "--reveal-delay": `${delayMs}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
