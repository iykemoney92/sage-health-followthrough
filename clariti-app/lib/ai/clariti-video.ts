import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";

export const claritiVideoAnalysisSchema = claritiAnalysisSchema.pick({
  kind: true,
  title: true,
  summary: true,
  plainEnglish: true,
  keyPoints: true,
  questions: true,
  nextActions: true,
  safetyNote: true,
  sourceAnchors: true,
  metrics: true,
  videoScenes: true,
});

export type ClaritiVideoAnalysis = z.infer<typeof claritiVideoAnalysisSchema>;

export type ClaritiVideoScene = {
  sceneIndex: number;
  title: string;
  durationSeconds: number;
  narration: string;
  prompt: string;
  sourceAnchor: string;
  status: "queued" | "generating" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
};

export const supportedHumanVideoDurations = [4, 6, 8] as const;
export type ClaritiHumanVideoDuration = typeof supportedHumanVideoDurations[number];

export function normalizeHumanVideoDuration(durationSeconds: number): ClaritiHumanVideoDuration {
  if (durationSeconds <= 4) return 4;
  if (durationSeconds <= 6) return 6;
  return 8;
}

export function formatHumanVideoError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/unsupported output video duration/i.test(message)) {
    return "The video was not generated. Please try again.";
  }
  if (/minimum balance|insufficient/i.test(message)) {
    return "Video generation is not available right now. Please try again later.";
  }
  if (/shotstack/i.test(message)) {
    return "The video was not generated. Please try again.";
  }
  return "The video was not generated. Please try again.";
}

export function buildVideoScenes(analysis: ClaritiVideoAnalysis, durationSeconds: number): ClaritiVideoScene[] {
  const isStitchedExplainer = durationSeconds >= 24;
  const safeDuration = isStitchedExplainer ? 30 : normalizeHumanVideoDuration(durationSeconds);
  const reportType = getReportType(analysis);
  const documentNoun = getDocumentNoun(analysis);
  const visualDirection = getVisualDirection(analysis);
  const main = analysis.keyPoints[0];
  const second = analysis.keyPoints[1];
  const third = analysis.keyPoints[2];
  const question = analysis.questions[0] ?? getDefaultQuestion(analysis);
  const sceneCount = isStitchedExplainer ? 5 : safeDuration >= 8 ? 2 : 1;
  const perSceneDuration = isStitchedExplainer ? 6 : Math.min(8, Math.ceil(safeDuration / sceneCount));
  const character =
    "A calm, realistic healthcare explainer in a modern consultation room, warm eye contact, professional clothing, natural speech, premium healthcare product demo lighting.";

  const sourceStoryboard = analysis.videoScenes?.slice(0, sceneCount).map((scene) => ({
    title: scene.title,
    narration: scene.script,
    sourceAnchor: scene.sourceAnchor,
    visual: scene.visual,
  }));

  const plan = sourceStoryboard?.length === sceneCount
    ? sourceStoryboard
    : isStitchedExplainer
      ? [
      {
        title: "Orient to the document",
        narration: `This ${documentNoun} says ${analysis.summary}`,
        sourceAnchor: analysis.sourceAnchors[0] ?? main?.sourceAnchor ?? "Document header",
        visual: "Show the document header and highlight the source phrase being explained.",
      },
      {
        title: analysis.kind === "radiology_report" ? "Show the anatomy" : "Map the money flow",
        narration: analysis.kind === "radiology_report"
          ? `The key anatomy to understand is ${reportType}. The report wording should be matched with symptoms by a clinician.`
          : `The key numbers are ${analysis.metrics.slice(0, 3).map((metric) => `${metric.label}: ${metric.value}`).join(", ")}.`,
        sourceAnchor: analysis.metrics[0]?.label ?? "Key amounts",
        visual: visualDirection,
      },
      {
        title: "Main finding",
        narration: `The main finding is ${main?.detail ?? analysis.summary}`,
        sourceAnchor: main?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "Main point",
        visual: analysis.kind === "radiology_report" ? visualDirection : "Show the most important source-grounded point as a clean explainer card.",
      },
      {
        title: "Other wording",
        narration: second ? `It also notes ${second.detail}` : third ? `It also notes ${third.detail}` : analysis.plainEnglish,
        sourceAnchor: second?.sourceAnchor ?? third?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "Document wording",
        visual: "Show a secondary source phrase and a short plain-English explanation.",
      },
      {
        title: "Question to ask",
        narration: `${getSafetyShortLine(analysis)} Ask: ${question}`,
        sourceAnchor: analysis.sourceAnchors[0] ?? "Next step",
        visual: "Show a concise next-question checklist with the educational disclaimer.",
      },
    ]
    : sceneCount === 1
    ? [{
      title: "Main report finding",
      narration: `Your report describes ${main?.detail ?? analysis.summary}. Ask your clinician: ${question}`,
      sourceAnchor: main?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "Saved analysis",
      visual: visualDirection,
    }]
    : [
      {
        title: "Main report finding",
        narration: `Your report describes ${main?.detail ?? analysis.summary}`,
        sourceAnchor: main?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "Saved analysis",
        visual: visualDirection,
      },
      {
        title: "Question to ask",
        narration: `Clariti is explaining the wording, not diagnosing. Ask your clinician: ${question}`,
        sourceAnchor: analysis.sourceAnchors[0] ?? "Saved analysis",
        visual: "Show a concise question checklist and educational disclaimer.",
      },
    ];

  return plan.map((scene, index) => ({
    sceneIndex: index,
    title: scene.title,
    durationSeconds: perSceneDuration,
    narration: scene.narration,
    sourceAnchor: scene.sourceAnchor,
    status: "queued",
    prompt: [
      character,
      `Create scene ${index + 1} of ${sceneCount} for a ${safeDuration}-second patient explainer video.`,
      `Document type: ${documentNoun}.`,
      `The human presenter speaks this narration as closely as possible: "${scene.narration}"`,
      `Scene visual: ${scene.visual}`,
      `Overall visual style: ${visualDirection}`,
      "No fear imagery, hospital drama, invented findings, invented charges, invented coverage decisions, or diagnostic claims.",
      `Clearly include this safety note: ${getEducationalDisclaimer(analysis)}`,
      "No brand logos. Captions should be clean and legible if included.",
      `Safety boundary: ${analysis.safetyNote}`,
    ].join(" "),
  }));
}

