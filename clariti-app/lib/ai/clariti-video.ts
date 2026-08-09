import { z } from "zod";
import { claritiAnalysisSchema } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";

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
  const cleaned = message.replace(/\s+/g, " ").trim();

  if (!cleaned) return "The video was not generated. Please try again.";
  if (/unsupported output video duration/i.test(cleaned)) {
    return "That video length is not supported. Please try again.";
  }
  if (/minimum balance|insufficient/i.test(cleaned)) {
    return "Video generation is not available right now. Please try again later.";
  }
  if (/clariti_video_generations|relation .* does not exist/i.test(cleaned)) {
    return "Video storage is not set up yet in Supabase. Apply the video migrations, then retry.";
  }
  if (/could not save the video to storage|clariti-videos|not reachable|public video url/i.test(cleaned)) {
    return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
  }
  if (/sign in|unauthorized|auth/i.test(cleaned)) {
    return "Sign in again, then generate the video so Clariti can save it to your account.";
  }
  if (/save this analysis first/i.test(cleaned)) {
    return cleaned;
  }
  if (/shotstack/i.test(cleaned)) {
    return "Clariti could not finish stitching the video scenes. Please try again.";
  }
  if (cleaned.length <= 180 && !/api[_ -]?key|token|secret/i.test(cleaned)) {
    return cleaned;
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
  const nextAction = analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.";
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
      ? buildDefaultFiveScenePlan({
        analysis,
        documentNoun,
        reportType,
        visualDirection,
        main,
        second,
        third,
        question,
        nextAction,
      })
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
      "Keep this as one continuous spoken beat of about six seconds.",
      `Document type: ${documentNoun}.`,
      `The human presenter speaks this narration as closely as possible: "${trimNarration(scene.narration)}"`,
      `Scene visual: ${scene.visual}`,
      `Overall visual style: ${visualDirection}`,
      "No fear imagery, hospital drama, invented findings, invented charges, invented coverage decisions, or diagnostic claims.",
      `Clearly include this safety note: ${getEducationalDisclaimer(analysis)}`,
      "No brand logos. Captions should be clean and legible if included.",
      `Safety boundary: ${analysis.safetyNote}`,
    ].join(" "),
  }));
}

type ScenePlan = {
  title: string;
  narration: string;
  sourceAnchor: string;
  visual: string;
};

function buildDefaultFiveScenePlan({
  analysis,
  documentNoun,
  reportType,
  visualDirection,
  main,
  second,
  third,
  question,
  nextAction,
}: {
  analysis: ClaritiVideoAnalysis;
  documentNoun: string;
  reportType: string;
  visualDirection: string;
  main?: ClaritiVideoAnalysis["keyPoints"][number];
  second?: ClaritiVideoAnalysis["keyPoints"][number];
  third?: ClaritiVideoAnalysis["keyPoints"][number];
  question: string;
  nextAction: string;
}): ScenePlan[] {
  const family = getClaritiKindMeta(analysis.kind).uiFamily;
  return [
    {
      title: "What this document is",
      narration: `Let's walk through this ${documentNoun} together. In plain words: ${analysis.summary}`,
      sourceAnchor: analysis.sourceAnchors[0] ?? main?.sourceAnchor ?? "Document header",
      visual: "Show the document header and highlight the opening source phrase being explained.",
    },
    {
      title: family === "clinical_report" ? "What the report focuses on" : family === "money" ? "How the money flows" : "What matters most",
      narration: family === "clinical_report"
        ? `The report is talking about ${reportType}. Match this wording with how you feel when you talk with your clinician.`
        : family === "money"
          ? `The key numbers are ${analysis.metrics.slice(0, 3).map((metric) => `${metric.label}: ${metric.value}`).join(", ") || analysis.summary}.`
          : `Here is what matters most: ${main?.detail ?? analysis.summary}`,
      sourceAnchor: analysis.metrics[0]?.label ?? main?.sourceAnchor ?? "Key detail",
      visual: visualDirection,
    },
    {
      title: "Main takeaway",
      narration: `The main takeaway is ${main?.detail ?? analysis.plainEnglish}`,
      sourceAnchor: main?.sourceAnchor ?? analysis.sourceAnchors[0] ?? "Main point",
      visual: family === "clinical_report"
        ? visualDirection
        : "Show the most important source-grounded point as a clean explainer card.",
    },
    {
      title: "Another important detail",
      narration: second
        ? `It also notes ${second.detail}`
        : third
          ? `It also notes ${third.detail}`
          : analysis.plainEnglish,
      sourceAnchor: second?.sourceAnchor ?? third?.sourceAnchor ?? analysis.sourceAnchors[1] ?? analysis.sourceAnchors[0] ?? "Document wording",
      visual: "Show a secondary source phrase and a short plain-English explanation beside it.",
    },
    {
      title: "What to ask next",
      narration: `${getSafetyShortLine(analysis)} A good next step: ${nextAction} Ask: ${question}`,
      sourceAnchor: analysis.sourceAnchors[0] ?? "Next step",
      visual: "Show a concise next-question checklist with the educational disclaimer.",
    },
  ];
}

