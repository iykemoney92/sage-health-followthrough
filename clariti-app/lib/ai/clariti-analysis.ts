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

/**
 * `degraded` means the model never read the document: there was no key, or the
 * call failed, and `analysis` is the regex fallback instead. It reads like a
 * finished answer, so every caller has to carry the flag through and label it —
 * a confident-sounding guess about somebody's medical paperwork is worse than an
 * obvious gap.
 */
export type ClaritiAnalysisResult = {
  analysis: ClaritiAnalysis;
  degraded: boolean;
  /**
   * Set when the model call threw, for the caller to report. Described rather
   * than passed through: a provider error carries the offending model output,
   * and that output is a summary of somebody's medical record.
   */
  failure?: { name: string; message: string };
};

export async function analyzeClaritiDocument(input: AnalyzeInput): Promise<ClaritiAnalysisResult> {
  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) return { analysis: buildFallbackAnalysis(input), degraded: true };

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
        "Every keyPoint, metric and flag must be grounded in the document. " +
        "Each sourceAnchors entry and each keyPoint sourceAnchor must be an exact quote, copied word for word from the document text above — " +
        "a short run of roughly three to fifteen words that really appears there. Not a paraphrase, not a tidied-up version, " +
        "and not a section heading unless that heading is printed in the document. " +
        "If no wording in the document supports a keyPoint, return an empty sourceAnchor for it rather than inventing a citation: " +
        "Clariti checks every quote against the document and removes the ones it cannot find.",
    });

    const normalized = normalizeSourceLabels(claritiAnalysisSchema.parse(result.object), input.documentText);

    return {
      // Verification runs after the rename, never before it: normalizeSourceLabels
      // rewrites "Impression" to "Conclusion" exactly when the report says
      // Conclusion, so checking first would strip a citation for naming the
      // section the document actually uses.
      analysis: verifyKeyPointAnchors(normalized, input.documentText),
      degraded: false,
    };
  } catch (error) {
    // This used to be a bare catch, so a model outage looked exactly like a good
    // pass from both sides: the reader got a regex summary of their bill and the
    // log said nothing at all.
    //
    // Described here and reported by the caller, not reported here. Client
    // components import this module for its schema and types, so a server-only
    // import (`after`, inside the reporter) would pull next/server into the
    // browser graph and fail the build — tsc, eslint and vitest all pass while
    // it does, so nothing but `next build` would have caught it.
    //
    // Capped, because a provider error carries the offending model output and
    // that output is a summary of somebody's medical record.
    return {
      // Not verified: the fallback's anchors are section labels its own regexes
      // chose ("Findings", "Next steps"), not quotes it claims to have found, and
      // the whole result is already flagged degraded and offered as a retry.
      // Running the quote check here would blank every one of them and say
      // "no source" about text Clariti never read in the first place.
      analysis: normalizeSourceLabels(buildFallbackAnalysis(input), input.documentText),
      degraded: true,
      failure: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message.slice(0, 200) : "",
      },
    };
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

/**
 * Fold the differences a real citation can legitimately have, and nothing more:
 * case, whitespace runs (a PDF breaks lines mid-sentence), and the typographic
 * quotes and dashes an extractor emits where the model types ASCII. Anything
 * looser would be fuzzy matching, and a quote that only matches fuzzily is the
 * case this check exists to catch.
 */
function normalizeForAnchorMatch(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201f\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * "Source-grounded" is the promise on the box, and it was decorative: the reader
 * saw `Source: <whatever the model typed>` with identical confidence whether the
 * phrase was in their document or invented. The model is now asked for an exact
 * quote, and a quote that is not in the document loses its attribution here.
 *
 * Demoted, not dropped. A badly cited finding may still be a true one, and
 * deleting it would hide it from the reader; showing it with no source says what
 * Clariti actually knows. Only keyPoints are demoted: `sourceAnchors` is
 * `.min(1)` and saved analyses are re-parsed from the database with this schema,
 * so filtering that array could make an already-stored document unreadable.
 */
function verifyKeyPointAnchors(analysis: ClaritiAnalysis, documentText: string): ClaritiAnalysis {
  const haystack = normalizeForAnchorMatch(documentText);

  return {
    ...analysis,
    keyPoints: analysis.keyPoints.map((point) => {
      const anchor = normalizeForAnchorMatch(point.sourceAnchor);
      if (anchor.length > 0 && haystack.includes(anchor)) return point;
      return { ...point, sourceAnchor: "" };
    }),
  };
}
