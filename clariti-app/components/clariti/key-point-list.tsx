"use client";

import { CheckCircle2, Pill } from "lucide-react";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";

type KeyPoint = ClaritiAnalysis["keyPoints"][number];

export function KeyPointList({
  points,
  variant,
  heading = "Key points",
  limit,
}: {
  points: KeyPoint[];
  variant: "list" | "row" | "timeline" | "pills";
  heading?: string;
  limit?: number;
}) {
  const items = limit ? points.slice(0, limit) : points;

  if (variant === "row") {
    return (
      <>
        {items.map((point) => (
          <div className="finding-row" key={point.label}>
            <span>{point.label}</span>
            <b>{point.detail}</b>
          </div>
        ))}
      </>
    );
  }

  if (variant === "timeline") {
    return (
      <section className="care-timeline">
        {items.map((point, index) => (
          <div key={point.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <b>{point.label}</b>
              <small>{point.detail}</small>
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (variant === "pills") {
    return (
      <section className="med-list">
        {items.map((point) => (
          <div key={point.label}>
            <Pill />
            <div>
              <b>{point.label}</b>
              <small>{point.detail}</small>
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="canvas-card">
      <h3>{heading}</h3>
      <ul className="key-findings-list">
        {items.map((point) => (
          <li key={point.label}>
            <CheckCircle2 />
            <span>
              <b>{point.label}</b>
              <small>
                {point.detail} Source: {point.sourceAnchor}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
