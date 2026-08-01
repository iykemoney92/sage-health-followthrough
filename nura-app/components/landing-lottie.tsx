"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";

type LandingLottieProps = {
  src: string;
  className?: string;
  "aria-label"?: string;
};

export function LandingLottie({ src, className, "aria-label": ariaLabel }: LandingLottieProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setAnimationData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!animationData) {
    return <div className={className} aria-hidden="true" />;
  }

  return (
    <div className={className} aria-label={ariaLabel} role={ariaLabel ? "img" : undefined}>
      <Lottie animationData={animationData} loop autoplay />
    </div>
  );
}
