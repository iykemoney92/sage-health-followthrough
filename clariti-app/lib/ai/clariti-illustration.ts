import { generateText, type GeneratedFile } from "ai";
import { claritiVideoAnalysisSchema, type ClaritiVideoAnalysis } from "@/lib/ai/clariti-video";

export const claritiIllustrationAnalysisSchema = claritiVideoAnalysisSchema;
export type ClaritiIllustrationAnalysis = ClaritiVideoAnalysis;

type GenerateClaritiIllustrationInput = {
  analysis: ClaritiIllustrationAnalysis;
  sceneIndex: number;
};

export async function generateClaritiIllustration({ analysis, sceneIndex }: GenerateClaritiIllustrationInput) {
  const prompt = buildIllustrationPrompt(analysis, sceneIndex);
  const model = process.env.CLARITI_ILLUSTRATION_MODEL ?? "google/gemini-3.1-flash-image-preview";
  const result = await generateText({
    model,
    prompt,
    maxRetries: 1,
  });
  const image = firstGeneratedImage(result.files);
  if (!image) {
    throw new Error(`No image file returned from ${model}. Choose a Vercel AI Gateway image-generation model.`);
  }

  return {
    image,
    model,
    prompt,
  };
}

function firstGeneratedImage(files: GeneratedFile[]) {
  return files.find((file) => file.mediaType.startsWith("image/"));
}

export function buildIllustrationPrompt(analysis: ClaritiIllustrationAnalysis, sceneIndex: number) {
  const scene = analysis.videoScenes?.[sceneIndex];
  const keyPoints = analysis.keyPoints
    .slice(0, 4)
    .map((point) => `- ${point.label}: ${point.detail}. Source: ${point.sourceAnchor}`)
    .join("\n");
  const metrics = analysis.metrics
    .slice(0, 5)
    .map((metric) => `- ${metric.label}: ${metric.value}${metric.caveat ? ` (${metric.caveat})` : ""}`)
    .join("\n");
  const source = scene?.sourceAnchor ?? analysis.keyPoints[0]?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "saved document";

  return `
Create a premium 16:9 patient-education illustration for Clariti.

Document type: ${analysis.kind}
Title: ${analysis.title}
Scene: ${scene?.title ?? "Main explanation"}
Scene purpose: ${scene?.visual ?? scene?.script ?? analysis.summary}
Source anchor to ground the illustration: ${source}

Strict accuracy rules:
- Use only the details below. Do not invent findings, diagnosis, urgency, symptoms, charges, coverage, treatment, or outcomes.
- Do not include PHI, patient identifiers, MRNs, barcodes, hospital names, or real document screenshots.
- Include a small readable footer: "Educational only. Not a diagnosis or final billing decision."
- Keep labels concise and medically careful.

${analysis.kind === "radiology_report" ? buildRadiologyArtDirection(analysis) : ""}
${analysis.kind === "medical_bill" ? buildBillArtDirection() : ""}
${analysis.kind === "insurance_eob" ? buildEobArtDirection() : ""}

Grounded key points:
${keyPoints || analysis.summary}

Grounded metrics:
${metrics || "No numeric metrics extracted."}

Safety note:
${analysis.safetyNote}

Visual quality: accurate medical/product illustration, clean editorial healthcare style, detailed but not frightening, light background, teal accent, polished enough for a patient-facing app. Do not create SVG, wireframe UI, hand-drawn icons, or generic clip art.
`.trim();
}

function buildRadiologyArtDirection(analysis: ClaritiIllustrationAnalysis) {
  const text = `${analysis.title} ${analysis.summary} ${analysis.plainEnglish}`.toLowerCase();
  if (/shoulder|supraspinatus|rotator|humeral|acromio/.test(text)) {
    return "Radiology art direction: show an accurate simplified shoulder anatomy diagram with humeral head, rotator cuff/supraspinatus region, tendon retraction region if mentioned, and nearby acromioclavicular area only if present in the report. Use neutral educational labels, no surgical imagery.";
  }
  if (/lumbar|spine|disc|l4|l5|stenosis|vertebra/.test(text)) {
    return "Radiology art direction: show an accurate simplified lumbar spine anatomy diagram with vertebrae/discs and the report-mentioned level highlighted only if it appears in the source wording. Use neutral educational labels, no severe injury imagery.";
  }
  return "Radiology art direction: create an accurate simplified anatomy diagram for the body part named in the report, highlighting only the source-grounded finding area.";
}

function buildBillArtDirection() {
  return "Bill art direction: create a clear bill-breakdown infographic showing total charges, payments/adjustments if present, amount due or amount to verify, and the safest billing question. Use exact values only from the metrics.";
}

function buildEobArtDirection() {
  return "EOB art direction: create a clear insurance claim-flow infographic showing provider billed, allowed amount, plan paid, and possible patient responsibility if present. Use exact values only from the metrics and make clear it is not necessarily a bill.";
}
