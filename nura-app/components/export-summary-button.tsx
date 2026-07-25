"use client";
import { Download } from "lucide-react";

type Summary = { headline: string; patterns: string[]; questions: string[] };

export function ExportSummaryButton({ planTitle, summary }: { planTitle: string; summary: Summary }) {
  function handleExport() {
    const lines = [
      `${planTitle} — Summary`,
      "",
      summary.headline,
      "",
      "Patterns mentioned:",
      ...summary.patterns.map((p) => `- ${p}`),
      "",
      "Questions to discuss:",
      ...summary.questions.map((q) => `- ${q}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${planTitle.replace(/\s+/g, "-").toLowerCase()}-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return <button className="secondary-cta" onClick={handleExport}><Download /> Export</button>;
}
