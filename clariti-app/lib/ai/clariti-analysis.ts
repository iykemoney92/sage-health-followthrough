import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { buildFallbackAnalysis } from "@/lib/domain/clariti-fallback-analysis";

export const claritiDocumentKindSchema = z.enum(["medical_bill", "insurance_eob", "radiology_report"]);
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

  try {
    const result = await generateObject({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      schema: claritiAnalysisSchema,
      maxOutputTokens: 2400,
      schemaName: "ClaritiDocumentAnalysis",
      schemaDescription: "A conservative, source-grounded consumer explanation of one health document.",
      temperature: 0.1,
      system:
        "You are Clariti, a conservative consumer health document copilot. Explain only what is in the supplied document. " +
        "Do not diagnose, prescribe, decide coverage, or tell the user they definitely owe money. Distinguish source text from explanation. " +
        "Use careful language such as 'the report describes', 'the document appears to show', and 'ask your clinician/insurer/provider'. " +
        "For urgent symptoms or emergency language, tell the user to seek urgent or emergency care.",
      prompt:
        `Document type: ${input.kind}\n` +
        `User question: ${input.question}\n\n` +
        `Document text:\n${input.documentText.slice(0, 12000)}\n\n` +
        "Return kind, title, summary, plainEnglish, sourceAnchors, keyPoints, metrics, flags, questions, nextActions and safetyNote. " +
        "Every keyPoint, metric and flag must be grounded in a source phrase from the document. " +
        "If kind is radiology_report, include exactly 5 videoScenes for a short explainer storyboard. " +
        "Each scene must be grounded in a source phrase and must not invent findings.",
    });

    return claritiAnalysisSchema.parse(result.object);
  } catch {
    return buildFallbackAnalysis(input);
  }
}
