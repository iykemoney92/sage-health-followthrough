"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import { flagSeverityToToken } from "@/lib/domain/clariti-severity";
import { SeverityBadge } from "@/components/clariti/severity-badge";

export function AnalysisTeaserCard({ analysis, onOpen }: { analysis: ClaritiAnalysis; onOpen: () => void }) {
  const meta = getClaritiKindMeta(analysis.kind);
  const metric = analysis.metrics[0];
  const flag = analysis.flags[0];

  return (
    <button className="chat-artifact-card" onClick={onOpen}>
      <span className="artifact-card-top">
        <span>
          <small>{meta.eyebrow}</small>
          <b>{meta.canvasTitle}</b>
        </span>
        <Sparkles />
      </span>
      <span className="artifact-card-metric">
        <strong>{metric?.value ?? String(analysis.keyPoints.length)}</strong>
        <small>{metric?.label ?? "key points"}</small>
      </span>
      <span className="artifact-card-note">
        {flag ? (
          <SeverityBadge token={flagSeverityToToken(flag.severity)} label={flag.label} />
        ) : (
          <>
            <CheckCircle2 />
            {analysis.questions[0] ?? "Ready for review"}
          </>
        )}
      </span>
      <span className="artifact-card-cta">
        View full analysis <span>→</span>
      </span>
    </button>
  );
}