export function buildHumanPresenterPrompt(analysis: ClaritiVideoAnalysis, durationSeconds: number) {
  const safeDuration = normalizeHumanVideoDuration(durationSeconds);
  const findings = analysis.keyPoints
    .slice(0, 4)
    .map((point) => `- ${point.label}: ${point.detail} Source: ${point.sourceAnchor}`)
    .join("\n");
  const questions = analysis.questions.slice(0, 3).map((question) => `- ${question}`).join("\n");
  const documentNoun = getDocumentNoun(analysis);
  const visualDirection = getVisualDirection(analysis);
  const script = buildPresenterScript(analysis, safeDuration);

  return `
Create a realistic ${safeDuration}-second 16:9 human explainer video for a patient reviewing one ${documentNoun}.

This must look like a real human presenter explainer, not a slideshow and not animated slides.
Show a calm healthcare explainer speaking directly to camera in a modern consultation room, with tasteful cutaways to:
- the uploaded report on a screen with the exact source phrases highlighted,
- ${visualDirection},
- clean captions that match the narration,
- a closing checklist of the safest next question or action.

Narration must follow this exact script as closely as possible:
"${script}"

Safety and accuracy rules:
- ${getEducationalDisclaimer(analysis)}
- Do not diagnose, prescribe treatment, or imply certainty beyond the report wording.
- Do not invent findings, anatomy, symptoms, charges, coverage decisions, severity, or urgency.
- Do not show surgery, injury, blood, scans that imply a different body part, hospital drama, or fear-based imagery.
- The presenter may say "the document describes" or "the report describes" when appropriate; never say "you have" as a diagnosis.

Grounding from the saved Clariti analysis:
Title: ${analysis.title}
Summary: ${analysis.summary}
Plain English: ${analysis.plainEnglish}
Key points:
${findings}

Useful clinician questions:
${questions}

Safety caption to include near the end:
${analysis.safetyNote}

Style: premium healthcare product demo, realistic lighting, warm and precise presenter, subtle report overlays, legible captions, no brand logos, no extra medical claims.
`.trim();
}

function buildPresenterScript(analysis: ClaritiVideoAnalysis, durationSeconds: ClaritiHumanVideoDuration) {
  const main = analysis.keyPoints[0];
  const question = analysis.questions[0] ?? getDefaultQuestion(analysis);

  if (durationSeconds >= 8) {
    return [
      `This ${getDocumentNoun(analysis)} says ${main?.detail ?? analysis.summary}`,
      getSafetyShortLine(analysis),
      `Ask: ${question}`,
    ].join(" ");
  }

  return [
    `This ${getDocumentNoun(analysis)} says ${main?.detail ?? analysis.summary}`,
    `Ask: ${question}`,
  ].join(" ");
}

function getReportType(analysis: ClaritiVideoAnalysis) {
  return analysis.metrics.find((metric) => /report type|exam|study/i.test(metric.label))?.value ?? "the radiology report";
}

function getDocumentNoun(analysis: ClaritiVideoAnalysis) {
  if (analysis.kind === "insurance_eob") return "insurance Explanation of Benefits";
  if (analysis.kind === "medical_bill") return "medical bill";
  return "radiology report";
}

function getVisualDirection(analysis: ClaritiVideoAnalysis) {
  if (analysis.kind === "insurance_eob") {
    return "a clean claim-flow visual showing provider billed, plan allowed, insurer paid, and possible patient responsibility using only source-grounded numbers";
  }
  if (analysis.kind === "medical_bill") {
    return "a clean bill-breakdown visual showing total charges, adjustments/payments if present, amount due, and charges to check using only source-grounded numbers";
  }
  return `a clean non-graphic anatomical illustration tailored to ${getReportType(analysis)} and the report finding`;
}

function getSafetyShortLine(analysis: ClaritiVideoAnalysis) {
  if (analysis.kind === "insurance_eob") return "This explains the EOB only; confirm coverage and payment with the insurer or provider.";
  if (analysis.kind === "medical_bill") return "This explains the bill only; confirm what you owe with the provider or insurer.";
  return "This explains report wording only; it is not a diagnosis.";
}

function getEducationalDisclaimer(analysis: ClaritiVideoAnalysis) {
  if (analysis.kind === "insurance_eob") {
    return "Educational explanation only; not legal, financial, coverage, or payment advice.";
  }
  if (analysis.kind === "medical_bill") {
    return "Educational explanation only; not legal, financial, billing, diagnosis, or payment advice.";
  }
  return "Educational explanation only; not a medical diagnosis or a replacement for a clinician.";
}

function getDefaultQuestion(analysis: ClaritiVideoAnalysis) {
  if (analysis.kind === "insurance_eob") return "Can you reconcile what the insurer says I owe against the provider bill?";
  if (analysis.kind === "medical_bill") return "Can you explain what I owe and which charges I should verify before paying?";
  return "Which finding best explains my symptoms?";
}
