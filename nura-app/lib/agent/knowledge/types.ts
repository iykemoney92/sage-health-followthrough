import type { PlanCategory } from "@/lib/domain/journey-naming";

/** Stable knowledge pack the agent can load by Journey category. */
export type AgentKnowledgeDoc = {
  /** Stable id for future embeddings / RAG chunk keys. */
  id: string;
  category: PlanCategory | "shared";
  title: string;
  /** Why this pack exists (persona, guardrail, clinical detail, etc.). */
  purpose: "persona" | "guardrail" | "detail" | "mixed";
  body: string;
};
