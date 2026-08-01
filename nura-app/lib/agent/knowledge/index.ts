import type { PlanCategory } from "@/lib/domain/journey-naming";
import type { AgentKnowledgeDoc } from "./types";
import {
  gpFollowUpDoc,
  medicationDoc,
  mentalWellbeingDoc,
  occupationalStressDoc,
  postpartumDoc,
  recoveryDoc,
} from "./docs";

const ALL_DOCS: AgentKnowledgeDoc[] = [
  postpartumDoc,
  gpFollowUpDoc,
  mentalWellbeingDoc,
  occupationalStressDoc,
  medicationDoc,
  recoveryDoc,
];

const BY_ID = new Map(ALL_DOCS.map((doc) => [doc.id, doc]));
const BY_CATEGORY = new Map(
  ALL_DOCS.filter((doc) => doc.category !== "shared").map((doc) => [doc.category as PlanCategory, doc]),
);

export function listKnowledgeDocs(): AgentKnowledgeDoc[] {
  return [...ALL_DOCS];
}

export function getKnowledgeDoc(id: string): AgentKnowledgeDoc | null {
  return BY_ID.get(id) ?? null;
}

export function getKnowledgeForCategory(category: PlanCategory | string | null | undefined): AgentKnowledgeDoc | null {
  if (!category) return null;
  return BY_CATEGORY.get(category as PlanCategory) ?? null;
}

/** Load unique knowledge packs for one or more Journey categories. */
export function loadKnowledgeForCategories(categories: Array<PlanCategory | string | null | undefined>): AgentKnowledgeDoc[] {
  const seen = new Set<string>();
  const docs: AgentKnowledgeDoc[] = [];
  for (const category of categories) {
    const doc = getKnowledgeForCategory(category);
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    docs.push(doc);
  }
  return docs;
}

/** Prompt block injected into Claude / voice context. */
export function formatKnowledgeForPrompt(docs: AgentKnowledgeDoc[], maxChars = 6000): string {
  if (docs.length === 0) return "";
  const parts: string[] = [
    "CATEGORY KNOWLEDGE PACKS (use for persona, guardrails, and detail — do not recite verbatim to the user):",
  ];
  let used = parts[0].length;
  for (const doc of docs) {
    const block = `\n\n### ${doc.title} [${doc.id}]\nPurpose: ${doc.purpose}\n${doc.body.trim()}`;
    if (used + block.length > maxChars) {
      const remaining = Math.max(200, maxChars - used - 80);
      parts.push(`\n\n### ${doc.title} [${doc.id}]\n${doc.body.trim().slice(0, remaining)}…`);
      break;
    }
    parts.push(block);
    used += block.length;
  }
  return parts.join("");
}
