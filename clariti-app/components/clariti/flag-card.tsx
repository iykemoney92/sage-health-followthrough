"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import { flagSeverityToToken } from "@/lib/domain/clariti-severity";

const SEVERITY_ICON = {
  info: Info,
  check: CheckCircle2,
  urgent: AlertTriangle,
} as const;

export function FlagCard({ flag }: { flag: ClaritiAnalysis["flags"][number] }) {
  const token = flagSeverityToToken(flag.severity);
  const Icon = SEVERITY_ICON[flag.severity];
  return (
    <section className={`canvas-card flag-card sev-${token}`}>
      <div className="card-title">
        <Icon />
        <h3>{flag.label}</h3>
      </div>
      <p>{flag.detail}</p>
    </section>
  );
}
