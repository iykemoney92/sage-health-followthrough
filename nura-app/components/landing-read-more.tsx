"use client";

import { useId, useState } from "react";

type LandingReadMoreProps = {
  text: string;
  /** Characters to show before “Read more” (breaks on a word boundary). */
  previewLength?: number;
  className?: string;
};

function previewOf(text: string, limit: number) {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return { preview: trimmed, needsMore: false };

  const slice = trimmed.slice(0, limit);
  const breakAt = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" "));
  const preview = (breakAt > limit * 0.45 ? slice.slice(0, breakAt + (slice[breakAt] === "." ? 1 : 0)) : slice).trim();
  return { preview: preview.replace(/[,:;–—-]?$/, ""), needsMore: true };
}

export function LandingReadMore({ text, previewLength = 140, className = "" }: LandingReadMoreProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { preview, needsMore } = previewOf(text, previewLength);

  if (!needsMore) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div className={`landing-read-more ${className}`.trim()}>
      <p id={panelId}>{open ? text : `${preview}…`}</p>
      <button
        type="button"
        className="landing-read-more-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