function trimNarration(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 217).trim()}...`;
}

export async function designExplainerStoryboard(analysis: ClaritiVideoAnalysis) {
  if (analysis.videoScenes?.length === 5) return analysis.videoScenes;

  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) {
    return buildDefaultFiveScenePlan({
      analysis,
      documentNoun: getDocumentNoun(analysis),
      reportType: getReportType(analysis),
      visualDirection: getVisualDirection(analysis),
      main: analysis.keyPoints[0],
      second: analysis.keyPoints[1],
      third: analysis.keyPoints[2],
      question: analysis.questions[0] ?? getDefaultQuestion(analysis),
      nextAction: analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.",
    }).map((scene) => ({
      title: scene.title,
      script: scene.narration,
      visual: scene.visual,
      sourceAnchor: scene.sourceAnchor,
    }));
  }

  try {
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { generateObject } = await import("ai");
    const { claritiSceneSchema } = await import("@/lib/ai/clariti-analysis");
    const { z } = await import("zod");

    const result = await generateObject({
      model: hasGatewayAuth
        ? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
        : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
      schema: z.object({ videoScenes: z.array(claritiSceneSchema).length(5) }),
      maxOutputTokens: 1600,
      temperature: 0.3,
      schemaName: "ClaritiVideoStoryboard",
      schemaDescription: "A five-scene spoken explainer storyboard for one health document.",
      system:
        "You design short spoken video scripts for Clariti. " +
        "Write like a calm friend explaining paperwork. Exactly 5 scenes. " +
        "Each script must be one or two short spoken sentences that fit about six seconds. " +
        "Ground every scene in the provided analysis source anchors. " +
        "Do not diagnose, invent findings, invent charges, or invent coverage decisions.",
      prompt: [
        `Document type: ${analysis.kind} (${getDocumentNoun(analysis)})`,
        `Title: ${analysis.title}`,
        `Summary: ${analysis.summary}`,
        `Plain English: ${analysis.plainEnglish}`,
        `Key points: ${analysis.keyPoints.map((point) => `${point.label}: ${point.detail} [${point.sourceAnchor}]`).join(" | ")}`,
        `Metrics: ${analysis.metrics.map((metric) => `${metric.label}: ${metric.value}`).join(" | ") || "none"}`,
        `Questions: ${analysis.questions.slice(0, 3).join(" | ")}`,
        `Next actions: ${analysis.nextActions.slice(0, 3).join(" | ")}`,
        `Safety note: ${analysis.safetyNote}`,
        "Create 5 scenes in this arc: 1) what this document is, 2) the focus or money flow, 3) main takeaway, 4) another important detail, 5) what to ask next.",
        "Each visual should describe a calm on-screen graphic or document highlight, not medical drama.",
      ].join("\n"),
    });

    return result.object.videoScenes;
  } catch {
    return buildDefaultFiveScenePlan({
      analysis,
      documentNoun: getDocumentNoun(analysis),
      reportType: getReportType(analysis),
      visualDirection: getVisualDirection(analysis),
      main: analysis.keyPoints[0],
      second: analysis.keyPoints[1],
      third: analysis.keyPoints[2],
      question: analysis.questions[0] ?? getDefaultQuestion(analysis),
      nextAction: analysis.nextActions[0] ?? "Bring this document to your next conversation with the right person.",
    }).map((scene) => ({
      title: scene.title,
      script: scene.narration,
      visual: scene.visual,
      sourceAnchor: scene.sourceAnchor,
    }));
  }
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
  return getClaritiKindMeta(analysis.kind).documentNoun;
}

function getVisualDirection(analysis: ClaritiVideoAnalysis) {
  const family = getClaritiKindMeta(analysis.kind).uiFamily;
  if (family === "money" && analysis.kind === "insurance_eob") {
    return "a clean claim-flow visual showing provider billed, plan allowed, insurer paid, and possible patient responsibility using only source-grounded numbers";
  }
  if (family === "money" && analysis.kind === "medical_bill") {
    return "a clean bill-breakdown visual showing total charges, adjustments/payments if present, amount due, and charges to check using only source-grounded numbers";
  }
  if (family === "money") {
    return "a clean decision or money-flow visual using only source-grounded amounts, statuses, and next steps";
  }
  if (family === "lab") {
    return "a clean lab-results visual highlighting key markers and reference-range language from the source text only";
  }
  if (family === "medication") {
    return "a clean medication-list visual showing medicine names, doses, and timing cues from the source text only";
  }
  if (family === "care_plan") {
    return "a clean care-plan visual showing what happened, what to do next, and warning or follow-up cues from the source text only";
  }
  if (family === "clinical_report") {
    return `a clean non-graphic educational illustration tailored to ${getReportType(analysis)} and the source-grounded finding`;
  }
  return "a clean patient-education visual summarizing the main source-grounded takeaway and next question";
}

function getSafetyShortLine(analysis: ClaritiVideoAnalysis) {
  return getClaritiKindMeta(analysis.kind).safetyShort;
}

function getEducationalDisclaimer(analysis: ClaritiVideoAnalysis) {
  return `Educational explanation only. ${getClaritiKindMeta(analysis.kind).educationDisclaimer}`;
}

function getDefaultQuestion(analysis: ClaritiVideoAnalysis) {
  return analysis.questions[0] ?? getClaritiKindMeta(analysis.kind).defaultQuestion;
}
