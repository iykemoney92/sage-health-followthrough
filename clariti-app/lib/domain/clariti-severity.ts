import type { ClaritiAnalysis } from "@/lib/ai/clariti-analysis";
import type { ProgressionTrend } from "@/lib/domain/clariti-progression";

export type ClaritiFlagSeverity = ClaritiAnalysis["flags"][number]["severity"];
export type ClaritiSeverityToken = "info" | "check" | "urgent" | "positive" | "neutral";

/** Flag severities map 1:1 onto severity tokens. */
export function flagSeverityToToken(severity: ClaritiFlagSeverity): ClaritiSeverityToken {
  return severity;
}

const TREND_TOKEN: Record<ProgressionTrend, ClaritiSeverityToken> = {
  improving: "positive",
  worsening: "urgent",
  stable: "info",
  mixed: "check",
  insufficient: "neutral",
};

export function trendToSeverityToken(trend: ProgressionTrend): ClaritiSeverityToken {
  return TREND_TOKEN[trend];
}
