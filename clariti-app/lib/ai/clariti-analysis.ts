import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { buildFallbackAnalysis } from "@/lib/domain/clariti-fallback-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";

export const claritiDocumentKindSchema = z.enum([
  "medical_bill",
  "insurance_eob",
  "radiology_report",
  "lab_results",
  "discharge_summary",
  "medication_context",
  "pathology_report",
  "referral_letter",
  "visit_notes",
  "prior_authorization",
  "unknown",
]);
export type ClaritiAnalysisKind = z.infer<typeof claritiDocumentKindSchema>;

export const claritiSceneSchema = z.object({
  title: z.string(),
  script: z.string(),
  visual: z.string(),
  sourceAnchor: z.string(),
});

export const claritiAnalysisSchema = z.object({
  kind: claritiDocumentKindSchema,
  title: z.string(),
  summary: z.string(),
  plainEnglish: z.string(),
  sourceAnchors: z.array(z.string()).min(1),
  keyPoints: z.array(z.object({ label: z.string(), detail: z.string(), sourceAnchor: z.string() })).min(1),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), caveat: z.string().optional() })).default([]),
  flags: z.array(z.object({ label: z.string(), detail: z.string(), severity: z.enum(["info", "check", "urgent"]) })).default([]),
  questions: z.array(z.string()).min(1),
  nextActions: z.array(z.string()).min(1),
  safetyNote: z.string(),
  videoScenes: z.array(claritiSceneSchema).length(5).optional(),
});

export type ClaritiAnalysis = z.infer<typeof claritiAnalysisSchema>;

type AnalyzeInput = {
  kind: ClaritiAnalysisKind;
  question: string;
  documentText: string;
};

export async function analyzeClaritiDocument(input: AnalyzeInput): Promise<ClaritiAnalysis> {
  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) return buildFallbackAnalysis(input);

  const kindMeta = getClaritiKindMeta(input.kind);

  try {
    const result = await generateObject({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      schema: claritiAnalysisSchema,
      maxOutputTokens: 2600,
      schemaName: "ClaritiDocumentAnalysis",
      schemaDescription: "A warm, simple, source-grounded explanation of one health document for a non-expert reader.",
      temperature: 0.2,
      system:
        "You are Clariti, a friendly helper who explains confusing health paperwork in everyday language. " +
        "Talk like a calm, clear person — not a doctor, lawyer, or insurance clerk. Prefer short words and short sentences. " +
        "Avoid jargon. If a medical or billing term appears in the document, explain it in plain words right away. " +
        "Explain only what is in the supplied document. Do not diagnose, prescribe, decide coverage, or tell the user they definitely owe money. " +
        "Use humble phrasing such as 'this looks like', 'the document says', and 'ask your doctor / insurer / billing team'. " +
        "Keep summary and plainEnglish concise and human. Put detail into keyPoints, metrics, flags, questions, and nextActions. " +
        "Questions and nextActions should sound like something a real person would say out loud. " +
        "Flag labels are short headlines the user sees first, so keep them calm and specific rather than blunt or alarming — " +
        "prefer 'Some changes since your last scan' over 'Things have gotten worse', and 'A nerve is being touched' over dramatic phrasing. " +
        "Reserve severity 'urgent' only for findings that need prompt medical attention; use 'check' for things worth discussing with a clinician, and 'info' for reassuring or purely informational notes. " +
        "For urgent symptoms or emergency language, tell the user to seek urgent or emergency care.",
      prompt:
        `Document type: ${input.kind} (${kindMeta.title})\n` +
        `User question: ${input.question}\n\n` +
        `Document text:\n${input.documentText.slice(0, 12000)}\n\n` +
        "Return kind, title, summary, plainEnglish, sourceAnchors, keyPoints, metrics, flags, questions, nextActions, and safetyNote. " +
        "Do not include videoScenes in this first-pass response — Clariti builds those later if needed. " +
        "summary must be one plain sentence a friend could understand. plainEnglish must be 2-3 short everyday sentences. safetyNote must be one short reassuring sentence. " +
        "keyPoint labels should be everyday phrases, not clinical headings. " +
        "Every keyPoint, metric and flag must be grounded in a source phrase from the document.",
    });

    return normalizeSourceLabels(claritiAnalysisSchema.parse(result.object), input.documentText);
  } catch {
    return normalizeSourceLabels(buildFallbackAnalysis(input), input.documentText);
  }
}

function normalizeSourceLabels(analysis: ClaritiAnalysis, documentText: string): ClaritiAnalysis {
  if (analysis.kind !== "radiology_report") return analysis;

  const hasConclusion = /^\s*(?:\*\*)?conclusion(?:\*\*)?\s*:/im.test(documentText);
  const hasImpression = /^\s*(?:\*\*)?impression(?:\*\*)?\s*:/im.test(documentText);
  if (!hasConclusion || hasImpression) return analysis;

  const replace = (value: string) => value.replace(/\bImpression\b/g, "Conclusion").replace(/\bimpression\b/g, "conclusion");

  return {
    ...analysis,
    sourceAnchors: analysis.sourceAnchors.map(replace),
    keyPoints: analysis.keyPoints.map((point) => ({ ...point, sourceAnchor: replace(point.sourceAnchor) })),
    videoScenes: analysis.videoScenes?.map((scene) => ({
      ...scene,
      sourceAnchor: replace(scene.sourceAnchor),
      script: replace(scene.script),
      visual: replace(scene.visual),
    })),
  };
}
